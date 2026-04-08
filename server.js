const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(ROOT, 'data');
const USERS_DIR = path.join(DATA_DIR, 'local-shifts');
const USER_STATS_FILE = path.join(DATA_DIR, 'user-presence.json');
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_DIR)) {
    fs.mkdirSync(USERS_DIR, { recursive: true });
  }
}

function normalizeSid(rawSid) {
  const sid = String(rawSid || 'default').trim();
  const safe = sid.replace(/[^a-zA-Z0-9_-]/g, '_');
  return safe.length > 0 ? safe : 'default';
}

function getUserFile(sid) {
  ensureDirs();
  return path.join(USERS_DIR, `${normalizeSid(sid)}.json`);
}

function readShifts(sid) {
  const file = getUserFile(sid);
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function writeShifts(sid, shifts) {
  const file = getUserFile(sid);
  const sanitized = Array.isArray(shifts)
    ? shifts.map(shift => {
        const copy = {};
        Object.keys(shift || {}).forEach(key => {
          if (key === 'pending') return;
          copy[key] = shift[key];
        });
        return copy;
      })
    : [];
  fs.writeFileSync(file, JSON.stringify(sanitized, null, 2), 'utf8');
}

function isValidDeviceId(rawDeviceId) {
  return typeof rawDeviceId === 'string' && /^[a-z0-9_-]{12,64}$/i.test(rawDeviceId);
}

function sanitizeUserPresenceStore(rawStore) {
  const source = rawStore && typeof rawStore === 'object' ? rawStore : {};
  const sourceDevices = source.devices && typeof source.devices === 'object' ? source.devices : {};
  const devices = {};
  Object.keys(sourceDevices).forEach(deviceId => {
    if (!isValidDeviceId(deviceId)) return;
    const row = sourceDevices[deviceId] || {};
    const firstSeenAt = typeof row.firstSeenAt === 'string' ? row.firstSeenAt : '';
    const lastSeenAt = typeof row.lastSeenAt === 'string' ? row.lastSeenAt : '';
    if (!lastSeenAt) return;
    devices[deviceId] = {
      firstSeenAt: firstSeenAt || lastSeenAt,
      lastSeenAt: lastSeenAt,
    };
  });
  return { devices };
}

function readUserPresenceStore() {
  ensureDirs();
  try {
    if (!fs.existsSync(USER_STATS_FILE)) {
      return { devices: {} };
    }
    const raw = fs.readFileSync(USER_STATS_FILE, 'utf8');
    const parsed = raw ? JSON.parse(raw) : {};
    return sanitizeUserPresenceStore(parsed);
  } catch (err) {
    return { devices: {} };
  }
}

function writeUserPresenceStore(store) {
  ensureDirs();
  const sanitized = sanitizeUserPresenceStore(store);
  fs.writeFileSync(USER_STATS_FILE, JSON.stringify(sanitized, null, 2), 'utf8');
}

function buildUserPresenceStats(store) {
  const nowMs = Date.now();
  const devices = (store && store.devices) || {};
  const ids = Object.keys(devices);
  let onlineUsers = 0;
  ids.forEach(deviceId => {
    const row = devices[deviceId] || {};
    const seenMs = Date.parse(row.lastSeenAt || '');
    if (Number.isFinite(seenMs) && nowMs - seenMs <= ONLINE_WINDOW_MS) {
      onlineUsers += 1;
    }
  });
  return {
    totalUsers: ids.length,
    onlineUsers,
    onlineWindowSeconds: Math.floor(ONLINE_WINDOW_MS / 1000),
    updatedAt: new Date().toISOString(),
  };
}

function readUserPresenceStats() {
  return buildUserPresenceStats(readUserPresenceStore());
}

function touchUserPresence(deviceId) {
  const store = readUserPresenceStore();
  const nowIso = new Date().toISOString();
  const existing = store.devices[deviceId];
  store.devices[deviceId] = {
    firstSeenAt: existing && typeof existing.firstSeenAt === 'string' && existing.firstSeenAt ? existing.firstSeenAt : nowIso,
    lastSeenAt: nowIso,
  };
  writeUserPresenceStore(store);
  return buildUserPresenceStats(store);
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendText(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    'Content-Type': contentType || 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, 'Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };

  res.writeHead(200, {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(filePath).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname || '/';
  const sid = normalizeSid(parsedUrl.query && parsedUrl.query.sid);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/shifts') {
    if (req.method === 'GET') {
      sendJson(res, 200, { sid, shifts: readShifts(sid) });
      return;
    }

    if (req.method === 'PUT') {
      try {
        const body = await readBody(req);
        const payload = body ? JSON.parse(body) : {};
        const shifts = Array.isArray(payload.shifts) ? payload.shifts : null;
        if (!shifts) {
          sendJson(res, 400, { error: 'Expected { shifts: [] }' });
          return;
        }

        writeShifts(sid, shifts);
        sendJson(res, 200, { ok: true, sid, shifts });
      } catch (err) {
        sendJson(res, 400, { error: err.message || 'Invalid payload' });
      }
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (pathname === '/api/stats') {
    if (req.method === 'GET') {
      sendJson(res, 200, readUserPresenceStats());
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await readBody(req);
        const payload = body ? JSON.parse(body) : {};
        const deviceId = typeof payload.deviceId === 'string' ? payload.deviceId.trim() : '';
        if (!isValidDeviceId(deviceId)) {
          sendJson(res, 400, { error: 'Invalid deviceId' });
          return;
        }
        sendJson(res, 200, touchUserPresence(deviceId));
      } catch (err) {
        sendJson(res, 400, { error: err.message || 'Invalid payload' });
      }
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const normalized = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const filePath = path.join(ROOT, normalized);

  if (!filePath.startsWith(ROOT)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Shift tracker server listening on http://localhost:${PORT}`);
});
