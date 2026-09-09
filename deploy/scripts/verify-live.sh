#!/usr/bin/env bash
set -euo pipefail

base_url="https://write.yingrenji.cn"
configured_base_url="$(printenv P3_BASE_URL || true)"
if [ -n "$configured_base_url" ]; then
  base_url="$configured_base_url"
fi

curl --fail --silent --show-error "$base_url/health/live"
curl --fail --silent --show-error "$base_url/health/ready"
sudo -u academic-writing -H env HOME=/home/academic-writing \
  PATH=/usr/local/bin:/usr/bin:/home/academic-writing/.local/bin \
  pm2 status
sudo systemctl is-active postgresql nginx pm2-academic-writing.service
