import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readCdpPort, stopChild } from '../scripts/check-craft-browser.mjs';

test('stopChild resolves when the child already exited from a signal', async () => {
  const child = spawn(process.execPath, ['-e', "process.kill(process.pid, 'SIGTERM')"]);
  await once(child, 'close');

  const termination = await stopChild(child, { timeoutMs: 2_000 });

  assert.equal(termination.signalCode, 'SIGTERM');
});

test('readCdpPort reports a browser startup failure without waiting for the port timeout', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'wingman-browser-startup-'));
  const missingCommand = path.join(profile, 'missing-browser');
  const child = spawn(missingCommand, [], { stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    await assert.rejects(
      readCdpPort(profile, child, { timeoutMs: 3_000 }),
      error => error.message.includes('failed to start') && error.message.includes('ENOENT')
    );
  } finally {
    await stopChild(child, { timeoutMs: 2_000 });
    await rm(profile, { recursive: true, force: true });
  }
});

test('readCdpPort includes Chromium stderr when the browser exits before startup', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'wingman-browser-stderr-'));
  const child = spawn(process.execPath, ['-e', "console.error('sandbox setup failed'); process.exit(7)"], {
    stdio: ['ignore', 'ignore', 'pipe']
  });
  try {
    await assert.rejects(
      readCdpPort(profile, child, { timeoutMs: 3_000 }),
      /code 7.*Chromium stderr: sandbox setup failed/
    );
  } finally {
    await stopChild(child, { timeoutMs: 2_000 });
    await rm(profile, { recursive: true, force: true });
  }
});

test('stopChild terminates a running child within its cleanup bound', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
  const termination = await stopChild(child, { timeoutMs: 5_000 });

  assert.equal(termination.signalCode, 'SIGKILL');
  assert.notEqual(child.signalCode, null);
});
