#!/usr/bin/env node
import { runCli } from '../src/cli.mjs';

try {
  await runCli();
} catch (error) {
  console.error(`wingman-design: ${error.message}`);
  process.exitCode = 1;
}
