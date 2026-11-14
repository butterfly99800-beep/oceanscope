#!/usr/bin/env bash
# Code-only release: no database writes, no worker/tunnel changes.
set -Eeuo pipefail
umask 077
[[ $EUID == 0 ]] || { echo 'Run with sudo bash'; exit 1; }
sha=${1:?Full commit SHA required}
[[ $sha =~ ^[0-9a-f]{40}$ ]] || exit 1
base=/srv/oceanscope
repo=$base/app
current=$base/current
envfile=/etc/oceanscope/oceanscope.env
exec 9>/run/lock/oceanscope-release.lock
flock -n 9 || { echo 'Another deployment is running'; exit 1; }
[[ -L $current && -f $envfile ]] || { echo 'Release link or environment missing'; exit 1; }
old=$(readlink -f "$current")
[[ $old == "$base/releases/"* ]] || exit 1
pid=$(systemctl show oceanscope.service -p MainPID --value)
[[ $(readlink -f "/proc/$pid/cwd") == "$old" ]] || { echo 'Running release differs from current; stopped'; exit 1; }
[[ $(runuser -u oceanscope -- git -C "$repo" remote get-url origin) == https://github.com/butterfly99800-beep/oceanscope.git ]] || exit 1
runuser -u oceanscope -- git -C "$repo" fetch origin main
runuser -u oceanscope -- git -C "$repo" merge-base --is-ancestor "$sha" origin/main
oldsha=$(runuser -u oceanscope -- git -C "$old" rev-parse HEAD)
if ! runuser -u oceanscope -- git -C "$repo" diff --quiet "$oldsha" "$sha" -- prisma/schema.prisma prisma/migrations; then
 echo 'Database structure differs; code-only update stopped for review'; exit 1
fi
for data in public/uploads uploads storage; do
 [[ ! -e "$old/$data" ]] || { echo "User data at $data needs shared-directory review; stopped"; exit 1; }
done
available=$(df -Pk "$base" | awk 'NR==2 {print $4}')
(( available >= 2500000 )) || { echo 'Need at least 2.5 GB free; no cleanup or restart performed'; exit 1; }
stamp=$(date +%Y%m%d%H%M%S)
backup=$base/backups/code-$stamp
install -d -m 700 "$backup"
cp -a "$envfile" "$backup/oceanscope.env"
printf '%s\n' "$old" > "$backup/previous-release"
[[ ! -f "$old/next-env.d.ts" ]] || cp -a "$old/next-env.d.ts" "$backup/next-env.d.ts"
release=$(mktemp -d "$base/releases/$sha.XXXXXXXX")
chown oceanscope:oceanscope "$release"
runuser -u oceanscope -- git clone --no-hardlinks --no-checkout "$repo" "$release"
runuser -u oceanscope -- git -C "$release" checkout --detach "$sha"
runuser -u oceanscope -- git -C "$release" remote set-url origin https://github.com/butterfly99800-beep/oceanscope.git
set -a
source "$envfile"
set +a
export PATH=/opt/oceanscope/node/bin:/opt/oceanscope/node:$PATH
service_dist=$(systemctl show oceanscope.service -p Environment --value | python3 -c 'import shlex,sys; print(next((s.split("=",1)[1] for s in shlex.split(sys.stdin.read()) if s.startswith("OCEANSCOPE_DIST_DIR=")),""))')
dist=${service_dist:-${OCEANSCOPE_DIST_DIR:-.next}}
[[ $dist =~ ^[A-Za-z0-9._-]+$ && $dist != . && $dist != .. ]] || { echo 'Unexpected build directory'; exit 1; }
cd "$release"
runuser -u oceanscope -- npm ci --include=dev --ignore-scripts
runuser -u oceanscope -- env DATABASE_URL=mysql://unused:unused@127.0.0.1:1/unused node node_modules/prisma/build/index.js generate
runuser -u oceanscope -- env DATABASE_URL=mysql://unused:unused@127.0.0.1:1/unused OCEANSCOPE_DIST_DIR="$dist" npm run build
link=$base/.current-code-$$
rollback() {
 trap - ERR
 ln -s "$old" "$link.rollback"
 mv -Tf "$link.rollback" "$current"
 systemctl restart oceanscope.service
 echo "Release failed; restored previous code: $old"
 exit 1
}
ln -s "$release" "$link"
trap rollback ERR
mv -Tf "$link" "$current"
systemctl restart oceanscope.service
curl -fsS --retry 10 --retry-all-errors --retry-delay 2 --max-time 10 -o /dev/null http://127.0.0.1:3040/login
pid=$(systemctl show oceanscope.service -p MainPID --value)
[[ $(readlink -f "/proc/$pid/cwd") == "$release" ]]
trap - ERR
printf 'Published %s; login HTTP 200\nPrevious release: %s\nConfig backup: %s\n' "$sha" "$old" "$backup"
echo 'No database migrations, worker restarts, SSH changes or release deletions performed.'
