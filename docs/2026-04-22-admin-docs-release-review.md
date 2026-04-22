# ADMIN-DOCS-C, product/release review for future admin docs system

## Scope

This review is for the future admin documentation system that would replace or extend the current static `assets/docs/manifest.json` model.

Current production baseline:
- public docs are served as static files by `server.js`
- frontend reads `/assets/docs/manifest.json` in `scripts/docs-app.js`
- offline state depends on service worker cache and cache lookup
- there is no current admin upload/delete/reorder API in production

So the safest release path is: define rules first, then add admin CRUD only behind strict validation and atomic publish flow.

---

## 1. Top release risks

### 1. Privilege escalation
Risk:
- if admin actions rely only on client UI state or a weak flag, any authenticated user may upload, delete, reorder, or replace docs
- if future endpoints reuse normal user session auth without role checks, admin docs becomes writable by regular users

Required guard:
- every admin docs write endpoint must require authenticated Telegram user plus explicit server-side admin allowlist
- never trust frontend "isAdmin" or hidden buttons
- deny by default, log denied attempts

### 2. Path traversal / arbitrary file write
Risk:
- upload/replace endpoints may accept user-controlled path, filename, or folder values like `../../server.js`
- delete/replace may target arbitrary files outside docs storage

Required guard:
- never accept raw storage path from client as the write target
- server must derive the final path from validated folder key + generated safe filename
- delete/replace must operate by immutable document id, not raw relative path
- validate final resolved path stays inside the docs storage root

### 3. Stale cache / manifest mismatch
Risk:
- file updated but manifest old
- manifest updated but file missing
- service worker keeps stale file while admin already replaced or deleted it
- reorder/delete appears successful for admin but users still see old cached state

Required guard:
- publish docs changes atomically as one revision
- manifest must have a `revision` or `publishedAt` field
- changed files should get content-hash or versioned URLs to bust stale cache
- clients should treat revision mismatch as signal to refresh docs manifest and related download state

### 4. Oversized file / bad MIME / dangerous file type
Risk:
- huge uploads can exhaust storage or make mobile docs UX unusable
- renamed executable or unsupported file type may be published accidentally
- wrong MIME can break preview behavior in `docs-app.js`

Required guard:
- allowlist extensions and MIME pairs
- enforce max size per file and reject oversized uploads before publish
- detect MIME server-side, do not trust browser-provided `type`
- unsupported file types must fail before storage, not after publish

### 5. Destructive content operations without safety rails
Risk:
- deleting last item in a section creates broken empty UX or accidental content loss
- replace existing file may silently break title/path assumptions
- reorder after edits may drop unsaved changes or conflict with stale admin state

Required guard:
- explicit confirmations for delete and replace
- optimistic concurrency with revision checking
- block destructive publish on stale revision
- allow empty section only intentionally, with clear copy

---

## 2. Product rules for future admin docs

### Content model recommendation
Use a server-owned model like:
- `id`: immutable UUID
- `section`: one of `speeds`, `folders`, `instructions`, `memos`, `reminders`
- `title`: required display title
- `subtitle`: optional short secondary line
- `filename`: server-generated safe storage name
- `mimeType`: validated canonical MIME
- `sizeBytes`: validated server-side
- `publishedAt`
- `updatedAt`
- `sortOrder`
- `status`: `active` or `deleted`
- `revision`: manifest revision at publish time

Important:
- keep storage filename separate from display title
- never use display title as primary identity

### Publish model recommendation
Use draft -> validate -> publish, not direct live mutation.

Safe flow:
1. upload file into temporary staging area
2. validate size, mime, extension, title, section, duplicate rules
3. create/update draft item
4. reorder within draft if needed
5. publish a new manifest revision atomically
6. optionally garbage-collect replaced/deleted old files after publish succeeds

This sharply reduces manifest/file drift.

---

## 3. Validation rules

### Section
- allowed values only: `speeds`, `folders`, `instructions`, `memos`, `reminders`
- reject unknown section keys

### Title
- required, trimmed
- length: 1..120 chars
- collapse repeated whitespace
- forbid control characters
- duplicate rule: titles must be unique within one section after trim + casefold normalization
- if duplicate is allowed later, UI must force explicit confirmation and show both files clearly

### Subtitle
- optional
- max 160 chars

### File
- required for create
- optional for metadata-only edit
- max size recommendation for v1 admin release:
  - PDF/DOCX/images: hard cap 25 MB
  - recommend warning at 10 MB
- allowed extensions and MIME pairs:
  - `.pdf` -> `application/pdf`
  - `.docx` -> `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - `.jpg` / `.jpeg` -> `image/jpeg`
  - `.png` -> `image/png`
- reject mismatched extension/MIME
- reject empty files

### Storage path
- never accepted from user
- generated by server as `{section}/{safe-slug-or-id}{ext}` or content hash path
- resolved path must remain inside docs asset root

### Reorder
- reorder payload should contain ordered list of item ids plus expected revision
- reject if ids are missing, duplicated, or belong to another section
- reject if expected revision is stale

### Replace existing file
- preserve item id and sort order
- if file changes, update size, mime, updatedAt, revision
- old file should not be deleted until new publish succeeds

### Delete
- delete by item id + expected revision
- confirm whether this is the last item in section
- if last item deletion is allowed, UI must show that the section becomes empty for users
- if product wants at least one item per section, block it server-side

---

## 4. Edge cases to explicitly support

### Offline admin
Expected behavior:
- admin panel should be read-only or unavailable offline
- show clear message that publishing changes requires internet
- do not allow fake-success local edits that will vanish

Recommended copy:
- `Нет соединения. Управление документами доступно только онлайн.`

### Oversized file
Expected behavior:
- reject before upload completes if possible
- otherwise reject on server with exact limit in message

Recommended copy:
- `Файл слишком большой. Допустимый размер до 25 МБ.`

### Bad MIME / unsupported format
Recommended copy:
- `Этот формат пока не поддерживается. Загрузите PDF, DOCX, JPG или PNG.`

### Duplicate title
Recommended copy:
- `В этом разделе уже есть документ с таким названием. Измените название или замените существующий файл.`

### Delete last item in section
Recommended copy:
- `Это последний документ в разделе. После удаления раздел будет пуст.`

### Replace existing file
Recommended copy:
- `Файл будет заменён, ссылка в разделе сохранится.`

### Reorder after edits / stale admin tab
Recommended copy:
- `Список уже изменился в другой сессии. Обновите раздел и повторите действие.`

### Manifest/file mismatch detected on publish
Recommended copy:
- `Не удалось опубликовать изменения целиком. Документы не обновлены. Повторите попытку.`

### Public client sees stale cache after publish
Recommended copy for user docs screen if needed later:
- `Документы обновились. Потяните экран вниз или откройте раздел ещё раз.`

---

## 5. Security notes for implementation

1. Separate admin auth from normal docs read access.
2. Keep writes on the server only.
3. Do not expose filesystem paths to client payloads.
4. Use atomic file writes for manifest/revision metadata.
5. Prefer append-only audit log for admin actions:
   - who uploaded
   - who deleted
   - who reordered
   - old revision
   - new revision
6. Sanitize file names for storage, but preserve original title as metadata only.
7. Never serve draft files publicly before publish.
8. For delete/replace, use tombstone or delayed cleanup until publish succeeds.

---

## 6. Migration path from current manifest-only model

### Current state
Today production docs are effectively:
- static files in `assets/docs/*`
- static manifest at `assets/docs/manifest.json`
- frontend reads manifest and opens files directly by path

### Recommended migration, low-risk

#### Phase 1, schema hardening without admin UI
- extend manifest shape with stable `id`, `title`, `subtitle`, `mime_type`, `size`, `updated_at`, `revision`
- keep existing static serving and current reader compatible
- verify `scripts/docs-app.js` tolerates both old and new fields

#### Phase 2, server-managed manifest build
- introduce internal server-side source-of-truth JSON or data file
- generate public manifest from that source on publish
- keep public client still reading manifest only

#### Phase 3, admin draft flow
- add authenticated admin-only draft endpoints for create/update/delete/reorder
- publish emits new manifest revision and copies validated assets into public docs storage

#### Phase 4, cache-busting and cleanup
- switch docs asset URLs to revisioned or hashed paths
- add client-side refresh hook when manifest revision changes
- clean old replaced files after successful rollout window

This path preserves the current frontend contract while moving admin complexity server-side.

---

## 7. Verification checklist before release

### Auth and authorization
- [ ] regular authenticated user cannot open admin write endpoints
- [ ] unauthenticated user gets 401/403 on admin endpoints
- [ ] admin allowlist is enforced server-side
- [ ] denied writes are logged without leaking secrets

### Validation
- [ ] reject unknown section
- [ ] reject empty title
- [ ] reject duplicate title in same section
- [ ] reject unsupported extension
- [ ] reject mismatched MIME/extension
- [ ] reject oversized file
- [ ] reject empty file
- [ ] reject reorder payload with duplicate or foreign ids
- [ ] reject stale expected revision

### File safety
- [ ] upload cannot write outside docs storage root
- [ ] replace cannot overwrite arbitrary file paths
- [ ] delete cannot target arbitrary file paths
- [ ] publish leaves no partial manifest write on failure

### Product behavior
- [ ] offline admin mode shows clear blocked state
- [ ] delete last item confirmation is clear
- [ ] replace flow preserves item identity and order
- [ ] reorder persists after refresh
- [ ] metadata-only edit does not break file preview
- [ ] public docs screen still renders empty section state correctly

### Cache and publish
- [ ] published revision changes after every successful docs mutation batch
- [ ] manifest and files stay in sync after replace/delete/reorder
- [ ] stale client can recover by refresh without broken links
- [ ] service worker does not keep deleted/replaced file as the only truth forever

### Regression checks
- [ ] current public docs screen still opens PDF
- [ ] DOCX preview still works
- [ ] image preview still works
- [ ] offline downloaded docs still open when expected
- [ ] non-docs app shell behavior is unchanged

---

## 8. Manual pre-prod checks I recommend

1. Test admin writes with a non-admin Telegram account.
2. Try path traversal payloads in title, filename, section, and id fields.
3. Publish replace + reorder in two browser sessions at once to confirm stale revision handling.
4. Replace a file, then open it from:
   - fresh browser
   - installed PWA
   - stale cached session
5. Delete a file that was previously downloaded offline and confirm the user experience is understandable.
6. Verify manifest revision and actual file set match on disk after each publish.
7. Simulate interrupted publish and ensure public manifest is still valid.

---

## Recommendation

Do not ship admin docs as direct live edits to `assets/docs/manifest.json` from the client.

Best safe v1:
- server-side admin allowlist
- draft + revisioned publish
- immutable item ids
- server-generated storage paths
- strict MIME/size/title validation
- explicit stale revision checks

That keeps the current public docs contract stable while avoiding the biggest release and security risks.
