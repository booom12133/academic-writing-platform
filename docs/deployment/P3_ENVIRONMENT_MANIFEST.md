# P3 Environment Manifest

This file names production configuration only. Secret values are provisioned
outside Git into /etc/academic-writing-platform/production.env with owner
root:academic-writing and mode 640. The parent directory is root:root mode
755, so the academic-writing runtime can read the file but cannot replace it.
The first production Node/PM2 startup requires
P3_SECURITY_SECRET_ROTATION_REQUIRED=YES and a root:root mode-600 rotation
completion marker created by the atomic rotation helper.

## Runtime

    NODE_ENV=production
    RUNTIME_PROFILE=standalone
    SERVER_HOST=127.0.0.1
    SERVER_PORT=3000
    DOCUMENT_STORAGE_DRIVER=filesystem
    DOCUMENT_STORAGE_ROOT=/var/lib/academic-writing-platform/documents
    LOG_DIR=/var/log/academic-writing-platform
    LOG_REQUEST_BODY=false
    LOG_RESPONSE_BODY=false

## Database and TLS

    DATABASE_URL=postgresql://academic_writing_app:<password>@db.academic-writing.internal:5432/academic_writing
    MIGRATION_DATABASE_URL=postgresql://academic_writing_migrator:<password>@db.academic-writing.internal:5432/academic_writing
    BACKUP_DATABASE_URL=postgresql://academic_writing_backup:<password>@db.academic-writing.internal:5432/academic_writing
    RESTORE_DATABASE_URL=postgresql://<recovery-operator>:<password>@db.academic-writing.internal:5432/<isolated-recovery-database>
    RESTORE_DATABASE_NAME_CONFIRM=<isolated-recovery-database>
    DATABASE_SSL_CA_FILE=/etc/academic-writing-platform/postgres-ca.pem
    PGSSLMODE=verify-full
    PGSSLROOTCERT=/etc/academic-writing-platform/postgres-ca.pem
    DATABASE_POOL_MAX=5
    DATABASE_IDLE_TIMEOUT_MS=10000
    DATABASE_CONNECTION_TIMEOUT_MS=5000

The displayed password markers are placeholders, not credentials. The database
hostname must match the PostgreSQL certificate SAN. The Node PostgreSQL URLs
must not contain `ssl`, `sslmode`, `sslcert`, `sslkey`, or `sslrootcert` query
parameters. Node uses `DATABASE_SSL_CA_FILE` (or `DATABASE_SSL_CA`) to set the
explicit trusted CA with `rejectUnauthorized=true`. `pg_dump`, `pg_restore`,
and `psql` use the separate libpq contract: `PGSSLMODE=verify-full` with
`PGSSLROOTCERT`. Do not mix libpq TLS parameters into a node-postgres
connection string because they override the explicit Node TLS configuration.

`DATABASE_URL authenticates academic_writing_app` and is used by the runtime
and the read-only `scripts/verify-production-database.js` pre-start gate.
`MIGRATION_DATABASE_URL authenticates academic_writing_migrator` and is used
only by the production migration runner. `production migration has no DATABASE_URL fallback`;
a missing migration URL fails closed before any database connection or PM2
start. Neither URL value may appear in logs or deployment evidence.

`BACKUP_DATABASE_URL` is a read-only operational connection and is never used
by the runtime or migration runner. It is introduced only after canonical
grants create `academic_writing_backup`, through the explicit
`NORMAL_FUTURE_ROTATION --bootstrap-backup-credential` flow. This additive
bootstrap does not change the four-key initial-compromise rotation contract.
`RESTORE_DATABASE_URL` is operator-supplied only for a confirmed isolated
recovery database and must never identify the live database. None of these URL
values may appear in logs or evidence.

## Auth0 public configuration

    OIDC_PROVIDER=Auth0
    OIDC_CLIENT_ID=<registered public SPA client id>
    OIDC_ISSUER_URL=https://<auth0-domain>/
    OIDC_JWKS_URL=https://<auth0-domain>/.well-known/jwks.json
    OIDC_AUDIENCE=https://academic-writing-platform/api
    OIDC_USER_ID_CLAIM=sub
    OIDC_ALLOWED_ALGORITHMS=RS256
    OIDC_REDIRECT_URI=https://write.yingrenji.cn/auth/callback
    OIDC_POST_LOGOUT_REDIRECT_URI=https://write.yingrenji.cn/login

The Auth0 tenant domain and client ID are supplied by the operator. A SPA
client secret is never required or bundled.

## Provider identity

    EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
    EMBEDDING_MODEL=BAAI/bge-m3
    EMBEDDING_DIMENSIONS=1024

Provider API keys, encryption keys, cursor secrets, and database passwords are
confidential and must not appear in this document, release files, frontend
bundles, logs, screenshots, fixtures, or Playwright artifacts.
