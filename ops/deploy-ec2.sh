#!/usr/bin/env bash
# Runs on the EC2 host, never builds React on the server.
set -Eeuo pipefail
umask 077

mode=${1:?}
target=${2:?}
branch=${3:?}
app=${4:?}
web=${5:?}
pm2_name=${6:?}
sha=${7:?}

case "$target" in
  staging)
    expected_host=ip-172-31-15-246
    expected_branch=develop
    expected_app=/home/ec2-user/e-commerce
    expected_web=/home/ec2-user/e-commerce/client/dist
    domain=eshopadmin.swaragh.org.in
    ;;
  production)
    expected_host=ip-172-31-5-186
    expected_branch=main
    expected_app=/home/ec2-user/projects/e-commerce
    expected_web=/var/www/orbis-admin
    domain=ad.orbiseeds.com
    ;;
  *) exit 1 ;;
esac

test "$(hostname -s)" = "$expected_host"
test "$branch" = "$expected_branch"
test "$app" = "$expected_app"
test "$web" = "$expected_web"
test "$pm2_name" = ecommerce-api
[[ "$sha" =~ ^[a-f0-9]{40}$ ]]
for tool in git node npm pm2 curl tar rsync flock pg_restore sha256sum; do
  command -v "$tool" >/dev/null
done
sudo -n true
cd "$app"
test "$(git branch --show-current)" = "$branch"
git diff --quiet
git diff --cached --quiet
test -s "$web/index.html"
test -r .env
test -r server/.env
test -d server/uploads
test -n "$(git ls-remote origin "refs/heads/$branch")"
sudo -n nginx -t >&2
sudo -n -u postgres psql -d ecommerce -v ON_ERROR_STOP=1 -Atc 'SELECT 1' >/dev/null

# Validate dotenv files without printing secrets. These installations use both.
prefix=$(cd server && node <<'NODE'
const fs = require('fs');
const dotenv = require('dotenv');
const root = dotenv.parse(fs.readFileSync('../.env'));
const server = dotenv.parse(fs.readFileSync('.env'));
const keys = ['DB_NAME', 'DB_USER', 'DB_HOST', 'DB_PORT', 'DB_PASSWORD', 'ADMIN_ROUTE_PREFIX', 'NODE_ENV', 'CREDENTIAL_ENCRYPTION_KEY'];
for (const key of keys) {
  if (root[key] !== server[key]) throw new Error('Environment mismatch: ' + key);
}
if (root.DB_NAME !== 'ecommerce' || !['localhost', '127.0.0.1', '::1'].includes(root.DB_HOST) ||
    !root.DB_USER || !root.DB_PASSWORD || root.NODE_ENV !== 'production' ||
    !root.CREDENTIAL_ENCRYPTION_KEY || Number(root.DB_PORT || 5432) !== 5432) {
  throw new Error('Unexpected database or runtime configuration');
}
const prefix = (root.ADMIN_ROUTE_PREFIX || '/api/admin').replace(/^\/api\//, '');
if (!/^[A-Za-z0-9_-]+$/.test(prefix)) throw new Error('Unsupported admin API prefix');
process.stdout.write(prefix);
NODE
)
pm2 jlist | node -e '
let s=""; process.stdin.on("data",d=>s+=d);
process.stdin.on("end",()=>{
  const p=JSON.parse(s).find(p=>p.name===process.argv[1]);
  if(!p || p.pm2_env.pm_cwd!==process.argv[2]+"/server" || p.pm2_env.status!=="online")
    process.exit(1);
});' "$pm2_name" "$app"
curl -fsS --max-time 10 http://127.0.0.1:5000/health >/dev/null

if [[ "$mode" == check ]]; then
  printf '%s\n' "$prefix"
  exit 0
fi
test "$mode" = deploy
incoming=${8:?}
digest=${9:?}
[[ "$incoming" =~ ^/home/ec2-user/\.ec2-deploy\.[A-Za-z0-9]+$ ]]
[[ "$digest" =~ ^[a-f0-9]{64}$ ]]
test -d "$incoming"
test "$(sha256sum "$incoming/frontend.tar.gz" | awk '{print $1}')" = "$digest"

# Do not race another deploy on this server.
exec 9>"$HOME/.ecommerce-deploy.lock"
flock -n 9
old_sha=$(git rev-parse HEAD)
git fetch origin "$branch"
test "$(git rev-parse FETCH_HEAD)" = "$sha" || { echo "Branch advanced; deploy latest run instead." >&2; exit 1; }
git merge-base --is-ancestor "$old_sha" "$sha"

# Prepare a complete static release before stopping the backend.
mkdir "$incoming/dist"
tar -xzf "$incoming/frontend.tar.gz" -C "$incoming/dist"
test -s "$incoming/dist/index.html"
test -z "$(find "$incoming/dist" -type l -print -quit)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
release_base="$web.releases"
release="$release_base/$sha-$stamp"
sudo -n install -d -m 755 "$release_base" "$release"
sudo -n rsync -rlt --chmod=D755,F644 "$incoming/dist/" "$release/"
if command -v restorecon >/dev/null; then
  if [[ "$target" == production ]]; then
    sudo -n restorecon -RF "$release_base"
  elif command -v selinuxenabled >/dev/null && selinuxenabled; then
    sudo -n chcon --reference="$web" "$release_base"
    sudo -n chcon -R --reference="$web" "$release"
  fi
fi

backup_dir="$HOME/deployment-backups"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
backup="$backup_dir/ecommerce-$stamp.dump"
phase=prepare
trap 'rc=$?; echo "Deployment failed during $phase (exit $rc). Previous commit: $old_sha. Backup path (if completed): $backup. Do not automatically restore DB or restart old code after a migration; inspect first." >&2; exit "$rc"' ERR

phase=stop-backend
pm2 stop "$pm2_name"
phase=backup
sudo -n -u postgres pg_dump -Fc -d ecommerce > "$backup"
pg_restore --list "$backup" >/dev/null
phase=checkout
git merge --ff-only "$sha"
test "$(git rev-parse HEAD)" = "$sha"
phase=dependencies
cd "$app/server"
npm ci --omit=dev
phase=migrations
NODE_ENV=production npm run migrate
phase=start-backend
NODE_ENV=production pm2 restart "$pm2_name" --update-env
healthy=false
for attempt in {1..12}; do
  if curl -fsS --max-time 5 http://127.0.0.1:5000/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 5
done
test "$healthy" = true

# Atomic symlink replacement for subsequent releases. First conversion of
# the existing real directory requires two renames, with a short gap.
phase=publish-frontend
next="$web.next-$stamp"
sudo -n ln -s "$release" "$next"
if [[ -d "$web" && ! -L "$web" ]]; then
  sudo -n mv "$web" "$release_base/previous-$stamp"
fi
sudo -n mv -Tf "$next" "$web"

phase=smoke-test
served="$incoming/served.html"
curl -fsS --max-time 15 --resolve "$domain:443:127.0.0.1" "https://$domain/admin/login" -o "$served"
test "$(sha256sum "$served" | awk '{print $1}')" = "$(sha256sum "$release/index.html" | awk '{print $1}')"
pm2 save
echo "Deployed $target $sha; database backup: $backup"
rm -rf -- "$incoming"
