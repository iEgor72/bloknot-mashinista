#!/usr/bin/env node
'use strict';

const { appendChangelogEntry, detectWorkingTreeFiles, getHeadCommit, parseCliArgs, refreshMemory, splitList } = require('./lib');

function toText(value, fallback = '') {
  if (value === undefined || value === null || value === true) {
    return fallback;
  }
  return String(value).trim() || fallback;
}

function main() {
  const args = parseCliArgs();
  const head = getHeadCommit();

  const task = toText(args.task || args.what || args.note, 'Manual update');
  const notes = toText(args.notes || args.details || args.why, '');
  const source = toText(args.source, 'manual');
  const methods = splitList(args.methods || args.how);
  const providedFiles = splitList(args.files);
  const files = providedFiles.length ? providedFiles : detectWorkingTreeFiles();

  const appended = appendChangelogEntry({
    task,
    notes,
    source,
    methods,
    files,
    commitHash: head ? head.hash : '',
    commitSubject: head ? head.subject : '',
    author: head ? head.author : ''
  });

  const refreshResult = refreshMemory();

  if (appended) {
    console.log('[memory] changelog entry added');
  } else {
    console.log('[memory] changelog entry skipped');
  }

  if (refreshResult.sync.enabled) {
    console.log(`[memory] synced to Obsidian: ${refreshResult.sync.targetDir}`);
  } else {
    console.log(`[memory] Obsidian sync skipped: ${refreshResult.sync.reason}`);
  }
}

main();
