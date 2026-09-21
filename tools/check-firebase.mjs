#!/usr/bin/env node
/**
 * Verify the Firebase project is actually configured the way the app needs.
 *
 *   node tools/check-firebase.mjs
 *
 * Reads firebase/service-account.json and reports, from the APIs rather than
 * from local files: whether Phone sign-in is on, which test numbers exist, and
 * which SHA certificates the Android app carries. The downloaded
 * google-services.json lags behind console changes, so it is not a reliable
 * signal on its own.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createSign } from 'node:crypto';

const KEY_PATH = 'firebase/service-account.json';
if (!existsSync(KEY_PATH)) {
  console.error(`Missing ${KEY_PATH} — Project settings > Service accounts > Generate new private key.`);
  process.exit(1);
}

const key = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
const PROJECT = key.project_id;

/** Mint an access token from the service-account key (JWT bearer grant). */
async function accessToken(scopes) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: key.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(claim)}`;
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

async function api(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

const token = await accessToken(['https://www.googleapis.com/auth/cloud-platform']);
console.log(`project: ${PROJECT}\n`);

// ── Identity Platform: is Phone sign-in on, and which test numbers exist? ──
const cfg = await api(
  `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config`,
  token
);
if (!cfg.ok) {
  console.log(`auth config  ?  could not read (${cfg.status}: ${cfg.body?.error?.message ?? ''})`);
} else {
  const phone = cfg.body.signIn?.phoneNumber;
  const enabled = Boolean(phone?.enabled);
  console.log(`${enabled ? 'PASS' : 'FAIL'}  Phone sign-in enabled: ${enabled}`);

  const testNumbers = phone?.testPhoneNumbers ?? {};
  const entries = Object.entries(testNumbers);
  console.log(
    `${entries.length ? 'PASS' : 'WARN'}  test phone numbers: ${entries.length || 'none'}`
  );
  for (const [number, code] of entries) console.log(`        ${number} -> ${code}`);

  // The SMS region policy is checked BEFORE the test-number shortcut, so an
  // empty allowlist blocks sign-in even for test numbers — with the opaque
  // error "17006 SMS unable to be sent until this region enabled".
  const region = cfg.body.smsRegionConfig ?? {};
  if (region.allowByDefault) {
    console.log('WARN  SMS regions: allowed by default (open to SMS-pumping fraud)');
  } else {
    const allowed = region.allowlistOnly?.allowedRegions ?? [];
    console.log(
      `${allowed.length ? 'PASS' : 'FAIL'}  SMS allowed regions: ${allowed.join(', ') || 'NONE — every sign-in will fail'}`
    );
  }
}

// ── Firebase Management: SHA certificates on the Android app ───────────────
const apps = await api(
  `https://firebase.googleapis.com/v1beta1/projects/${PROJECT}/androidApps`,
  token
);
if (!apps.ok) {
  console.log(`\nandroid apps  ?  could not read (${apps.status}: ${apps.body?.error?.message ?? ''})`);
} else {
  for (const app of apps.body.apps ?? []) {
    console.log(`\nandroid app: ${app.packageName}`);
    const sha = await api(`https://firebase.googleapis.com/v1beta1/${app.name}/sha`, token);
    const certs = sha.body?.certificates ?? [];
    console.log(`${certs.length ? 'PASS' : 'FAIL'}  SHA certificates: ${certs.length || 'none'}`);
    for (const c of certs) console.log(`        ${c.certType}  ${c.shaHash}`);
  }
}
