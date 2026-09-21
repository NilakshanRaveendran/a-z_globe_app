#!/usr/bin/env node
/**
 * Kill whatever is listening on a port.
 *
 *   node tools/free-port.mjs 8085
 *
 * The Firestore emulator does not always shut its JVM down when
 * `firebase emulators:exec` finishes on Windows, so the next run fails with
 * "port taken" and the test suite looks broken when it is not. Running this
 * first makes `npm run test:rules` reliable.
 *
 * Exits 0 whether or not anything was killed — there is usually nothing there.
 */
import { execSync } from 'node:child_process';

const port = process.argv[2];
if (!port || !/^\d+$/.test(port)) {
  console.error('usage: node tools/free-port.mjs <port>');
  process.exit(1);
}

function pidsOnPort() {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano -p tcp | findstr LISTENING | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return [
        ...new Set(
          out
            .split('\n')
            .map((l) => l.trim().split(/\s+/).pop())
            .filter((p) => p && /^\d+$/.test(p) && p !== '0')
        ),
      ];
    }
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    return []; // nothing listening
  }
}

const pids = pidsOnPort();
for (const pid of pids) {
  try {
    if (process.platform === 'win32') execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
    else process.kill(Number(pid), 'SIGKILL');
    console.log(`freed port ${port} (killed pid ${pid})`);
  } catch {
    console.warn(`could not kill pid ${pid} on port ${port}`);
  }
}
if (!pids.length) console.log(`port ${port} already free`);
