#!/usr/bin/env bash
set -euo pipefail

storage_root="/var/lib/academic-writing-platform/documents"
service_user="academic-writing"
service_group="academic-writing"

fail() {
  echo "storage verification failed: $*" >&2
  exit 1
}

getent passwd "$service_user" >/dev/null ||
  fail "required service user is missing: $service_user"
getent group "$service_group" >/dev/null ||
  fail "required service group is missing: $service_group"

test -d "$storage_root" || fail "storage root is missing: $storage_root"
test ! -L "$storage_root" || fail "storage root must not be a symlink"

resolved_root="$(readlink -f -- "$storage_root")"
test "$resolved_root" = "$storage_root" ||
  fail "storage root does not resolve to the canonical path"
case "$resolved_root" in
  /opt/academic-writing-platform/releases/*|
  /opt/academic-writing-platform/current|
  /opt/academic-writing-platform/current/*|
  /tmp/*|
  /var/tmp/*)
    fail "storage root is inside a release, current, or temporary directory"
    ;;
esac

owner="$(stat -c '%U:%G' -- "$storage_root")"
mode="$(stat -c '%a' -- "$storage_root")"
test "$owner" = "$service_user:$service_group" ||
  fail "expected owner $service_user:$service_group, found $owner"
test "$mode" = "700" || fail "expected mode 700, found $mode"

sudo -u "$service_user" -- test -r "$storage_root" ||
  fail "service user cannot read the storage root"
sudo -u "$service_user" -- test -w "$storage_root" ||
  fail "service user cannot write the storage root"
sudo -u "$service_user" -- test -x "$storage_root" ||
  fail "service user cannot traverse the storage root"

echo "persistent storage ready"
echo "root=$storage_root"
echo "owner=$owner"
echo "mode=$mode"
df -B1 -- "$storage_root"
