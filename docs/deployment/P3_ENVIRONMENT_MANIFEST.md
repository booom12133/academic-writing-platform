# P3 Environment Manifest

This file names production configuration only. Secret values are provisioned
outside Git into /etc/academic-writing-platform/production.env with owner
academic-writing:academic-writing and mode 600.

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
    DATABASE_SSL_CA_FILE=/etc/academic-writing-platform/postgres-ca.pem
    PGSSLMODE=verify-full
    PGSSLROOTCERT=/etc/academic-writing-platform/postgres-ca.pem
    DATABASE_POOL_MAX=5
    DATABASE_IDLE_TIMEOUT_MS=10000
    DATABASE_CONNECTION_TIMEOUT_MS=5000

The displayed password markers are placeholders, not credentials. The database
hostname must match the PostgreSQL certificate SAN. Node uses the trusted CA
and rejectUnauthorized=true. pg_dump, pg_restore, and psql require libpq
verify-full with PGSSLROOTCERT.

## Auth0 public configuration

    OIDC_ISSUER_URL=https://<auth0-domain>/
    OIDC_JWKS_URL=https://<auth0-domain>/.well-known/jwks.json
    OIDC_AUDIENCE=https://academic-writing-platform/api
    OIDC_USER_ID_CLAIM=sub
    OIDC_ALLOWED_ALGORITHMS=RS256
    OIDC_REDIRECT_URI=https://write.yingrenji.cn/auth/callback
    OIDC_LOGOUT_REDIRECT_URI=https://write.yingrenji.cn/login

The Auth0 tenant domain and client ID are supplied by the operator. A SPA
client secret is never required or bundled.

## Provider identity

    EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
    EMBEDDING_MODEL=BAAI/bge-m3
    EMBEDDING_DIMENSIONS=1024

Provider API keys, encryption keys, cursor secrets, and database passwords are
confidential and must not appear in this document, release files, frontend
bundles, logs, screenshots, fixtures, or Playwright artifacts.
