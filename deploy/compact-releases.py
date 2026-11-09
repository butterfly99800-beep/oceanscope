#!/usr/bin/env python3
"""Remove only reproducible dependencies from inactive OceanScope releases.
Default: report only. Apply requires an explicit rollback directory to keep.
No database, environment, uploads, Git history or release source is removed.
"""
import argparse
import fcntl
import os
from pathlib import Path
import shutil
import subprocess

BASE = Path('/srv/oceanscope')

def targets(releases, protected):
    result = []
    for release in releases.iterdir():
        if release.is_symlink() or not release.is_dir() or release.resolve() in protected:
            continue
        if not (release / 'package.json').is_file() or not (release / '.git').exists():
            continue
        dep = release / 'node_modules'
        if dep.is_dir() and not dep.is_symlink() and dep.resolve() == release.resolve() / 'node_modules':
            result.append(dep)
    return sorted(result)

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--keep', required=True, help='Previous working release directory to retain')
    p.add_argument('--apply', action='store_true')
    args = p.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('Run with sudo; default is dry-run.')
    with open('/run/lock/oceanscope-release.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        releases = (BASE / 'releases').resolve(strict=True)
        current = (BASE / 'current').resolve(strict=True)
        keep = Path(args.keep).resolve(strict=True)
        pid = subprocess.check_output(['systemctl','show','oceanscope.service','-p','MainPID','--value'], text=True).strip()
        running = Path('/proc', pid, 'cwd').resolve(strict=True)
        if running != current or current.parent != releases or keep.parent != releases or keep == current:
            raise SystemExit('Unexpected current/rollback directories; nothing removed.')
        if not (keep / 'node_modules').is_dir():
            raise SystemExit('Rollback dependencies missing; nothing removed.')
        protected = {current, keep}
        # Also retain any release used as another running process working directory.
        for proc in Path('/proc').glob('[0-9]*/cwd'):
            try:
                cwd = proc.resolve(strict=True)
                for parent in (cwd, *cwd.parents):
                    if parent.parent == releases:
                        protected.add(parent)
            except (OSError, RuntimeError):
                pass
        for dep in targets(releases, protected):
            print(('REMOVE ' if args.apply else 'WOULD REMOVE ') + str(dep), flush=True)
            if args.apply:
                shutil.rmtree(dep)
        print('Sources, builds, databases, backups, env, current and rollback dependencies retained.')

if __name__ == '__main__':
    main()
