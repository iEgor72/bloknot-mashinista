'use strict';

const fs = require('fs');
const { config } = require('./config');

let cache = {
  loadedAt: 0,
  value: []
};

function normalizeProject(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  if (!id) return null;
  return {
    id,
    title: String(raw.title || id).trim(),
    repoPath: String(raw.repoPath || '').trim(),
    vps: raw.vps && typeof raw.vps === 'object'
      ? {
          host: String(raw.vps.host || '').trim(),
          path: String(raw.vps.path || '').trim(),
          process: String(raw.vps.process || '').trim()
        }
      : { host: '', path: '', process: '' },
    rules: Array.isArray(raw.rules) ? raw.rules.map((line) => String(line || '').trim()).filter(Boolean) : []
  };
}

function loadProjects(force) {
  const now = Date.now();
  if (!force && cache.loadedAt && now - cache.loadedAt < 5000) {
    return cache.value;
  }

  try {
    const raw = fs.readFileSync(config.projectsFile, 'utf8');
    const parsed = raw ? JSON.parse(raw) : {};
    const list = Array.isArray(parsed.projects) ? parsed.projects : [];
    const normalized = list.map(normalizeProject).filter(Boolean);
    cache = { loadedAt: now, value: normalized };
    return normalized;
  } catch (error) {
    cache = { loadedAt: now, value: [] };
    return [];
  }
}

function findProjectById(projectId) {
  const id = String(projectId || '').trim().toLowerCase();
  if (!id) return null;
  return loadProjects().find((project) => project.id.toLowerCase() === id) || null;
}

module.exports = {
  findProjectById,
  loadProjects
};
