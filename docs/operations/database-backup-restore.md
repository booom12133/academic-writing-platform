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
BACKUP_OUTPUT_PATH=/secure/backups/academic-writing-platform.dump npm run db:backup
```

The wrapper invokes the PostgreSQL-maintained `pg_dump` tool. It does not encrypt, upload, rotate, or otherwise replace the deployment's backup system. Protect the output path and database credentials according to the deployment policy.

## Restore and verify

Restore only into an explicitly selected recovery target. The command requires the explicit `--confirm-restore` flag through the npm script:

```bash
DATABASE_URL=postgresql://... \
BACKUP_INPUT_PATH=/secure/backups/academic-writing-platform.dump \
npm run db:restore:verify -- --confirm-restore
```

The wrapper invokes `pg_restore` and then `psql` to verify the `vector` extension, the required application tables, and the expected migration count. Test restores should use an isolated database; restoring over a live application database requires an approved maintenance procedure.

Filesystem document storage is a separate backup concern. The standalone persistent volume must be covered by the same deployment backup policy; independent disks on multiple application nodes are unsupported in P1.
