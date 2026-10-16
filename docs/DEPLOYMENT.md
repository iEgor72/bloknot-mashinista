# Production deployment

Current origin is `klyuchik-ru1` (201.51.30.200). The historical Amsterdam/PM2
instructions are obsolete. Connect using the existing SSH alias and strict host
key verification. Never read or print environment files or secret webhook routes.

The runtime is systemd `bloknot-mashinista.service`, user `bloknot`, Node 22,
working directory `/opt/bloknot-mashinista/current`. Releases are Git archives in
`/opt/bloknot-mashinista/releases/<full-published-commit>`, with no Git repository
on production. Persistent SQLite lives in `/var/lib/bloknot-mashinista`; its
backups belong in the `backups` subdirectory. Environment is managed separately.

Before deployment verify a clean intended code diff, branch/upstream and that
the exact commit has been published to GitHub main. Build using `npm run build`
from `release.json`, then run `build:check`, `typecheck`, `test:ui-preservation`,
`test:journal`, `test:server`, `test:pwa`, `vu45:test`, `test:audit-ui`,
`smoke:sw-update`, `smoke:local` and `smoke:offline`.

Upload `git archive` plus its SHA-256 and verify the digest before extraction.
Create a new release directory; never overwrite an existing one. Dependencies
may be reused only after the complete dependency graph in package-lock matches
the prior release (application version metadata is allowed to differ). Otherwise
install with `npm ci --omit=dev` within the new release.

Before changing the active symlink, create a consistent SQLite backup via the
SQLite backup API and require `PRAGMA quick_check` to return `ok`. Keep the old
release target. Set ownership, atomically replace `current` through a temporary
symlink and restart only `bloknot-mashinista.service`. On a failed startup/health
check, switch back to the prior target and restart the same service.

Check service activity, public HTML/versioned scripts/module MIME types, public
API authentication, offline shell cache regression, and the non-sensitive local
health verifier `/usr/local/sbin/verify-bloknot-ru`. Record commit, backup path and
results in project memory. Do not restore a database just to roll back code;
that would discard changes made after the backup. Data restoration is a separate
explicit operation and requires stopping this systemd service first.

Schema migration 7 adds per-account journal revisions. Existing production may
retain migration 5 from a reverted community release; migration numbers must
never be reused. Old clients without `baseRevision` receive HTTP 428 and retain
their local queue until updated. Browser migration copies v1 queue bytes into
the account's IndexedDB transaction before removing that exact v1 pending key.
Conflicting versions remain local until explicitly resolved. Never clear browser
storage as an update procedure.
