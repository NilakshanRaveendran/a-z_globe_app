#!/usr/bin/env node
/**
 * Apply the console-side Firebase setup the apps need, from the APIs.
 *
 *   node tools/setup-firebase.mjs --sha <SHA-1> --package com.azglobe.app
 *   node tools/setup-firebase.mjs --test-number +94772244482=123456
 *   node tools/setup-firebase.mjs --dry-run ...
 *
 * `tools/check-firebase.mjs` reports what is missing; this puts it in place, so
 * the setup is written down and repeatable rather than living in a sequence of
 * console clicks nobody can diff.
 *
 * Both operations are ADDITIVE. The SHA endpoint appends, and test numbers are
 * read, merged, and written back — the identity-toolkit PATCH replaces the whole
 * map, so writing only the new entry would silently delete every existing one.
 *
 * Credentials come from firebase/service-account.json.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createSign } from 'node:crypto';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const arg = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};
const sha = arg('--sha');
const pkg = arg('--package');
const testNumbers = argv.reduce((acc, a, i) => {
  if (a !== '--test-number') return acc;
  const [number, code] = String(argv[i + 1] ?? '').split('=');
  if (number && code) acc[number] = code;
  return acc;
}, /** @type {Record<string,string>} */ ({}));

if (!sha && !Object.keys(testNumbers).length) {
  console.error('Nothing to do. Pass --sha <SHA-1> --package <id> and/or --test-number <+NNN=code>.');
  process.exit(1);
}
if (sha && !pkg) {
  console.error('--sha needs --package to say which Android app it belongs to.');
  process.exit(1);
}

const KEY_PATH = 'firebase/service-account.json';
if (!existsSync(KEY_PATH)) {
  console.error(`Missing ${KEY_PATH}.`);
  process.exit(1);
}
const key = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
const PROJECT = key.project_id;

async function accessToken(scopes) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: key.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`token exchange failed: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function api(url, token, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body: json };
}

const token = await accessToken(['https://www.googleapis.com/auth/cloud-platform']);
console.log(`project: ${PROJECT}\n`);
const say = (m) => console.log(`${dryRun ? '[dry-run] ' : ''}${m}`);
let failed = false;

// ── SHA certificate ────────────────────────────────────────────────────────
if (sha) {
  const apps = await api(
    `https://firebase.googleapis.com/v1beta1/projects/${PROJECT}/androidApps`,
    token
  );
  if (!apps.ok) {
    console.error(`could not list Android apps: ${apps.status} ${JSON.stringify(apps.body)}`);
    process.exit(1);
  }
  const app = (apps.body.apps ?? []).find((a) => a.packageName === pkg);
  if (!app) {
    console.error(`no Android app registered for ${pkg}`);
    process.exit(1);
  }

  const existing = await api(
    `https://firebase.googleapis.com/v1beta1/projects/${PROJECT}/androidApps/${app.appId}/sha`,
    token
  );
  const normalise = (h) => h.replace(/:/g, '').toLowerCase();
  const already = (existing.body.certificates ?? []).some(
    (c) => normalise(c.shaHash) === normalise(sha)
  );
  if (already) {
    say(`${pkg}: SHA already present, nothing to do`);
  } else {
    say(`${pkg}: adding SHA_1 ${sha}`);
    if (!dryRun) {
      const res = await api(
        `https://firebase.googleapis.com/v1beta1/projects/${PROJECT}/androidApps/${app.appId}/sha`,
        token,
        { method: 'POST', body: { shaHash: normalise(sha), certType: 'SHA_1' } }
      );
      if (!res.ok) {
        failed = true;
        console.error(`  failed: ${res.status} ${JSON.stringify(res.body)}`);
      } else {
        say(`  added`);
      }
    }
  }
}

// ── Test phone numbers ─────────────────────────────────────────────────────
if (Object.keys(testNumbers).length) {
  const cfgUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config`;
  const current = await api(cfgUrl, token);
  if (!current.ok) {
    console.error(`could not read auth config: ${current.status}`);
    process.exit(1);
  }
  // Merge, never replace: this PATCH overwrites the whole map.
  const existingNumbers = current.body.signIn?.phoneNumber?.testPhoneNumbers ?? {};
  const merged = { ...existingNumbers, ...testNumbers };
  for (const [n, c] of Object.entries(testNumbers)) {
    say(existingNumbers[n] ? `test number ${n}: updating code -> ${c}` : `test number ${n}: adding (code ${c})`);
  }
  if (!dryRun) {
    const res = await api(
      `${cfgUrl}?updateMask=signIn.phoneNumber.testPhoneNumbers`,
      token,
      { method: 'PATCH', body: { signIn: { phoneNumber: { testPhoneNumbers: merged } } } }
    );
    if (!res.ok) {
      failed = true;
      console.error(`  failed: ${res.status} ${JSON.stringify(res.body)}`);
    } else {
      say(`  ${Object.keys(merged).length} test numbers now configured`);
    }
  }
}

console.log(`\nDone.${dryRun ? ' (nothing was written)' : ''}`);
process.exit(failed ? 1 : 0);
