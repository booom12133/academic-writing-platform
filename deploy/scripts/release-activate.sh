#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: release-activate.sh <commit-sha>" >&2
  exit 2
fi

release_sha="$1"
release_root="/opt/academic-writing-platform/releases/$release_sha"
manifest_script="$(dirname "$0")/release-manifest.js"
test -d "$release_root/app"
test -d "$release_root/deploy"
test -s "$release_root/release-manifest.sha256"
test -f "$release_root/app/scripts/db-migrate.js"
test -d "$release_root/app/drizzle/migrations"
test "$(stat -c '%U:%G' "$release_root")" = "root:academic-writing"
test "$(stat -c '%U:%G' "$release_root/app")" = "root:academic-writing"
test "$(stat -c '%U:%G' "$release_root/deploy")" = "root:academic-writing"
test "$(stat -c '%U:%G' "$release_root/release-manifest.sha256")" = "root:root"
test "$(stat -c '%a' "$release_root/release-manifest.sha256")" = "640"
test -z "$(find "$release_root/app" "$release_root/deploy" -perm /022 -print -quit)"
sudo node "$manifest_script" "$release_root" >/dev/null

sudo ln -sfn "$release_root" /opt/academic-writing-platform/current
readlink -f /opt/academic-writing-platform/current
