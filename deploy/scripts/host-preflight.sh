#!/usr/bin/env bash
set -euo pipefail

echo "P3 host read-only preflight"
hostname
uname -a
lsb_release -a
node --version
npm --version
df -hT
free -h
ss -ltnp
sudo ufw status verbose
sudo ss -ltnp | grep -E ':(22|80|443|2222|3000|5432)\b' || true
sudo systemctl is-enabled postgresql nginx pm2-academic-writing.service || true
