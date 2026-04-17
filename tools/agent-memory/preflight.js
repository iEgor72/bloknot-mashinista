#!/usr/bin/env node
'use strict';

const { FILES, parseCliArgs, readText, refreshMemory } = require('./lib');

function toBoolean(value) {
  if (value === true) return true;
  if (value === false || value === undefined || value === null) return false;
  return String(value).toLowerCase() === 'true';
}

function getRecentChangelogEntries(text, limit) {
  const chunks = String(text || '').split('\n## ').slice(1);
  if (!chunks.length) return [];
  return chunks
    .map((chunk) => `## ${chunk}`)
    .slice(-limit)
    .reverse()
    .map((entryBlock) => {
      const lines = entryBlock.split(/\r?\n/).filter(Boolean);
      const heading = lines[0] ? lines[0].replace(/^##\s*/, '') : '';
      const taskLine = lines.find((line) => /^- Task:\s*/.test(line));
      const task = taskLine ? taskLine.replace(/^- Task:\s*/, '') : '';
      return { heading, task };
    })
    .filter((entry) => entry.heading);
}

function main() {
  const args = parseCliArgs();
  const skipSync = toBoolean(args['no-sync']);
  const result = refreshMemory({ sync: !skipSync });
  const changelog = readText(FILES.changelog, '');
  const entries = getRecentChangelogEntries(changelog, 3);

  console.log('[memory] preflight complete');
  console.log('[memory] read order: START_HERE -> PROJECT_STATE -> ARCHITECTURE -> METHODS -> ENGINEERING_STYLE -> CHANGELOG -> WORKTREE_STATUS');
  if (entries.length) {
    console.log('[memory] recent changelog entries:');
    for (const entry of entries) {
      if (entry.task) {
        console.log(`- ${entry.heading} | ${entry.task}`);
      } else {
        console.log(`- ${entry.heading}`);
      }
    }
  } else {
    console.log('[memory] no changelog entries yet');
  }

  if (result.sync.enabled) {
    console.log(`[memory] synced to Obsidian: ${result.sync.targetDir}`);
  } else {
    console.log(`[memory] Obsidian sync skipped: ${result.sync.reason}`);
  }
}

main();
