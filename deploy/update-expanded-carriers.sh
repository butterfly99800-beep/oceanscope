#!/usr/bin/env bash
# Run as root: bash update-expanded-carriers.sh <reviewed full commit SHA>
set -Eeuo pipefail
umask 077
[[ $EUID == 0 ]] || { echo 'Please run with sudo bash.'; exit 1; }
sha=${1:?Full reviewed commit SHA required}
[[ $sha =~ ^[0-9a-f]{40}$ ]] || exit 1
base=/srv/oceanscope
repo=$base/app
current=$base/current
[[ -L $current ]] || { echo 'Expected release symlink missing; no changes made.'; exit 1; }
old=$(readlink -f "$current")
[[ $old == "$base/releases/"* ]] || exit 1
exec 9>/run/lock/oceanscope-release.lock
flock -n 9 || { echo 'Another deployment is running.'; exit 1; }
export PATH=/opt/oceanscope/node/bin:$PATH
command -v mysqldump >/dev/null || { echo 'mysqldump is required for a verified pre-migration backup; no deployment performed.'; exit 1; }
[[ $(runuser -u oceanscope -- git -C "$repo" remote get-url origin) == https://github.com/butterfly99800-beep/oceanscope.git ]] || exit 1
runuser -u oceanscope -- git -C "$repo" fetch origin main
[[ $(runuser -u oceanscope -- git -C "$repo" rev-parse origin/main) == "$sha" ]] || { echo 'main differs from reviewed SHA; stopped.'; exit 1; }
release=$(mktemp -d "$base/releases/$sha.XXXXXXXX")
chown oceanscope:oceanscope "$release"
runuser -u oceanscope -- git clone --no-hardlinks --no-checkout "$repo" "$release"
runuser -u oceanscope -- git -C "$release" checkout --detach "$sha"
runuser -u oceanscope -- git -C "$release" remote set-url origin https://github.com/butterfly99800-beep/oceanscope.git
# Preserve the existing private environment file. Never enable shell tracing.
set -a
source /etc/oceanscope/oceanscope.env
set +a
export PATH=/opt/oceanscope/node/bin:$PATH
# Read only the dist-dir setting; never display service environment or secrets.
service_dist=$(systemctl show oceanscope.service -p Environment --value | python3 -c 'import shlex,sys; print(next((s.split("=",1)[1] for s in shlex.split(sys.stdin.read()) if s.startswith("OCEANSCOPE_DIST_DIR=")),""))')
export OCEANSCOPE_DIST_DIR=${service_dist:-${OCEANSCOPE_DIST_DIR:-.next}}
cd "$release"
runuser -u oceanscope -- npm ci --include=dev --ignore-scripts
runuser -u oceanscope -- node node_modules/prisma/build/index.js generate
runuser -u oceanscope -- env DATABASE_URL=mysql://unused:unused@127.0.0.1:1/unused npm run build
# Only the dedicated OceanScope database is allowed. Credentials are passed in a 0600 temporary file.
backup_dir=$base/backups
install -d -m 700 "$backup_dir"
credentials=$(mktemp)
backup="$backup_dir/pre-$sha-$(date +%Y%m%d%H%M%S).sql"
switched=0
cleanup() { rm -f -- "$credentials"; }
trap cleanup EXIT
python3 - "$credentials" <<'PY'
import os,sys,urllib.parse
u=urllib.parse.urlsplit(os.environ['DATABASE_URL'])
assert u.scheme=='mysql' and u.path=='/oceanscope', 'Unexpected database; stopped'
def q(s): return '"'+str(s).replace('\\','\\\\').replace('"','\\"').replace('\n','\\n')+'"'
with open(sys.argv[1],'w') as f:
 f.write('[client]\n'+ '\n'.join(k+'='+q(v) for k,v in {'host':u.hostname,'port':u.port or 3306,'user':urllib.parse.unquote(u.username or ''),'password':urllib.parse.unquote(u.password or '')}.items())+'\n')
PY
mysqldump --defaults-extra-file="$credentials" --single-transaction --no-tablespaces --set-gtid-purged=OFF oceanscope > "$backup"
[[ -s $backup ]] && grep -q 'Dump completed' "$backup" || { echo 'Backup not verified; service untouched.'; exit 1; }
# Guard script verifies existing baseline and every applied migration checksum first.
runuser -u oceanscope -- env OCEANSCOPE_DATABASE_MODE=fresh-baseline npm run db:deploy
# Existing user-upload directories must be handled explicitly rather than silently omitted.
for data in public/uploads uploads storage; do
 if [[ -e "$old/$data" ]]; then echo "Existing user data $data requires a shared-directory review; service untouched."; exit 1; fi
done
link="$base/.current-$sha-$$"
ln -s "$release" "$link"
mv -Tf "$link" "$current"
if systemctl restart oceanscope.service && curl -fsS --retry 8 --retry-all-errors --retry-delay 2 --max-time 10 -o /dev/null http://127.0.0.1:3040/login; then
 echo "Published $sha; login HTTP 200. Previous release retained: $old"
 echo "Database backup retained: $backup"
else
 ln -s "$old" "$link"
 mv -Tf "$link" "$current"
 systemctl restart oceanscope.service
 echo 'Health check failed: previous code restored. Additive enum migration retained; no data restore attempted.'
 exit 1
fi
