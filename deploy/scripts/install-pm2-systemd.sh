#!/usr/bin/env bash
set -euo pipefail

pm2_home="/var/lib/academic-writing-platform/pm2"
service_user="academic-writing"
service_group="academic-writing"
service_home="/nonexistent"
service_shell="/usr/sbin/nologin"
service_name="pm2-academic-writing.service"
unit_path="/etc/systemd/system/$service_name"
pm2_path="/usr/local/bin:/usr/bin"
contract_script="$(dirname "$0")/pm2-systemd-contract.js"

fail() {
  echo "PM2 systemd installation failed: $*" >&2
  exit 1
}

cleanup_invalid_startup() {
  if systemctl disable "$service_name" >/dev/null 2>&1; then
    echo "cleanup_disable=success"
  else
    echo "cleanup_disable=failure"
  fi

  if [ -e "$unit_path" ] || [ -L "$unit_path" ]; then
    if rm -f -- "$unit_path"; then
      echo "cleanup_unit=removed"
    else
      echo "cleanup_unit=removal-failure"
      return 1
    fi
  else
    echo "cleanup_unit=absent"
  fi

  if systemctl daemon-reload >/dev/null 2>&1; then
    echo "cleanup_daemon_reload=success"
  else
    echo "cleanup_daemon_reload=failure"
    return 1
  fi

  enabled_state="$(systemctl is-enabled "$service_name" 2>/dev/null || true)"
  case "$enabled_state" in
    enabled|enabled-runtime|linked|linked-runtime|alias|indirect)
      echo "cleanup_enabled_state=still-enabled"
      return 1
      ;;
    '')
      echo "cleanup_enabled_state=not-found"
      ;;
    *)
      echo "cleanup_enabled_state=$enabled_state"
      ;;
  esac
}

test "$(id -u)" = "0" || fail "root invocation is required"
test -x "$(command -v node)" || fail "approved Node binary is missing"
test -x "$(command -v systemctl)" || fail "systemctl is missing"

user_entry="$(getent passwd "$service_user" || true)"
test -n "$user_entry" || fail "service user is missing"
IFS=: read -r user_name _ _ user_gid _ user_home user_shell <<< "$user_entry"
test "$user_name" = "$service_user" || fail "service user is incompatible"
test "$user_home" = "$service_home" || fail "service user home must remain $service_home"
test "$user_shell" = "$service_shell" || fail "service user shell must remain $service_shell"
group_entry="$(getent group "$service_group" || true)"
test -n "$group_entry" || fail "service group is missing"
IFS=: read -r group_name _ group_gid _ <<< "$group_entry"
test "$group_name" = "$service_group" || fail "service group is incompatible"
test "$user_gid" = "$group_gid" || fail "service user primary group is incompatible"

test -d "$pm2_home" || fail "PM2 state directory is missing"
test ! -L "$pm2_home" || fail "PM2 state directory must not be a symlink"
test "$(stat -c '%U:%G' "$pm2_home")" = "$service_user:$service_group" ||
  fail "PM2 state directory owner is invalid"
test "$(stat -c '%a' "$pm2_home")" = "700" ||
  fail "PM2 state directory mode must be 700"

pm2_binary="$(PATH="$pm2_path" command -v pm2 || true)"
test -n "$pm2_binary" || fail "approved PM2 binary is missing"
case "$pm2_binary" in
  /usr/bin/pm2|/usr/local/bin/pm2) ;;
  *) fail "PM2 binary is outside the approved system path" ;;
esac
test -x "$pm2_binary" || fail "approved PM2 binary is not executable"

if [ -e "$unit_path" ] || [ -L "$unit_path" ]; then
  existing_unit="$(systemctl cat "$service_name" 2>/dev/null || true)"
  if printf '%s\n' "$existing_unit" |
    node "$contract_script" --verify-unit "$service_name" >/dev/null; then
    echo "PM2 systemd unit already verified"
    exit 0
  fi
  fail "an existing PM2 systemd unit is invalid; refusing to overwrite it"
fi

set +e
env PM2_HOME="$pm2_home" HOME=/root PATH="$pm2_path" \
  "$pm2_binary" startup systemd -u "$service_user"
startup_status=$?
set -e
if [ "$startup_status" -ne 0 ]; then
  cleanup_invalid_startup || fail "startup failed and cleanup was incomplete"
  fail "PM2 startup command failed"
fi

if ! unit_text="$(systemctl cat "$service_name" 2>/dev/null)"; then
  cleanup_invalid_startup || fail "generated unit is missing and cleanup was incomplete"
  fail "generated systemd unit is missing"
fi

if ! printf '%s\n' "$unit_text" |
  node "$contract_script" --verify-unit "$service_name" >/dev/null; then
  cleanup_invalid_startup || fail "invalid generated unit cleanup was incomplete"
  fail "generated systemd unit does not match the frozen PM2 contract"
fi

echo "PM2 systemd unit verified"
echo "service=$service_name"
echo "user=$service_user"
echo "pm2_home=$pm2_home"
echo "pid_file=$pm2_home/pm2.pid"
