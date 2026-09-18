# PostgreSQL backup and restore baseline

The standalone runtime uses PostgreSQL as the source of truth. Database schema changes are a release operation and are not performed by application startup.

## Migration release operation

Set `MIGRATION_DATABASE_URL` to a migration-scoped PostgreSQL principal when it is available. The runner falls back to `DATABASE_URL` for local and simple deployments.

```bash
npm run db:migrate
```

The runner acquires a PostgreSQL advisory lock, applies the ordered files in `drizzle/migrations`, releases the lock, and exits non-zero on failure. A failed migration must block application rollout.

## Backup

Create a custom-format dump before an upgrade or destructive recovery operation:

```bash
BACKUP_DATABASE_URL=postgresql://academic_writing_backup:...@db.example/live \
BACKUP_OUTPUT_PATH=/secure/backups/academic-writing-platform.dump \
BACKUP_EVIDENCE_PATH=/secure/evidence/backup.json \
npm run db:backup
```

The wrapper reads only `BACKUP_DATABASE_URL`, which authenticates the dedicated
read-only `academic_writing_backup` role. Set `BACKUP_EVIDENCE_PATH` to a
protected receipt path; a successful run records a sanitized database identity,
size, and SHA-256 without printing credentials. The wrapper invokes the
PostgreSQL-maintained `pg_dump` tool. It does not encrypt, upload, rotate, or
otherwise replace the deployment's backup system.

## Restore and verify

Restore only into an explicitly selected recovery target. The command requires
a distinct `RESTORE_DATABASE_URL`, an exact database-name confirmation, and
the explicit `--confirm-isolated-restore` flag:

```bash
DATABASE_URL=postgresql://academic_writing_app:...@db.example/live \
RESTORE_DATABASE_URL=postgresql://operator:...@db.example/isolated_recovery \
RESTORE_DATABASE_NAME_CONFIRM=isolated_recovery \
BACKUP_INPUT_PATH=/secure/backups/academic-writing-platform.dump \
RESTORE_EVIDENCE_PATH=/secure/evidence/isolated-restore.json \
npm run db:restore:verify -- --confirm-isolated-restore
```

Before spawning `pg_restore`, the wrapper compares sanitized host/port/database
identities and fails if the target is live or does not match the confirmation.
It then verifies `vector`, required tables, current database, and the unchanged
migration count. Do not run migrations on the recovery database.

Real rollback remains separately gated by
`PRODUCTION_ROLLBACK_AUTHORIZED=YES`, a Controller-reviewed target SHA, and
matching protected backup/isolated-restore receipts. Rollback never reverses a
database migration.

Filesystem document storage is a separate backup concern. The standalone persistent volume must be covered by the same deployment backup policy; independent disks on multiple application nodes are unsupported in P1.
