#!/usr/bin/env bash
set -euo pipefail

ensure_directory() {
  local target="$1"
  if [ -e "$target" ] || [ -L "$target" ]; then
    test -d "$target" || { echo "ACME webroot path is not a directory: $target" >&2; exit 1; }
    test ! -L "$target" || { echo "ACME webroot path must not be a symlink: $target" >&2; exit 1; }
    test "$(stat -c '%U:%G' "$target")" = "root:root" || { echo "ACME webroot path must be root:root: $target" >&2; exit 1; }
    test "$(stat -c '%a' "$target")" = "755" || { echo "ACME webroot path must have mode 755: $target" >&2; exit 1; }
    return
  fi
  install -d -o root -g root -m 755 "$target"
}

test "$(id -u)" = "0" || { echo "ACME webroot preparation must run as root" >&2; exit 1; }
ensure_directory /var/lib/letsencrypt
ensure_directory /var/lib/letsencrypt/.well-known
ensure_directory /var/lib/letsencrypt/.well-known/acme-challenge
echo "ACME webroot prepared"
