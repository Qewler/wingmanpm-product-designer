#!/usr/bin/env node
import { runCli } from '../skills/wingmanpm-product-designer/src/cli.mjs';

try {
  await runCli();
} catch (error) {
  console.error(`wingman-design: ${error.message}`);
  process.exitCode = 1;
}
