#!/usr/bin/env node
'use strict';

function parseCliArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const payload = token.slice(2);
    const eq = payload.indexOf('=');
    if (eq !== -1) {
      args[payload.slice(0, eq)] = payload.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[payload] = true;
      continue;
    }
    args[payload] = next;
    i += 1;
  }
  return args;
}

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function getBaseUrl() {
  return String(process.env.ORCHESTRATOR_BASE_URL || 'https://bloknot-mashinista-bot.ru').trim().replace(/\/+$/, '');
}

async function orchestratorRequest(method, path, body) {
  const key = requireEnv('ORCHESTRATOR_API_KEY');
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'x-orchestrator-key': key,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = { ok: false, error: 'invalid-json-response' };
  }

  if (!response.ok) {
    const reason = payload && payload.error ? payload.error : `HTTP ${response.status}`;
    throw new Error(reason);
  }
  return payload;
}

module.exports = {
  getBaseUrl,
  orchestratorRequest,
  parseCliArgs,
};

