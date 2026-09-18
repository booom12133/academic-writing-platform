# PostgreSQL backup and restore baseline

The standalone runtime uses PostgreSQL as the source of truth. Database schema changes are a release operation and are not performed by application startup.

## Migration release operation

Set `MIGRATION_DATABASE_URL` to a migration-scoped PostgreSQL principal when it is available. The runner falls back to `DATABASE_URL` for local and simple deployments.

```bash
npm run db:migrate
```

The runner acquires a PostgreSQL advisory lock, applies the ordered files in `drizzle/migrations`, releases the lock, and exits non-zero on failure. A failed migration must block application rollout.

## Backup

Create a custom-format dump before an upgrade or destructive recovery operation.
Production backup execution is root-controlled so the dump and PASS receipt are
compatible with the rollback preflight ownership contract. Prepare the protected
directory once, then run the shipped script from the immutable current release:

```bash
sudo install -d -o root -g root -m 700 /var/backups/academic-writing-platform
sudo env BACKUP_OUTPUT_PATH=/var/backups/academic-writing-platform/<timestamp>.dump BACKUP_EVIDENCE_PATH=/var/backups/academic-writing-platform/<timestamp>.backup.receipt.json node --env-file=/etc/academic-writing-platform/production.env /opt/academic-writing-platform/current/app/scripts/db-backup.js
```

The wrapper reads only `BACKUP_DATABASE_URL`, which authenticates the dedicated
read-only `academic_writing_backup` role from the protected production env. Set
`BACKUP_EVIDENCE_PATH` to a protected receipt path; a successful root execution
produces a root-owned mode `0600` dump and receipt and records a sanitized
database identity, size, and SHA-256 without printing credentials. The wrapper
invokes the PostgreSQL-maintained `pg_dump` tool. It does not encrypt, upload,
rotate, or otherwise replace the deployment's backup system.

## Restore and verify

Restore only into an explicitly selected recovery target. Stage the recovery URL
and exact database-name confirmation in a root-only input file; never place the
recovery credential in command history or output:

```bash
sudo install -d -o root -g root -m 700 /etc/academic-writing-platform/recovery-input
sudo install -o root -g root -m 600 /dev/null /etc/academic-writing-platform/recovery-input/restore.env
sudoedit /etc/academic-writing-platform/recovery-input/restore.env
# The editor receives exactly RESTORE_DATABASE_URL=<isolated-target-url>
# and RESTORE_DATABASE_NAME_CONFIRM=<exact-isolated-database-name>.
sudo env BACKUP_INPUT_PATH=/var/backups/academic-writing-platform/<timestamp>.dump RESTORE_EVIDENCE_PATH=/var/backups/academic-writing-platform/<timestamp>.restore.receipt.json node --env-file=/etc/academic-writing-platform/production.env --env-file=/etc/academic-writing-platform/recovery-input/restore.env /opt/academic-writing-platform/current/app/scripts/db-restore-verify.js --confirm-isolated-restore
```

Before spawning `pg_restore`, the wrapper compares sanitized host/port/database
identities and fails if the target is live or does not match the confirmation.
It then verifies `vector`, required tables, current database, and the unchanged
migration count. Root execution creates the restore PASS receipt as a root-owned
mode `0600` file. Preserve the receipt, then remove the root-only recovery input
file. Do not run migrations on the recovery database.

The backup dump, backup receipt, and isolated-restore receipt supplied to a later
rollback preflight must each remain regular, non-symlink, root-owned mode `0600`
files. These commands prepare evidence only; they do not authorize rollback.

Real rollback remains separately gated by
`PRODUCTION_ROLLBACK_AUTHORIZED=YES`, a Controller-reviewed target SHA, and
matching protected backup/isolated-restore receipts. Rollback never reverses a
database migration.

Filesystem document storage is a separate backup concern. The standalone persistent volume must be covered by the same deployment backup policy; independent disks on multiple application nodes are unsupported in P1.
