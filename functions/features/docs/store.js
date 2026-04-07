async function ensureDocsSchema(db) {
  await db.prepare([
    'CREATE TABLE IF NOT EXISTS docs_files (',
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  folder TEXT NOT NULL,',
    '  name TEXT NOT NULL,',
    '  file_id TEXT NOT NULL,',
    '  file_unique_id TEXT NOT NULL DEFAULT \'\',',
    '  mime_type TEXT NOT NULL DEFAULT \'\',',
    '  file_size INTEGER NOT NULL DEFAULT 0,',
    '  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,',
    '  uploaded_by TEXT NOT NULL',
    ')'
  ].join('\n')).run();
}

export async function listDocFiles(db, folder) {
  await ensureDocsSchema(db);
  var result = await db.prepare(
    'SELECT id, folder, name, file_id, mime_type, file_size, uploaded_at ' +
    'FROM docs_files WHERE folder = ? ORDER BY uploaded_at DESC'
  ).bind(folder).all();
  return result.results || [];
}

export async function saveDocFile(db, data) {
  await ensureDocsSchema(db);
  var result = await db.prepare(
    'INSERT INTO docs_files (folder, name, file_id, file_unique_id, mime_type, file_size, uploaded_by) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    data.folder,
    data.name,
    data.file_id,
    data.file_unique_id || '',
    data.mime_type || '',
    data.file_size || 0,
    data.uploaded_by
  ).run();
  return result.meta && result.meta.last_row_id;
}

export async function getDocFile(db, id) {
  await ensureDocsSchema(db);
  return await db.prepare(
    'SELECT id, folder, name, file_id, mime_type, file_size, uploaded_at ' +
    'FROM docs_files WHERE id = ? LIMIT 1'
  ).bind(id).first();
}

export async function deleteDocFile(db, id) {
  await ensureDocsSchema(db);
  await db.prepare('DELETE FROM docs_files WHERE id = ?').bind(id).run();
}
