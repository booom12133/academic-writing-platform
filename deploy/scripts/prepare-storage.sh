#!/usr/bin/env bash
set -euo pipefail

storage_parent="/var/lib/academic-writing-platform"
storage_root="$storage_parent/documents"
service_user="academic-writing"
service_group="academic-writing"
service_shell="/usr/sbin/nologin"
service_home="/nonexistent"

fail() {
  echo "storage provisioning failed: $*" >&2
  exit 1
}

group_entry="$(getent group "$service_group" || true)"
user_entry="$(getent passwd "$service_user" || true)"

# An existing user without the approved primary group cannot be reconciled
# safely by this idempotent preparation step.
if [ -n "$user_entry" ] && [ -z "$group_entry" ]; then
  fail "existing service user has no approved primary group; refusing to alter it"
fi

if [ -z "$group_entry" ]; then
  sudo groupadd --system "$service_group"
  group_entry="$(getent group "$service_group")"
fi

IFS=: read -r group_name _ group_gid _ <<< "$group_entry"
test "$group_name" = "$service_group" || fail "service group name is incompatible"
[[ "$group_gid" =~ ^[0-9]+$ ]] || fail "service group has an invalid numeric GID"

if [ -z "$user_entry" ]; then
  sudo useradd \
    --system \
    --gid "$service_group" \
    --no-create-home \
    --home-dir "$service_home" \
    --shell "$service_shell" \
    "$service_user"
  user_entry="$(getent passwd "$service_user")"
fi

IFS=: read -r user_name _ user_uid user_gid _ user_home user_shell <<< "$user_entry"
test "$user_name" = "$service_user" || fail "service user name is incompatible"
[[ "$user_uid" =~ ^[0-9]+$ ]] || fail "service user has an invalid numeric UID"
test "$user_gid" = "$group_gid" ||
  fail "existing service user primary GID is not $group_gid; refusing to alter it"
test "$user_shell" = "$service_shell" ||
  fail "existing service user shell is not $service_shell; refusing to alter it"
test "$user_home" = "$service_home" ||
  fail "existing service user home is not $service_home; refusing to alter it"
test ! -e "$service_home" ||
  fail "service home path exists; refusing to remove or replace it"

sudo install -d -o "$service_user" -g "$service_group" -m 700 "$storage_parent"
sudo install -d -o "$service_user" -g "$service_group" -m 700 "$storage_root"

echo "persistent storage provisioned"
echo "root=$storage_root"
echo "owner=$service_user:$service_group"
echo "mode=700"
