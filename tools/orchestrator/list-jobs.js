#!/usr/bin/env node
'use strict';

const { orchestratorRequest, parseCliArgs } = require('./client');

function normalizeStatus(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const allowed = new Set(['queued', 'in_progress', 'done', 'failed', 'canceled']);
  if (!allowed.has(raw)) {
    throw new Error(`Unsupported status: ${raw}`);
  }
  return raw;
}

async function main() {
  const args = parseCliArgs();
  const status = normalizeStatus(args.status || '');
  const limit = args.limit ? Number(args.limit) : 20;
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 20;

  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  qs.set('limit', String(safeLimit));
  const query = qs.toString();

  const response = await orchestratorRequest('GET', `/api/orchestrator/jobs?${query}`);
  const jobs = Array.isArray(response.jobs) ? response.jobs : [];
  if (!jobs.length) {
    console.log('[orchestrator] no jobs');
    return;
  }

  for (const job of jobs) {
    console.log(`${job.id}\t${job.status}\t${job.updatedAt}\t${job.request}`);
  }
}

main().catch((error) => {
  console.error('[orchestrator] list failed:', error && error.message ? error.message : error);
  process.exit(1);
});

