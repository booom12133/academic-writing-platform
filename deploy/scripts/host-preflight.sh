#!/usr/bin/env bash
set -u

echo "P3 host read-only preflight"

probe() {
  local label="$1"
  local command_name="$2"
  shift 2

  if command -v "$command_name" >/dev/null 2>&1; then
    echo "[$label]"
    "$command_name" "$@" 2>&1 || echo "$label=UNAVAILABLE"
  else
    echo "$label=NOT_FOUND"
  fi
}

probe hostname hostname
probe uname uname -a

if command -v lsb_release >/dev/null 2>&1; then
  echo "[ubuntu-version]"
  lsb_release -a 2>&1 || echo "ubuntu-version=UNAVAILABLE"
elif [ -r /etc/os-release ]; then
  echo "[ubuntu-version]"
  grep -E '^(PRETTY_NAME|NAME|VERSION|VERSION_ID)=' /etc/os-release 2>&1 || \
    echo "ubuntu-version=UNAVAILABLE"
else
  echo "ubuntu-version=NOT_FOUND"
fi

probe node node --version
probe npm npm --version
probe psql psql --version
probe pg_dump pg_dump --version
probe pg_restore pg_restore --version
probe nginx nginx -v
probe pm2 pm2 --version
probe disk df -hT
probe memory free -h

if command -v ss >/dev/null 2>&1; then
  echo "[listeners]"
  ss -ltnp 2>&1 || echo "listeners=UNAVAILABLE"
  echo "[target-listeners]"
  ss -ltnp 2>/dev/null | grep -E ':(22|80|443|2222|3000|5432)\b' || \
    echo "target-listeners=NONE"
else
  echo "listeners=NOT_FOUND"
  echo "target-listeners=NOT_FOUND"
fi

if command -v ufw >/dev/null 2>&1; then
  echo "[ufw]"
  if command -v sudo >/dev/null 2>&1; then
    sudo -n ufw status verbose 2>&1 || ufw status verbose 2>&1 || \
      echo "ufw=UNAVAILABLE"
  else
    ufw status verbose 2>&1 || echo "ufw=UNAVAILABLE"
  fi
elif command -v firewall-cmd >/dev/null 2>&1; then
  echo "[firewalld]"
  if command -v sudo >/dev/null 2>&1; then
    sudo -n firewall-cmd --state 2>&1 || firewall-cmd --state 2>&1 || \
      echo "firewalld=UNAVAILABLE"
    sudo -n firewall-cmd --list-all 2>&1 || firewall-cmd --list-all 2>&1 || true
  else
    firewall-cmd --state 2>&1 || echo "firewalld=UNAVAILABLE"
    firewall-cmd --list-all 2>&1 || true
  fi
else
  echo "firewall=NOT_FOUND"
fi

if command -v systemctl >/dev/null 2>&1; then
  for service in postgresql postgresql@16-main nginx pm2-academic-writing.service; do
    echo "[systemd $service]"
    systemctl is-enabled "$service" 2>&1 || echo "enabled=NOT_FOUND_OR_DISABLED"
    systemctl is-active "$service" 2>&1 || echo "active=NOT_FOUND_OR_INACTIVE"
  done
else
  echo "systemd=NOT_FOUND"
fi
