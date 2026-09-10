#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: rotate-production-env.sh <candidate-env-file> <app-root> <INITIAL_COMPROMISE_ROTATION|NORMAL_FUTURE_ROTATION>" >&2
  exit 2
fi

candidate_file="$1"
app_root="$2"
rotation_mode="$3"
env_dir="/etc/academic-writing-platform"
env_file="$env_dir/production.env"
rotation_marker="$env_dir/secret-rotation-complete"
script_dir="$(dirname "$0")"
verify_script="$script_dir/verify-production-env.sh"
rotation_contract="$script_dir/rotation-contract.js"
role_rotation_script="$script_dir/rotate-postgres-roles.js"
candidate_contract="$script_dir/candidate-input-contract.js"

fail() {
  echo "production secret rotation blocked: $*" >&2
  exit 1
}

test "${P3_SECURITY_SECRET_ROTATION_REQUIRED:-}" = "YES" ||
  fail "P3_SECURITY_SECRET_ROTATION_REQUIRED=YES is required"
test "$(id -u)" = "0" || fail "rotation must run as root"
test -f "$candidate_file" || fail "candidate env file is missing"
node "$candidate_contract" "$candidate_file" >/dev/null ||
  fail "candidate env file staging contract failed"
test -d "$env_dir" || fail "production env directory is missing"
test ! -L "$env_dir" || fail "production env directory must not be a symlink"
test "$(stat -c '%U:%G' "$env_dir")" = "root:root" ||
  fail "production env directory owner must be root:root"
test "$(stat -c '%a' "$env_dir")" = "755" ||
  fail "production env directory mode must be 755"

case "$rotation_mode" in
  INITIAL_COMPROMISE_ROTATION)
    test ! -e "$rotation_marker" ||
      fail "initial compromise rotation has already completed"
    ;;
  NORMAL_FUTURE_ROTATION)
    test -f "$rotation_marker" ||
      fail "normal future rotation requires the initial completion marker"
    test ! -L "$rotation_marker" || fail "rotation marker must not be a symlink"
    test "$(stat -c '%U:%G' "$rotation_marker")" = "root:root" ||
      fail "rotation marker owner must be root:root"
    test "$(stat -c '%a' "$rotation_marker")" = "600" ||
      fail "rotation marker mode must be 600"
    ;;
  *)
    fail "rotation mode is invalid"
    ;;
esac

plan_output="$(node "$rotation_contract" "$env_file" "$candidate_file" "$rotation_mode")" ||
  fail "rotation contract validation failed"
roles_to_rotate="$(printf '%s\n' "$plan_output" | sed -n 's/^roles_to_rotate=//p')"
zotero_key_changed="$(printf '%s\n' "$plan_output" | sed -n 's/^zotero_key_changed=//p')"

temp_env="$(mktemp "$env_dir/.production.env.XXXXXX")"
temp_marker=""
admin_password=""
cleanup() {
  [ -z "$temp_env" ] || rm -f -- "$temp_env"
  [ -z "$temp_marker" ] || rm -f -- "$temp_marker"
  unset P3_DB_ADMIN_PASSWORD
}
trap cleanup EXIT

install -o root -g academic-writing -m 640 "$candidate_file" "$temp_env"
P3_SECURITY_SECRET_ROTATION_REQUIRED=YES \
  "$verify_script" "$temp_env" "$app_root" candidate >/dev/null

if [ -n "$roles_to_rotate" ] || [ "$zotero_key_changed" = "YES" ]; then
  test -n "${P3_DB_ADMIN_URL:-}" ||
    fail "P3_DB_ADMIN_URL is required and must not contain a password"
  test -r /dev/tty || fail "interactive administrative credential input is required"
  printf 'PostgreSQL administrative password (input hidden): ' >/dev/tty
  IFS= read -r -s admin_password </dev/tty || fail "administrative credential input failed"
  printf '\n' >/dev/tty
  export P3_DB_ADMIN_PASSWORD="$admin_password"
  unset admin_password
fi

if ! (
  cd "$app_root"
  node --env-file="$temp_env" "$role_rotation_script" "$env_file" "$rotation_mode"
); then
  fail "database role rotation or new credential connectivity validation failed"
fi
unset P3_DB_ADMIN_PASSWORD

mv -f -- "$temp_env" "$env_file"
temp_env=""

if [ "$rotation_mode" = "INITIAL_COMPROMISE_ROTATION" ]; then
  temp_marker="$(mktemp "$env_dir/.secret-rotation-complete.XXXXXX")"
  printf 'rotation-complete=YES\n' > "$temp_marker"
  chown root:root "$temp_marker"
  chmod 600 "$temp_marker"
  mv -f -- "$temp_marker" "$rotation_marker"
  temp_marker=""
fi

if ! rm -f -- "$candidate_file" || [ -e "$candidate_file" ]; then
  fail "candidate source cleanup failed"
fi

echo "production secrets rotated atomically"
echo "rotation_mode=$rotation_mode"
echo "env_path=$env_file"
echo "candidate_cleanup=deleted"
if [ "$rotation_mode" = "INITIAL_COMPROMISE_ROTATION" ]; then
  echo "rotation_marker=$rotation_marker"
fi
