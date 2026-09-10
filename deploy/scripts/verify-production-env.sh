#!/usr/bin/env bash
set -euo pipefail

env_file="/etc/academic-writing-platform/production.env"
app_root="/opt/academic-writing-platform/current/app"
mode="target"
if [ "$#" -ge 1 ]; then env_file="$1"; fi
if [ "$#" -ge 2 ]; then app_root="$2"; fi
if [ "$#" -ge 3 ]; then mode="$3"; fi
env_dir="/etc/academic-writing-platform"
rotation_marker="$env_dir/secret-rotation-complete"
service_user="academic-writing"
expected_owner="root:academic-writing"
expected_mode="640"

fail() {
  echo "production environment validation failed: $*" >&2
  exit 1
}

test "${P3_SECURITY_SECRET_ROTATION_REQUIRED:-}" = "YES" ||
  fail "P3_SECURITY_SECRET_ROTATION_REQUIRED=YES is required"
test "$mode" = "target" || test "$mode" = "candidate" ||
  fail "mode must be target or candidate"
test -f "$env_file" || fail "production env file is missing"
test ! -L "$env_file" || fail "production env file must not be a symlink"
test "$(stat -c '%U:%G' "$env_file")" = "$expected_owner" ||
  fail "production env owner must be $expected_owner"
test "$(stat -c '%a' "$env_file")" = "$expected_mode" ||
  fail "production env mode must be $expected_mode"
test -d "$env_dir" || fail "production env directory is missing"
test ! -L "$env_dir" || fail "production env directory must not be a symlink"
test "$(stat -c '%U:%G' "$env_dir")" = "root:root" ||
  fail "production env directory owner must be root:root"
test "$(stat -c '%a' "$env_dir")" = "755" ||
  fail "production env directory mode must be 755"

if ! awk -F= '
  /^[[:space:]]*(#|$)/ { next }
  /^[A-Za-z_][A-Za-z0-9_]*=/ {
    key = $1
    if (++seen[key] > 1) exit 10
    next
  }
  { exit 11 }
' "$env_file"; then
  fail "env file has duplicate keys or invalid lines"
fi

for key in NODE_ENV RUNTIME_PROFILE SERVER_HOST SERVER_PORT DATABASE_URL \
  MIGRATION_DATABASE_URL DOCUMENT_STORAGE_ROOT DATABASE_SSL_CA_FILE \
  PGSSLMODE PGSSLROOTCERT OIDC_PROVIDER OIDC_CLIENT_ID OIDC_ISSUER_URL \
  OIDC_JWKS_URL OIDC_AUDIENCE OIDC_USER_ID_CLAIM OIDC_ALLOWED_ALGORITHMS \
  OIDC_REDIRECT_URI OIDC_POST_LOGOUT_REDIRECT_URI DEEPSEEK_API_KEY \
  DEEPSEEK_DEFAULT_MODEL EMBEDDING_BASE_URL EMBEDDING_API_KEY EMBEDDING_MODEL \
  EMBEDDING_DIMENSIONS EMBEDDING_TIMEOUT_MS ACADEMIC_SEARCH_CURSOR_SECRET \
  ZOTERO_API_BASE_URL ZOTERO_CREDENTIAL_ENCRYPTION_KEY \
  ZOTERO_CREDENTIAL_ENCRYPTION_KEY_VERSION; do
  grep -Eq "^[[:space:]]*${key}=" "$env_file" ||
    fail "required env key is missing: $key"
done

test "$(grep -E '^NODE_ENV=' "$env_file" | tail -n 1)" = "NODE_ENV=production" ||
  fail "NODE_ENV must be production"
test "$(grep -E '^RUNTIME_PROFILE=' "$env_file" | tail -n 1)" = "RUNTIME_PROFILE=standalone" ||
  fail "RUNTIME_PROFILE must be standalone"
test "$(grep -E '^SERVER_HOST=' "$env_file" | tail -n 1)" = "SERVER_HOST=127.0.0.1" ||
  fail "SERVER_HOST must be loopback"
test "$(grep -E '^SERVER_PORT=' "$env_file" | tail -n 1)" = "SERVER_PORT=3000" ||
  fail "SERVER_PORT must be 3000"

test -d "$app_root" || fail "production app root is missing"
test -f "$app_root/server/config/production-config.js" ||
  fail "compiled production config is missing"
test -r "$env_file" || fail "production env file is not readable"

validation_output="$(mktemp)"
trap 'rm -f -- "$validation_output"' EXIT
if ! (
  cd "$app_root"
  sudo -u "$service_user" -- env -i \
    HOME=/nonexistent \
    PATH=/usr/local/bin:/usr/bin \
    node --env-file="$env_file" -e \
    "const { loadRuntimeConfig } = require('./server/config/production-config.js'); loadRuntimeConfig();"
) >"/dev/null" 2>"$validation_output"; then
  fail "production config validation failed"
fi

if [ "$mode" = "target" ]; then
  test -f "$rotation_marker" || fail "secret rotation completion marker is missing"
  test ! -L "$rotation_marker" || fail "secret rotation marker must not be a symlink"
  test "$(stat -c '%U:%G' "$rotation_marker")" = "root:root" ||
    fail "secret rotation marker owner must be root:root"
  test "$(stat -c '%a' "$rotation_marker")" = "600" ||
    fail "secret rotation marker mode must be 600"
fi

echo "production environment validated"
echo "path=$env_file"
echo "owner=$expected_owner"
echo "mode=$expected_mode"
