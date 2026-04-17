#!/usr/bin/env node
'use strict';

const { installPostCommitHook } = require('./lib');

function main() {
  const result = installPostCommitHook();
  if (result.installed) {
    console.log(`[memory] post-commit hook installed: ${result.hookPath}`);
  } else {
    console.log(`[memory] post-commit hook not changed: ${result.reason}`);
  }
}

main();
