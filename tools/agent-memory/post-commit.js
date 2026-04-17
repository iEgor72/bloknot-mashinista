#!/usr/bin/env node
'use strict';

const { appendChangelogEntry, getChangedFilesFromCommit, getHeadCommit, refreshMemory, runGit } = require('./lib');

function main() {
  const head = getHeadCommit();
  if (!head) {
    return;
  }

  const branch = runGit('branch --show-current');
  const changedFiles = getChangedFilesFromCommit(head.hash);

  appendChangelogEntry({
    source: 'post-commit',
    task: head.subject || 'Commit created',
    branch,
    files: changedFiles,
    methods: ['git post-commit hook', 'automatic memory update'],
    commitHash: head.hash,
    commitSubject: head.subject,
    author: head.author,
    dedupeByCommit: true
  });

  refreshMemory();
}

main();
