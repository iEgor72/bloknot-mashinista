#!/usr/bin/env node
'use strict';

const { orchestratorRequest, parseCliArgs } = require('./client');

function normalizeText(value) {
  return String(value || '').trim();
}

async function main() {
  const args = parseCliArgs();
  const request = normalizeText(args.request || args.task || args.text);
  if (!request) {
    throw new Error('Provide --request "..."');
  }

  const payload = {
    request,
    source: normalizeText(args.source || 'cli'),
    chatId: normalizeText(args.chatId || ''),
    telegramId: normalizeText(args.telegramId || ''),
    username: normalizeText(args.username || ''),
    fullName: normalizeText(args.fullName || ''),
  };

  const response = await orchestratorRequest('POST', '/api/orchestrator/jobs', payload);
  if (!response || !response.job) {
    throw new Error('Unexpected response: missing job');
  }

  const job = response.job;
  console.log(`[orchestrator] created ${job.id} (${job.status})`);
  console.log(job.request);
}

main().catch((error) => {
  console.error('[orchestrator] create failed:', error && error.message ? error.message : error);
  process.exit(1);
});

