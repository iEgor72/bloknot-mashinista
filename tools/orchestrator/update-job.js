#!/usr/bin/env node
'use strict';

const { orchestratorRequest, parseCliArgs } = require('./client');

function normalizeStatus(value) {
  const raw = String(value || '').trim().toLowerCase();
  const allowed = new Set(['queued', 'in_progress', 'done', 'failed', 'canceled']);
  if (!allowed.has(raw)) {
    throw new Error(`Unsupported status: ${raw}`);
  }
  return raw;
}

function normalizeText(value) {
  return String(value || '').trim();
}

async function main() {
  const args = parseCliArgs();
  const id = normalizeText(args.id);
  if (!id) {
    throw new Error('Provide --id job-...');
  }

  const status = normalizeStatus(args.status || '');
  const result = normalizeText(args.result || '');
  const note = normalizeText(args.note || '');
  const noteBy = normalizeText(args.noteBy || 'cli');
  const notify = args.notify === true || String(args.notify || '').toLowerCase() === 'true';

  const payload = { status, result, note, noteBy, notify };
  const response = await orchestratorRequest('PATCH', `/api/orchestrator/jobs/${encodeURIComponent(id)}`, payload);
  if (!response || !response.job) {
    throw new Error('Unexpected response: missing job');
  }

  const job = response.job;
  console.log(`[orchestrator] updated ${job.id} -> ${job.status}`);
  if (job.result) {
    console.log(job.result);
  }
}

main().catch((error) => {
  console.error('[orchestrator] update failed:', error && error.message ? error.message : error);
  process.exit(1);
});

