#!/usr/bin/env bash
set -euo pipefail

pm2_home="/var/lib/academic-writing-platform/pm2"
service_user="academic-writing"
service_group="academic-writing"
rotation_marker="/etc/academic-writing-platform/secret-rotation-complete"
pm2_path="/usr/local/bin:/usr/bin"

fail() {
  echo "PM2 command blocked: $*" >&2
  exit 1
}

enter_pm2_safe_cwd() {
  cd / || fail "cannot enter the deterministic PM2 working directory"
}

main() {
  test "${P3_SECURITY_SECRET_ROTATION_REQUIRED:-}" = "YES" ||
    fail "P3_SECURITY_SECRET_ROTATION_REQUIRED=YES is required"
  test -f "$rotation_marker" ||
    fail "secret rotation completion marker is missing"
  test ! -L "$rotation_marker" || fail "secret rotation marker must not be a symlink"
  test "$(stat -c '%U:%G' "$rotation_marker")" = "root:root" ||
    fail "secret rotation marker owner must be root:root"
  test "$(stat -c '%a' "$rotation_marker")" = "600" ||
    fail "secret rotation marker mode must be 600"
  test -d "$pm2_home" || fail "PM2 state directory is missing"
  test ! -L "$pm2_home" || fail "PM2 state directory must not be a symlink"
  test "$(stat -c '%U:%G' "$pm2_home")" = "$service_user:$service_group" ||
    fail "PM2 state directory owner is invalid"
  test "$(stat -c '%a' "$pm2_home")" = "700" ||
    fail "PM2 state directory mode must be 700"
  test "$#" -gt 0 || fail "a PM2 command is required"
  test "$1" != "startup" ||
    fail "startup installation must use install-pm2-systemd.sh as root"

  enter_pm2_safe_cwd
  exec sudo -u "$service_user" -- env -i \
    HOME=/nonexistent \
    PATH="$pm2_path" \
    PM2_HOME="$pm2_home" \
    P3_SECURITY_SECRET_ROTATION_REQUIRED=YES \
    pm2 "$@"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
