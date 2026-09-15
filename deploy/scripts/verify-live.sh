#!/usr/bin/env bash
set -euo pipefail

base_url="https://write.yingrenji.cn"
configured_base_url="$(printenv P3_BASE_URL || true)"
if [ -n "$configured_base_url" ]; then
  base_url="$configured_base_url"
fi

fail_activation_check() {
  printf '%s\n' "$1" >&2
  exit 1
}

P3_SECURITY_SECRET_ROTATION_REQUIRED=YES \
  "$(dirname "$0")/pm2-service-cli.sh" status >/dev/null \
  || fail_activation_check P3_ACTIVATION_CHECK_FAILED:pm2
sudo systemctl is-active --quiet postgresql nginx pm2-academic-writing.service \
  || fail_activation_check P3_ACTIVATION_CHECK_FAILED:systemd
curl --fail --silent --show-error "$base_url/health/live" >/dev/null \
  || fail_activation_check P3_ACTIVATION_CHECK_FAILED:live
curl --fail --silent --show-error "$base_url/health/ready" >/dev/null \
  || fail_activation_check P3_ACTIVATION_CHECK_FAILED:ready
