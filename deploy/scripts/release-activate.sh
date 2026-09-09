#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: release-activate.sh <commit-sha>" >&2
  exit 2
fi

release_sha="$1"
release_root="/opt/academic-writing-platform/releases/$release_sha"
test -d "$release_root/app"
test -d "$release_root/deploy"
test -s "$release_root/release-manifest.sha256"
test -f "$release_root/app/scripts/db-migrate.js"
test -d "$release_root/app/drizzle/migrations"

sudo ln -sfn "$release_root" /opt/academic-writing-platform/current
readlink -f /opt/academic-writing-platform/current
