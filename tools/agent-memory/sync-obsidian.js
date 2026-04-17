#!/usr/bin/env node
'use strict';

const { syncToObsidian } = require('./lib');

function main() {
  const result = syncToObsidian();
  if (result.enabled) {
    console.log(`[memory] synced to Obsidian: ${result.targetDir}`);
  } else {
    console.log(`[memory] sync skipped: ${result.reason}`);
  }
}

main();
