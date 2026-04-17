#!/usr/bin/env node
'use strict';

const { FILES, appendChangelogEntry, getHeadCommit, installPostCommitHook, readText, refreshMemory } = require('./lib');

function main() {
  const bootTag = '[memory-init]';

  const hook = installPostCommitHook();
  const initialRefresh = refreshMemory();

  const existing = readText(FILES.changelog, '');
  if (!existing.includes(bootTag)) {
    const head = getHeadCommit();
    appendChangelogEntry({
      source: 'init',
      task: `${bootTag} Bootstrap memory from existing project state`,
      methods: ['git log snapshot', 'repository structure scan', 'agent memory templates'],
      files: ['ai-memory/PROJECT_STATE.md', 'ai-memory/RECENT_COMMITS.md', 'ai-memory/WORKTREE_STATUS.md'],
      commitHash: head ? head.hash : '',
      commitSubject: head ? head.subject : '',
      author: head ? head.author : ''
    });
  }

  const finalRefresh = refreshMemory();

  console.log(`[memory] bootstrap completed at ${finalRefresh.generatedAt}`);
  console.log(`[memory] post-commit hook: ${hook.reason}`);

  if (initialRefresh.sync.enabled || finalRefresh.sync.enabled) {
    const syncTarget = finalRefresh.sync.enabled ? finalRefresh.sync.targetDir : initialRefresh.sync.targetDir;
    console.log(`[memory] synced to Obsidian: ${syncTarget}`);
  } else {
    console.log(`[memory] Obsidian sync skipped: ${finalRefresh.sync.reason}`);
  }
}

main();
