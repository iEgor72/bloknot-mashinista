#!/usr/bin/env node
'use strict';

const { parseCliArgs, refreshMemory } = require('./lib');

function main() {
  const args = parseCliArgs();
  const skipSync = args['no-sync'] === true || String(args['no-sync']).toLowerCase() === 'true';
  const result = refreshMemory({ sync: !skipSync });

  console.log(`[memory] refreshed at ${result.generatedAt}`);
  if (result.sync.enabled) {
    console.log(`[memory] synced to Obsidian: ${result.sync.targetDir}`);
  } else {
    console.log(`[memory] Obsidian sync skipped: ${result.sync.reason}`);
  }
}

main();
