#!/usr/bin/env bash
set -euo pipefail

state_parent="/var/lib/academic-writing-platform"
state_root="/var/lib/academic-writing-platform/pm2"
service_user="academic-writing"
service_group="academic-writing"
service_home="/nonexistent"
service_shell="/usr/sbin/nologin"

fail() {
  echo "PM2 state preparation failed: $*" >&2
  exit 1
}

group_entry="$(getent group "$service_group" || true)"
user_entry="$(getent passwd "$service_user" || true)"
test -n "$group_entry" || fail "service group is missing"
test -n "$user_entry" || fail "service user is missing"

IFS=: read -r group_name _ group_gid _ <<< "$group_entry"
IFS=: read -r user_name _ user_uid user_gid _ user_home user_shell <<< "$user_entry"
test "$group_name" = "$service_group" || fail "service group is incompatible"
test "$user_name" = "$service_user" || fail "service user is incompatible"
test "$user_gid" = "$group_gid" || fail "service user primary group is incompatible"
test "$user_home" = "$service_home" || fail "service user home must remain $service_home"
test "$user_shell" = "$service_shell" || fail "service user shell must remain $service_shell"

sudo install -d -o "$service_user" -g "$service_group" -m 700 "$state_parent"
sudo install -d -o "$service_user" -g "$service_group" -m 700 "$state_root"

echo "PM2 state prepared"
echo "root=$state_root"
echo "owner=$service_user:$service_group"
echo "mode=700"
