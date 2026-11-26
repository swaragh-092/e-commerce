#!/usr/bin/env bash
# Invoked over verified SSH. Check mode leaves the running application untouched.
set -Eeuo pipefail
umask 077

mode=${1:?}
target=${2:?}
branch=${3:?}
app=${4:?}
web=${5:?}
pm2_name=${6:?}
sha=${7:?}

fail() {
  echo "::error::$*" >&2
  exit 1
}

case "$target" in
  staging)
    private_ip=172.31.15.246
    expected_branch=develop
    expected_app=/home/ec2-user/e-commerce
    expected_web=$expected_app/client/dist
    domain=eshopadmin.swaragh.org.in
    ;;
  production)
    private_ip=172.31.5.186
    expected_branch=main
    expected_app=/home/ec2-user/projects/e-commerce
    expected_web=/var/www/orbis-admin
    domain=ad.orbiseeds.com
    ;;
  *) fail "Unknown environment." ;;
esac

[[ "$mode" == check || "$mode" == deploy ]] || fail "Unknown deployment operation."
[[ "$branch" == "$expected_branch" && "$app" == "$expected_app" &&
   "$web" == "$expected_web" && "$pm2_name" == ecommerce-api &&
   "$sha" =~ ^[a-f0-9]{40}$ ]] || fail "Unexpected branch, path, process, or commit for $target."
ip -o -4 addr show scope global | awk '{sub(/\/.*/, "", $4); print $4}' | grep -Fx "$private_ip" >/dev/null ||
  fail "The expected EC2 private IPv4 is absent."

if [[ -x "$HOME/.local/ecommerce-node22/bin/node" ]]; then
  export PATH="$HOME/.local/ecommerce-node22/bin:$PATH"
fi
for tool in git node npm pm2 curl tar rsync flock pg_restore sha256sum python3; do
  command -v "$tool" >/dev/null || fail "$tool is unavailable to non-interactive SSH."
done
node -e 'process.exit(Number(process.versions.node.split(".")[0]) === 22 ? 0 : 1)' ||
  fail "Node 22 is unavailable to non-interactive SSH."

sudo -n true || fail "EC2 deployment requires non-interactive sudo."
cd "$app"
if [[ "$mode" == deploy ]]; then
  exec 9>"$HOME/.ecommerce-deploy.lock"
  flock -n 9 || fail "Another deployment owns the server lock."
fi

[[ "$(git branch --show-current)" == "$branch" ]] || fail "The checkout is on the wrong branch."
git diff --quiet && git diff --cached --quiet || fail "Tracked or staged server changes need review."
remote_tip=$(GIT_TERMINAL_PROMPT=0 git ls-remote --exit-code origin "refs/heads/$branch" | cut -f1) ||
  fail "The server cannot read the expected branch on GitHub."
[[ "$remote_tip" == "$sha" ]] || fail "The branch advanced. Run deployment for its latest commit."

test -r .env && test -r server/.env && test -d server/uploads ||
  fail "The expected environment files or uploads directory are missing."
sudo -n nginx -t >&2
sudo -n -u nginx test -r "$web/index.html" || fail "Nginx cannot read the existing frontend."
db_bytes=$(sudo -n -u postgres psql -d ecommerce -v ON_ERROR_STOP=1 -Atc 'SELECT pg_database_size(current_database())')
home_free=$(df -PB1 "$HOME" | awk 'NR==2 {print $4}')
(( home_free > db_bytes + 536870912 )) || fail "Insufficient space for a database backup and deployment files."

pm2_pid() {
  pm2 jlist | node -e '
    let data = "";
    process.stdin.on("data", chunk => data += chunk);
    process.stdin.on("end", () => {
      const matches = JSON.parse(data).filter(entry => entry.name === process.argv[1]);
      if (matches.length !== 1) process.exit(1);
      const [app] = matches;
      if (app.pm2_env.pm_cwd !== process.argv[2] + "/server" ||
          app.pm2_env.pm_exec_path !== process.argv[2] + "/server/index.js" ||
          app.pm2_env.status !== "online" || !app.pid) process.exit(1);
      console.log(app.pid);
    });' "$pm2_name" "$app"
}
[[ -S "${PM2_HOME:-$HOME/.pm2}/rpc.sock" ]] || fail "PM2 is not running for the deployment user."
pid=$(pm2_pid) || fail "PM2 application is missing, offline, or uses an unexpected path."

# index.js gives root .env precedence, whereas Sequelize CLI reads server .env first.
prefix=$(cd server && node - "$pid" "$target" <<'NODE'
const fs = require('node:fs');
const dotenv = require('dotenv');
const { Client } = require('pg');
const root = dotenv.parse(fs.readFileSync('../.env'));
const server = dotenv.parse(fs.readFileSync('.env'));
const runtimeEnv = Object.fromEntries(
  fs.readFileSync('/proc/' + process.argv[2] + '/environ', 'utf8')
    .split('\0').filter(entry => entry.includes('='))
    .map(entry => [entry.slice(0, entry.indexOf('=')), entry.slice(entry.indexOf('=') + 1)])
);
const runtime = { ...server, ...root, ...runtimeEnv };
const migration = { ...root, ...server, ...process.env };
const dbKeys = ['DB_NAME', 'DB_USER', 'DB_HOST', 'DB_PORT', 'DB_PASSWORD'];
for (const key of dbKeys) {
  if (runtime[key] !== migration[key]) throw new Error('Runtime and migration configuration differ for ' + key);
}
if (runtime.DB_NAME !== 'ecommerce' || !['localhost', '127.0.0.1', '::1'].includes(runtime.DB_HOST) ||
    !runtime.DB_USER || !runtime.DB_PASSWORD || Number(runtime.DB_PORT || 5432) !== 5432 ||
    runtime.NODE_ENV !== 'production' || !runtime.CREDENTIAL_ENCRYPTION_KEY ||
    (process.argv[3] === 'production' && runtime.DB_USER !== 'ecommerce_app')) {
  throw new Error('Unexpected runtime or database configuration');
}
const adminPath = runtime.ADMIN_ROUTE_PREFIX || '/api/admin';
if (!/^\/api\/[A-Za-z0-9_-]+$/.test(adminPath)) throw new Error('Unsupported ADMIN_ROUTE_PREFIX');
const client = new Client({
  database: runtime.DB_NAME, user: runtime.DB_USER, host: runtime.DB_HOST,
  port: Number(runtime.DB_PORT || 5432), password: runtime.DB_PASSWORD, connectionTimeoutMillis: 5000
});
(async () => {
  try {
    await client.connect();
    await client.query('SELECT 1');
    console.log(adminPath.slice('/api/'.length));
  } catch (error) {
    console.error('Application database login failed (' + (error.code || error.name) + ')');
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
NODE
)
curl -fsS --max-time 10 http://127.0.0.1:5000/health >/dev/null ||
  fail "The current backend is unhealthy. Recover it before deploying."
nginx_curl=(curl -fsS --max-time 15 --resolve "$domain:443:127.0.0.1")
"${nginx_curl[@]}" "https://$domain/admin/login" >/dev/null ||
  fail "The current admin login page failed the Nginx smoke check."

check_proxied_api() {
  "${nginx_curl[@]}" "https://$domain/api/settings/features" | node -e '
    const data = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
    if (data.success !== true) process.exit(1);'
}
check_proxied_api || fail "Nginx could not reach the application API."

if [[ "$mode" == check ]]; then
  printf '%s\n' "$prefix"
  exit 0
fi

incoming=${8:?}
digest=${9:?}
[[ "$incoming" =~ ^/home/ec2-user/\.ec2-deploy\.[A-Za-z0-9]+$ && ! -L "$incoming" && -O "$incoming" &&
   "$digest" =~ ^[a-f0-9]{64}$ ]] || fail "Invalid artifact path or checksum."
[[ "$(sha256sum "$incoming/frontend.tar.gz" | cut -d ' ' -f 1)" == "$digest" ]] ||
  fail "The frontend archive checksum did not match."

old_sha=$(git rev-parse HEAD)
old_frontend=$(readlink -f "$web")
stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
release_base="$web.releases"
release="$release_base/$sha-$stamp"
previous="$release_base/previous-$stamp"
backup_dir="$HOME/deployment-backups"
backup="$backup_dir/ecommerce-$stamp.dump"
phase=fetch
backend_stopped=false
checkout_started=false
frontend_published=false

frontend_move() {
  if [[ -d "$web" && ! -L "$web" ]] || [[ -d "$1" && ! -L "$1" ]]; then
    sudo -n python3 - "$1" "$web" <<'PY'
import ctypes
import os
import sys

libc = ctypes.CDLL(None, use_errno=True)
# RENAME_EXCHANGE swaps the existing directory and symlink atomically on AL2023.
if libc.renameat2(-100, os.fsencode(sys.argv[1]), -100, os.fsencode(sys.argv[2]), 2):
    reason = ctypes.get_errno()
    raise OSError(reason, os.strerror(reason))
PY
  else
    sudo -n mv -Tf -- "$1" "$web"
  fi
}

on_exit() {
  local rc=$?
  trap - EXIT
  if (( rc == 0 )); then return; fi
  set +e
  echo "::error::Deployment failed during $phase (exit $rc). Previous commit: $old_sha." >&2
  rm -f -- "$backup.partial"
  if [[ -f "$backup" ]]; then echo "Database backup: $backup" >&2; fi
  if [[ "$frontend_published" == false && "$(readlink -f "$web")" == "$release" ]]; then
    if [[ ! -d "$previous" ]]; then sudo -n ln -s -- "$old_frontend" "$previous"; fi
    frontend_move "$previous" && echo "Previous frontend restored." >&2
  fi
  if [[ "$backend_stopped" == true && "$checkout_started" == false ]]; then
    pm2 restart "$pm2_name" >&2 && echo "Previous backend restarted before any code or schema changes." >&2
  fi
  echo "See docs/EC2-DEPLOYMENT-ROLLOUT.md for phase-specific recovery." >&2
  exit "$rc"
}
trap on_exit EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

echo "Preparing $target commit $sha from $old_sha."
GIT_TERMINAL_PROMPT=0 git fetch origin "refs/heads/$branch"
[[ "$(git rev-parse FETCH_HEAD)" == "$sha" ]] || fail "The branch advanced during fetch."
git merge-base --is-ancestor "$old_sha" "$sha" || fail "The checkout cannot fast-forward to this commit."
git read-tree -n -m -u "$old_sha" "$sha" || fail "The release conflicts with files on this checkout."

phase=prepare-frontend
mkdir "$incoming/dist"
tar -xzf "$incoming/frontend.tar.gz" -C "$incoming/dist"
[[ -s "$incoming/dist/index.html" &&
   -z "$(find "$incoming/dist" ! -type f ! -type d -print -quit)" ]] ||
  fail "The frontend archive must contain index.html and regular files only."
web_free=$(df -PB1 "$(dirname "$web")" | awk 'NR==2 {print $4}')
frontend_bytes=$(du -sb "$incoming/dist" | cut -f1)
(( web_free > frontend_bytes + 134217728 )) || fail "Insufficient disk space for the new frontend release."
[[ ! -L "$release_base" ]] || fail "The frontend release directory must not be a symlink."
sudo -n install -d -m 755 "$release_base" "$release"
[[ "$(stat -c %d "$(dirname "$web")")" == "$(stat -c %d "$release_base")" ]] ||
  fail "The frontend and releases must be on the same filesystem."
sudo -n rsync -rlt --chmod=D755,F644 "$incoming/dist/" "$release/"
if command -v selinuxenabled >/dev/null && selinuxenabled; then
  sudo -n chcon --reference="$old_frontend" "$release_base"
  sudo -n chcon -R --reference="$old_frontend" "$release"
fi

phase=stop-backend
backend_stopped=true
pm2 stop "$pm2_name"
phase=backup
install -d -m 700 "$backup_dir"
sudo -n -u postgres pg_dump -Fc -d ecommerce > "$backup.partial"
pg_restore --list "$backup.partial" >/dev/null
pg_restore --file=/dev/null "$backup.partial"
mv -- "$backup.partial" "$backup"
(cd "$backup_dir" && sha256sum "$(basename "$backup")" > "$(basename "$backup").sha256")
echo "Verified database backup: $backup"

phase=checkout
checkout_started=true
git merge --ff-only --no-overwrite-ignore "$sha"
[[ "$(git rev-parse HEAD)" == "$sha" ]] || fail "The checkout did not reach the requested commit."
phase=dependencies
cd "$app/server"
npm ci --omit=dev
phase=migrations
NODE_ENV=production npm run migrate
phase=start-backend
NODE_ENV=production pm2 restart "$pm2_name" --update-env
healthy=false
for attempt in {1..12}; do
  if curl -fsS --max-time 5 http://127.0.0.1:5000/health >/dev/null 2>&1; then
    healthy=true
    break
  fi
  sleep 5
done
[[ "$healthy" == true ]] || fail "The updated backend failed its readiness check."
pid=$(pm2_pid)
[[ "$(readlink -f "/proc/$pid/exe")" == "$(readlink -f "$(command -v node)")" ]] ||
  fail "PM2 did not restart with the required Node runtime."

phase=publish-frontend
sudo -n ln -s -- "$release" "$previous"
frontend_move "$previous"

phase=smoke-test
check_proxied_api || fail "The updated API did not respond through Nginx."
served="$incoming/served.html"
"${nginx_curl[@]}" "https://$domain/admin/login" -o "$served"
cmp -s "$served" "$release/index.html" || fail "Nginx did not serve the new admin entry point."
asset=$(grep -om1 -E 'src="/assets/[^"]+\.js"' "$release/index.html" | cut -d '"' -f 2)
[[ -n "$asset" ]] || fail "No built JavaScript was referenced by index.html."
"${nginx_curl[@]}" "https://$domain$asset" -o "$incoming/served.js"
cmp -s "$incoming/served.js" "$release$asset" || fail "Nginx did not serve the new JavaScript asset."
pm2 save
frontend_published=true

# Retain five completed backups and five frontend releases, plus either live frontend.
prune_backups() {
  local name index=0
  while IFS= read -r name; do
    [[ "$name" =~ ^ecommerce-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$ && -f "$backup_dir/$name.sha256" ]] || continue
    index=$((index + 1))
    if (( index > 5 )); then rm -f -- "$backup_dir/$name" "$backup_dir/$name.sha256" || return 1; fi
  done < <(find "$backup_dir" -maxdepth 1 -type f -name 'ecommerce-*.dump' -printf '%f\n' | sort -r)
}
prune_releases() {
  local name index=0
  while IFS= read -r name; do
    [[ "$name" =~ ^([a-f0-9]{40}|previous)-[0-9]{8}T[0-9]{6}Z-[0-9]+$ ]] || continue
    index=$((index + 1))
    [[ "$release_base/$name" != "$release" && "$release_base/$name" != "$old_frontend" &&
       "$release_base/$name" != "$previous" ]] || continue
    if (( index > 5 )); then sudo -n rm -rf -- "$release_base/$name" || return 1; fi
  done < <(find "$release_base" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -t- -k2,2r -k3,3nr)
}
prune_backups || echo "::warning::Database backup retention cleanup failed."
prune_releases || echo "::warning::Frontend release retention cleanup failed."
echo "Deployed $target $sha."
