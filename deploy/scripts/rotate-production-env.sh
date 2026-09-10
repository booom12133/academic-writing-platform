#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "usage: rotate-production-env.sh <candidate-env-file> [app-root]" >&2
  exit 2
fi

candidate_file="$1"
app_root="${2:-/opt/academic-writing-platform/current/app}"
env_dir="/etc/academic-writing-platform"
env_file="$env_dir/production.env"
rotation_marker="$env_dir/secret-rotation-complete"
verify_script="$(dirname "$0")/verify-production-env.sh"

fail() {
  echo "production secret rotation blocked: $*" >&2
  exit 1
}

test "${P3_SECURITY_SECRET_ROTATION_REQUIRED:-}" = "YES" ||
  fail "P3_SECURITY_SECRET_ROTATION_REQUIRED=YES is required"
test "$(id -u)" = "0" || fail "rotation must run as root"
test -f "$candidate_file" || fail "candidate env file is missing"
test ! -L "$candidate_file" || fail "candidate env file must not be a symlink"
test -d "$env_dir" || fail "production env directory is missing"
test ! -L "$env_dir" || fail "production env directory must not be a symlink"
test "$(stat -c '%U:%G' "$env_dir")" = "root:root" ||
  fail "production env directory owner must be root:root"
test "$(stat -c '%a' "$env_dir")" = "755" ||
  fail "production env directory mode must be 755"
if [ -e "$env_file" ]; then
  test ! -L "$env_file" || fail "existing production env file must not be a symlink"
fi

read_env_value() {
  local file="$1"
  local key="$2"
  awk -F= -v wanted="$key" '
    $1 == wanted { print substr($0, length(wanted) + 2); found = 1; exit }
    END { if (!found) exit 2 }
  ' "$file" 2>/dev/null || true
}

old_zotero_key=""
if [ -f "$env_file" ]; then
  old_zotero_key="$(read_env_value "$env_file" ZOTERO_CREDENTIAL_ENCRYPTION_KEY)"
fi
new_zotero_key="$(read_env_value "$candidate_file" ZOTERO_CREDENTIAL_ENCRYPTION_KEY)"

for rotated_key in DATABASE_URL MIGRATION_DATABASE_URL \
  ACADEMIC_SEARCH_CURSOR_SECRET ZOTERO_CREDENTIAL_ENCRYPTION_KEY; do
  old_value=""
  if [ -f "$env_file" ]; then
    old_value="$(read_env_value "$env_file" "$rotated_key")"
  fi
  new_value="$(read_env_value "$candidate_file" "$rotated_key")"
  if [ -n "$old_value" ] && [ "$old_value" = "$new_value" ]; then
    fail "$rotated_key must be changed during mandatory rotation"
  fi
done

temp_env="$(mktemp "$env_dir/.production.env.XXXXXX")"
temp_marker=""
cleanup() {
  [ -z "$temp_env" ] || rm -f -- "$temp_env"
  [ -z "$temp_marker" ] || rm -f -- "$temp_marker"
}
trap cleanup EXIT

install -o root -g academic-writing -m 640 "$candidate_file" "$temp_env"
P3_SECURITY_SECRET_ROTATION_REQUIRED=YES \
  "$verify_script" "$temp_env" "$app_root" candidate >/dev/null

if [ "$old_zotero_key" != "$new_zotero_key" ]; then
  zotero_count="$(
    cd "$app_root"
    sudo -u academic-writing -- env -i \
      HOME=/nonexistent \
      PATH=/usr/local/bin:/usr/bin \
      node --env-file="$temp_env" -e '
        const { Client } = require("pg");
        const client = new Client({
          connectionString: process.env.DATABASE_URL,
          ssl: {
            ca: require("node:fs").readFileSync(process.env.DATABASE_SSL_CA_FILE, "utf8"),
            rejectUnauthorized: true,
          },
        });
        (async () => {
          try {
            await client.connect();
            const result = await client.query("SELECT count(*)::int AS count FROM zotero_connections");
            process.stdout.write(String(result.rows[0].count));
          } catch {
            process.exitCode = 42;
          } finally {
            await client.end().catch(() => undefined);
          }
        })();
      ' 2>/dev/null
  )" || fail "Zotero database safety check failed; controller review required"
  test "$zotero_count" = "0" ||
    fail "encrypted Zotero credentials exist; controller review required"
fi

mv -f -- "$temp_env" "$env_file"
temp_env=""

temp_marker="$(mktemp "$env_dir/.secret-rotation-complete.XXXXXX")"
printf 'rotation-complete=YES\n' > "$temp_marker"
chown root:root "$temp_marker"
chmod 600 "$temp_marker"
mv -f -- "$temp_marker" "$rotation_marker"
temp_marker=""

echo "production secrets rotated atomically"
echo "env_path=$env_file"
echo "rotation_marker=$rotation_marker"
