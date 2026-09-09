#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: rollback.sh <previous-commit-sha>" >&2
  exit 2
fi

previous_sha="$1"
previous_root="/opt/academic-writing-platform/releases/$previous_sha"
test -d "$previous_root/app"
test -d "$previous_root/deploy"
test -s "$previous_root/release-manifest.sha256"

sudo ln -sfn "$previous_root" /opt/academic-writing-platform/current
sudo -u academic-writing -H env HOME=/home/academic-writing \
  PATH=/usr/local/bin:/usr/bin:/home/academic-writing/.local/bin \
  pm2 reload academic-writing-platform --update-env
"$(dirname "$0")/verify-live.sh"
