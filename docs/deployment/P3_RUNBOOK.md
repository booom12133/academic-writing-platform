# P3 Deployment Runbook

This runbook is for the approved single-node production deployment of
academic-writing-platform at https://write.yingrenji.cn.

## Command contexts

- A: implementation worktree or CI. This context may use npm scripts, Jest,
  Playwright, and the complete source checkout.
- B: the exact production release app at
  /opt/academic-writing-platform/current/app. Production database operations
  run the three shipped Node scripts directly.
- C: production host OS or PostgreSQL administrative tooling.

Production ECS must not depend on a full source checkout, Jest, test files,
fixtures, devDependencies, the repository scripts directory, or npm run db:*
commands.

## Release contract

Each release is immutable and has this layout:

    /opt/academic-writing-platform/releases/<commit-sha>/
      app/
        server/
        dist/
        node_modules/
        package.json
        run.sh
        scripts/
          db-migrate.js
          db-backup.js
          db-restore-verify.js
        drizzle/
          migrations/
      deploy/
        pm2/
        nginx/
        scripts/
      release-manifest.sha256

The app artifact and deployment metadata come from the same reviewed commit.
Only the three named scripts may exist directly under app/scripts. The exact
four migration files are copied into app/drizzle/migrations and are included
in the release hash evidence.

## Protected environment

The file /etc/academic-writing-platform/production.env is outside Git and all
release artifacts. It is owned by academic-writing:academic-writing, mode 600,
and never printed or logged. Node 22 loads it through the fixed
--env-file argument in the PM2 configuration. A missing, unreadable, malformed,
or unsafe file fails closed before the application serves traffic.

Replace the file atomically with mode 600 during rotation, then run PM2 reload
with --update-env as the academic-writing user. Verify PM2 status and live/ready
health using redacted output only.

## Database operations

From the current B release app:

    cd /opt/academic-writing-platform/current/app
    node --env-file=/etc/academic-writing-platform/production.env scripts/db-migrate.js
    BACKUP_OUTPUT_PATH=/var/backups/academic-writing-platform/<timestamp>.dump node --env-file=/etc/academic-writing-platform/production.env scripts/db-backup.js
    BACKUP_INPUT_PATH=/var/backups/academic-writing-platform/<dump>.dump node --env-file=/etc/academic-writing-platform/production.env scripts/db-restore-verify.js --confirm-restore

The protected environment provides DATABASE_SSL_CA_FILE,
PGSSLMODE=verify-full, and PGSSLROOTCERT=/etc/academic-writing-platform/postgres-ca.pem.
Node connections use the trusted CA with rejectUnauthorized=true. libpq
connections used by pg_dump, pg_restore, and psql use verify-full. Never use
sslmode=require alone or disable certificate verification.

Restore only into an isolated recovery database. Never restore destructively
over the live database.

## Boot recovery

Create the dedicated academic-writing service user with a stable HOME and Node
or PM2 PATH. Run PM2 startup for systemd, execute its exact privileged command,
enable pm2-academic-writing.service, start the validated single fork, and run
pm2 save as academic-writing. pm2 save alone is not the boot contract.

Before the single approved ECS reboot, record a backup hash, representative DB
state, persistent document hash, rollback release, enabled PostgreSQL/Nginx/
PM2 units, and health status. After reboot verify PostgreSQL, Nginx, PM2, Node,
health/live, health/ready, DB state, and document hash. If recovery fails, stop
and preserve evidence; do not run repeated reboot experiments.
