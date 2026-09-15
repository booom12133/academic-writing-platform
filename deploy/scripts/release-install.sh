#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: release-install.sh <commit-sha> <app-artifact-dir> <deploy-dir>" >&2
  exit 2
fi

release_sha="$1"
app_artifact="$2"
deploy_metadata="$3"
release_root="/opt/academic-writing-platform/releases/$release_sha"

test -d "$app_artifact"
test -d "$deploy_metadata"
test -f "$app_artifact/server/main.js"
test -f "$app_artifact/package.json"
test -f "$app_artifact/run.sh"
test -f "$app_artifact/scripts/db-migrate.js"
test -f "$app_artifact/scripts/db-backup.js"
test -f "$app_artifact/scripts/db-restore-verify.js"
test -f "$app_artifact/scripts/verify-production-database.js"
test -d "$app_artifact/drizzle/migrations"
test ! -e "$release_root"

sudo install -d -o root -g academic-writing -m 750 "$release_root"
sudo install -d -o root -g academic-writing -m 750 "$release_root/app"
sudo install -d -o root -g academic-writing -m 750 "$release_root/deploy"
sudo cp -a "$app_artifact/." "$release_root/app/"
sudo cp -a "$deploy_metadata/." "$release_root/deploy/"
sudo chown -R root:academic-writing "$release_root/app" "$release_root/deploy"
sudo find "$release_root/app" "$release_root/deploy" -type d -exec chmod 750 {} +
sudo find "$release_root/app" "$release_root/deploy" -type f -exec chmod 640 {} +
sudo test ! -e "$release_root/app/run.sh" || sudo chmod 750 "$release_root/app/run.sh"
sudo find "$release_root/deploy/scripts" -type f -name '*.sh' -exec chmod 750 {} +
sudo node "$(dirname "$0")/release-manifest.js" --write "$release_root" >/dev/null
sudo chown root:root "$release_root/release-manifest.sha256"
sudo chmod 640 "$release_root/release-manifest.sha256"
echo "release installed: $release_root"
