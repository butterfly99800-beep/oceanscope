# Existing database: nullable final ETA

This release permits an unpublished final-destination ETA to remain NULL. Cargo availability and sea-port ETA are never substituted for final ETA.

## Upgrade

Use `deploy/update-code-only.sh FULL_COMMIT_SHA --nullable-eta` as root. The optional flag allows only `20261115090000_nullable_schedule_eta` and its schema change. The script builds the release first, verifies every existing migration checksum, dumps the selected OceanScope database into the private deployment backup directory, checks dump completion, and then runs the single pending migration. A missing migration, checksum mismatch, unexpected column, failed dump, or additional schema change stops publication. Do not resolve migration history or alter existing data to bypass these checks.

A compatible `mysqldump` must be available. For a loopback database, the helper can use the dump client in the uniquely matching official MySQL Docker container without changing that container. The database user needs permission to dump the database and alter this column. Credentials come from the existing environment file and are not printed.

The migration changes only `sailingschedule.eta` from NOT NULL to NULL. It does not reset, seed, delete rows, reimport ports, change worker settings, or touch SSH tunnels. A full backup can exceed the usual code-build free-space allowance; ensure sufficient space for both before deploying. Failed backups stop before migration.

## Rollback boundary

Previous code and configuration are retained. Failed startup restores the previous code automatically. The nullable database change is intentionally NOT reversed. Once new schedules with NULL ETA have been saved, code that requires a non-null ETA may not read them. Use an ETA-compatible release or a forward code fix; never fill invented dates, drop rows, or automatically restore an old database backup over newer data.

OOCL desktop schedules use a new snapshot format to preserve distinct onward routes. Existing older rows remain stored but are excluded from current-format results until a live refresh succeeds. Keep the local worker and browser connector available during refresh.
