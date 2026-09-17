# P3 Deployment Runbook

This runbook is for the approved single-node production deployment of
academic-writing-platform at https://write.yingrenji.cn.

## Command contexts

- A: implementation worktree or CI. This context may use npm scripts, Jest,
  Playwright, and the complete source checkout.
- B: the exact production release app at
  /opt/academic-writing-platform/current/app. Production database operations
  run the four shipped Node scripts directly after the Part A artifact closure
  is implemented.
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
          client/
            index.html
            assets/
        node_modules/
        package.json
        run.sh
        scripts/
          db-migrate.js
          db-backup.js
          db-restore-verify.js
          verify-production-database.js
        drizzle/
          migrations/
      deploy/
        pm2/
        nginx/
        scripts/
      release-manifest.sha256

The app artifact and deployment metadata come from the same reviewed commit.
`app/dist/client` is the one production frontend runtime root used by
`server/main.js`. Every local same-origin JavaScript or stylesheet reference
in `app/dist/client/index.html`, including root-relative `/assets/...` URLs,
must resolve to a regular file below that same root. Hashed Vite filenames are
discovered from the built HTML; they are never hardcoded. The artifact gate
rejects missing references and path traversal, and the startup smoke fetches
`/` plus every discovered local JS/CSS asset, requiring JavaScript/CSS MIME
types rather than the SPA `text/html` fallback.
Only the four named scripts may exist directly under app/scripts. The exact
four migration files are copied into app/drizzle/migrations and are included
in the release hash evidence. Persistent document data is never copied into a
release. release-install.sh, release-activate.sh, and rollback.sh do not
delete, replace, or traverse the persistent document root.

Release installation is root-controlled. The release root and its `app/` and
`deploy/` trees are owned by `root:academic-writing`; directories are mode
`750`, regular files are mode `640`, and only required shell entrypoints are
owner/group executable. The runtime group has no write permission. The
`release-manifest.sha256` file is owned by `root:root`, mode `640`, and covers
every regular file below `app/` and `deploy/`. The release manifest helper
rejects symlinks, path traversal, missing files, extra files, duplicate
entries, and digest mismatches.

`current = offline selected release` and
`current != deployment accepted`. `release-activate.sh` may change the
`current` symlink before database gates because it starts no Node/PM2 process.

The first deployment command sequence is frozen as follows. It verifies the
installed release before changing `current`, performs the initial compromise
rotation before any Node or PM2 process, migrates and verifies the production
database, and only then prepares and activates PM2:

    sudo node deploy/scripts/first-deploy.js <full-commit-sha> dist deploy

    sudo deploy/scripts/release-install.sh <commit-sha> dist deploy
    sudo node /opt/academic-writing-platform/releases/<commit-sha>/deploy/scripts/release-manifest.js /opt/academic-writing-platform/releases/<commit-sha>
    sudo /opt/academic-writing-platform/releases/<commit-sha>/deploy/scripts/release-activate.sh <commit-sha>
    sudo env P3_SECURITY_SECRET_ROTATION_REQUIRED=YES P3_DB_ADMIN_URL='postgresql://rotation-admin@db.example/academic_writing' /opt/academic-writing-platform/current/deploy/scripts/rotate-production-env.sh /etc/academic-writing-platform/rotation-input/production.env /opt/academic-writing-platform/current/app INITIAL_COMPROMISE_ROTATION
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES /opt/academic-writing-platform/current/deploy/scripts/verify-production-env.sh /etc/academic-writing-platform/production.env /opt/academic-writing-platform/current/app
    cd /opt/academic-writing-platform/current/app
    sudo node --env-file=/etc/academic-writing-platform/production.env scripts/db-migrate.js
    sudo node --env-file=/etc/academic-writing-platform/production.env scripts/verify-production-database.js
    sudo /opt/academic-writing-platform/current/deploy/scripts/prepare-pm2-state.sh
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES /opt/academic-writing-platform/current/deploy/scripts/pm2-service-cli.sh start /opt/academic-writing-platform/current/deploy/pm2/ecosystem.config.cjs --only academic-writing-platform
    sudo /opt/academic-writing-platform/current/deploy/scripts/install-pm2-systemd.sh
    # The root-only helper executes env PM2_HOME=/var/lib/academic-writing-platform/pm2 pm2 startup systemd -u academic-writing.
    sudo systemctl cat pm2-academic-writing.service
    sudo systemctl is-enabled pm2-academic-writing.service
    sudo node /opt/academic-writing-platform/current/deploy/scripts/pm2-systemd-handoff.js
    # The handoff requires an inactive service, then runs pm2-service-cli.sh save,
    # pm2-service-cli.sh kill, systemctl reset-failed, and systemctl start in that order.
    sudo systemctl show pm2-academic-writing.service --property=ActiveState --property=SubState --property=Result --property=ControlGroup
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES /opt/academic-writing-platform/current/deploy/scripts/verify-live.sh
    # verify-live.sh gates /health/live before /health/ready.
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES /opt/academic-writing-platform/current/deploy/scripts/pm2-service-cli.sh status
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES /opt/academic-writing-platform/current/deploy/scripts/pm2-service-cli.sh describe academic-writing-platform

The admin/bootstrap process executes
`deploy/postgres/production-role-grants.sql` as the only grants source; this
Runbook does not copy its SQL. Any migration or pre-start database verification
failure stops before PM2 preparation and first start. Part A activation ends at
successful PM2/systemd, `/health/live`, and `/health/ready` gates.
`/health/providers` is not a Part A activation gate; later provider acceptance
uses the existing OIDC/NeedLogin authentication contract. There is no automatic
migration rollback after any later PM2, systemd, live, or ready failure.

`deploy/scripts/first-deploy.js` is the executable owner of the exact commands
listed above. It accepts only the reviewed full commit SHA and artifact paths;
secret input remains in the protected env/hidden TTY boundaries. It stops on
the first failed step, performs no automatic database or release rollback, and
prints only `P3_PART_A_ACTIVATION_PASS` after `verify-live.sh` has completed
PM2/systemd, `/health/live`, and `/health/ready`. The activation result is not
deployment acceptance and the helper never calls `/health/providers`.

`systemctl cat` must show `User=academic-writing`,
`Environment=PM2_HOME=/var/lib/academic-writing-platform/pm2`, and
`PIDFile=/var/lib/academic-writing-platform/pm2/pm2.pid`. PM2 startup may enable the generated service; `install-pm2-systemd.sh` performs startup
installation as root and parses the generated `pm2-academic-writing.service`
immediately. On mismatch its cleanup disables the service, removes the unit, reloads
systemd, verifies the service is no longer enabled, and exits non-zero. It is
not run through `pm2-service-cli.sh`, and it never uses `--hp`.
The manually created first-start daemon is never adopted by systemd.
`pm2-systemd-handoff.js` first saves the reviewed process list, cleanly kills
that session-owned daemon, resets any prior failed unit state, and only then
starts `pm2-academic-writing.service`, which resurrects the saved list inside
`ControlGroup=/system.slice/pm2-academic-writing.service`. Success requires
`ActiveState=active`, `SubState=running`, `Result=success`, the exact system
control group, and a reachable PM2 status. A pre-existing active service,
failed save/kill/reset/start, lingering PM2 PID file, or mismatched systemd
state stops activation.
`release-activate.sh` and `rollback.sh` both fail closed if their selected
release manifest or release ownership contract does not verify.

## Persistent document filesystem

The only production document storage root is:

    /var/lib/academic-writing-platform/documents

It is outside `/opt/academic-writing-platform/releases/<commit-sha>`, the
`/opt/academic-writing-platform/current` symlink, temporary directories, and
the source checkout. The future PM2 runtime identity is the dedicated
`academic-writing:academic-writing` user/group defined by the deployment
design. Do not substitute another identity.

The WP3 host preparation is idempotent and establishes the dedicated
operating-system identity. If the identity is absent, create exactly one
system group and one system user with no interactive login and no normal user
home directory. If either already exists, verify compatibility and never
recreate, renumber, or modify it destructively. The approved procedure is
`deploy/scripts/prepare-storage.sh`:

    sudo /path/to/prepare-storage.sh

When absent, that script runs `groupadd --system academic-writing`, then
`useradd --system --gid academic-writing --no-create-home
--home-dir /nonexistent --shell /usr/sbin/nologin academic-writing`. It then
creates both `/var/lib/academic-writing-platform` and
`/var/lib/academic-writing-platform/documents` with owner
`academic-writing:academic-writing` and mode `700`. An incompatible existing
identity causes a non-zero failure before any account is altered. WP6 must
reuse this identity and must not create a second account.

After provisioning, verify the directory without displaying document names or
contents:

    sudo /path/to/verify-storage.sh

The resulting directory must be owned by `academic-writing:academic-writing`
with mode `700`; it must not be world-writable or group-readable. The checked
deployment helper `deploy/scripts/verify-storage.sh` additionally rejects a
symlink or a path resolving under a release, current, or temporary directory.
It prints only path, owner, mode, and capacity metadata, never document names
or contents.

The application receives `DOCUMENT_STORAGE_DRIVER=filesystem` and the exact
`DOCUMENT_STORAGE_ROOT=/var/lib/academic-writing-platform/documents` from the
protected environment. Missing, relative, public, or otherwise invalid
production storage configuration fails closed. The production artifact
contains no persistent user documents; releases and rollback preserve this
root.

## Protected environment

The directory /etc/academic-writing-platform is root:root mode 755. The file
/etc/academic-writing-platform/production.env is outside Git and all release
artifacts, owned by root:academic-writing, mode 640. The academic-writing
runtime can read it through its group but cannot replace it. It is never
printed or logged. Node 22 loads it through the fixed --env-file argument in
the PM2 configuration. A missing, unreadable, malformed, or unsafe file fails
closed before the application serves traffic.

Before the first production Node or PM2 startup, set the hard gate
P3_SECURITY_SECRET_ROTATION_REQUIRED=YES and rotate the previously exposed
DATABASE_URL, MIGRATION_DATABASE_URL, ACADEMIC_SEARCH_CURSOR_SECRET, and
ZOTERO_CREDENTIAL_ENCRYPTION_KEY values with the root-only atomic helper:

    sudo install -d -o root -g root -m 755 /etc/academic-writing-platform
    sudo install -d -o root -g root -m 700 /etc/academic-writing-platform/rotation-input
    sudo install -o root -g root -m 600 <operator-source-production.env> /etc/academic-writing-platform/rotation-input/production.env
    sudo env P3_SECURITY_SECRET_ROTATION_REQUIRED=YES P3_DB_ADMIN_URL='postgresql://rotation-admin@db.example/academic_writing' /opt/academic-writing-platform/current/deploy/scripts/rotate-production-env.sh /etc/academic-writing-platform/rotation-input/production.env /opt/academic-writing-platform/current/app INITIAL_COMPROMISE_ROTATION
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES /opt/academic-writing-platform/current/deploy/scripts/verify-production-env.sh /etc/academic-writing-platform/production.env /opt/academic-writing-platform/current/app

The candidate staging directory is `root:root` mode `700`; the candidate is a
regular `root:root` mode `0600` file directly beneath it, never a symlink, and
never a path under a release, `current`, document storage, PM2_HOME, web root,
`/tmp`, or another shared temporary directory. The helper validates this
contract before reading candidate values. On successful atomic replacement and
marker completion, the candidate source is deleted. On failure it is retained
only under the same root-only `0600` contract and must be removed by the
operator before retry after preserving any required recovery evidence.

The initial helper changes the existing PostgreSQL role passwords for
`academic_writing_app` and `academic_writing_migrator`, then validates both
new credentials over verified TLS. It accepts `P3_DB_ADMIN_URL` only without a
password and receives it as a non-secret environment input; it reads the
administrative password through hidden `/dev/tty` input. It rejects
`P3_DB_ADMIN_PASSWORD` in the candidate production.env, records role name plus
rotation/connectivity status only, and compares each database password
component rather than relying on whole-URL changes. The helper
validates duplicate keys, production configuration, Node 22 env-file
consumption, runtime readability, and exact ownership/modes without printing
values. It atomically replaces the target and creates the root:root mode-600
`secret-rotation-complete` marker only after every initial check succeeds. If
the Zotero key changes, it checks `zotero_connections` before any role
mutation; any existing encrypted credential or unavailable check stops the
operation with a Controller-review error. A failed check never permits the key
rotation. Future changes must use the explicit
`NORMAL_FUTURE_ROTATION` mode, which rotates only changed secret classes and
requires the existing initial marker. Follow future rotations by the
controlled PM2 reload below. Verify PM2 status and live/ready health using
redacted output only.

## Database operations

From the current B release app:

    cd /opt/academic-writing-platform/current/app
    node --env-file=/etc/academic-writing-platform/production.env scripts/db-migrate.js
    node --env-file=/etc/academic-writing-platform/production.env scripts/verify-production-database.js
    BACKUP_OUTPUT_PATH=/var/backups/academic-writing-platform/<timestamp>.dump node --env-file=/etc/academic-writing-platform/production.env scripts/db-backup.js
    BACKUP_INPUT_PATH=/var/backups/academic-writing-platform/<dump>.dump node --env-file=/etc/academic-writing-platform/production.env scripts/db-restore-verify.js --confirm-restore

The protected environment provides DATABASE_SSL_CA_FILE,
PGSSLMODE=verify-full, and PGSSLROOTCERT=/etc/academic-writing-platform/postgres-ca.pem.
`DATABASE_URL` and `MIGRATION_DATABASE_URL` contain no `ssl`, `sslmode`,
`sslcert`, `sslkey`, or `sslrootcert` query parameters. Node connections use
`DATABASE_SSL_CA_FILE` (or `DATABASE_SSL_CA`) as the explicit trusted CA with
`rejectUnauthorized=true`. libpq connections used by `pg_dump`, `pg_restore`,
and `psql` use the separate `PGSSLMODE=verify-full` and `PGSSLROOTCERT`
contract. Never mix libpq TLS parameters into a node-postgres URL, use
`sslmode=require` alone, or disable certificate verification.

Restore only into an isolated recovery database. Never restore destructively
over the live database.

Production migration uses `MIGRATION_DATABASE_URL` only; it has no
`DATABASE_URL` fallback. Pre-start verification uses `DATABASE_URL` only as
`academic_writing_app`. Role/schema/grant provisioning must execute the
repository's `deploy/postgres/production-role-grants.sql`; operators must not
copy grants from this Runbook. Migrations are forward-only. Rollback is an
explicit operator action backed by reviewed compatibility evidence and performs
no automatic migration rollback.

### Previous-release compatibility gate

The Controller-approved previous supported release is
`666f40309b42f2c0d44e4fd6ecbcd1e81f869a8d` (`phase-p2-accepted`). Approval of
that SHA is not compatibility evidence and does not authorize a production
rollback. Before any rollback, CI must build that exact commit in a disposable
checkout and prove its `/health/live` and `/health/ready` endpoints return 200
while it uses the application role against the current forward-migrated schema.
Until the Controller reviews that run and records separate operator approval,
the required decision is `STOP / NO ROLLBACK`.

## Boot recovery

Use the dedicated `academic-writing` identity established by WP3. Its home
remains `/nonexistent` and its shell remains `/usr/sbin/nologin`; do not create
`/home/academic-writing`, recreate the user, or alter passwd metadata. The
canonical PM2 state is `/var/lib/academic-writing-platform/pm2`, owned by
`academic-writing:academic-writing`, mode `700`, outside all releases and the
`current` symlink. Prepare it once. On the initial deployment, the only
allowed ownership transition is the first-deploy sequence above. After
systemd owns the daemon, use the wrapper for PM2 application operations and
systemctl for the service; do not run the handoff helper again:

    sudo /opt/academic-writing-platform/current/deploy/scripts/prepare-pm2-state.sh
    sudo systemctl cat pm2-academic-writing.service
    sudo systemctl is-enabled pm2-academic-writing.service
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES /opt/academic-writing-platform/current/deploy/scripts/pm2-service-cli.sh reload academic-writing-platform --update-env
    sudo P3_SECURITY_SECRET_ROTATION_REQUIRED=YES /opt/academic-writing-platform/current/deploy/scripts/pm2-service-cli.sh status
    sudo systemctl show pm2-academic-writing.service --property=ActiveState --property=SubState --property=Result --property=ControlGroup

The wrapper first changes to deterministic cwd `/`, then sets
`PM2_HOME=/var/lib/academic-writing-platform/pm2`, `HOME=/nonexistent`, and
the approved system PATH before dropping privileges. It therefore never
inherits an operator-only cwd such as `/home/<operator>`. It refuses to run unless
the rotation gate and root-only completion marker pass. Startup installation
is performed directly as root by `install-pm2-systemd.sh` using
`PM2_HOME=/var/lib/academic-writing-platform/pm2 pm2 startup systemd -u
academic-writing`; it is never run through the service-user wrapper and never
uses `--hp`. The helper verifies the generated unit's User, PM2_HOME, PIDFile,
and exact service name. pm2 save alone is not the boot contract.

Before the single approved ECS reboot, record a backup hash, representative DB
state, persistent document hash, rollback release, enabled PostgreSQL/Nginx/
PM2 units, and health status. After reboot verify PostgreSQL, Nginx, PM2, Node,
health/live, health/ready, DB state, and document hash. If recovery fails, stop
and preserve evidence; do not run repeated reboot experiments.
