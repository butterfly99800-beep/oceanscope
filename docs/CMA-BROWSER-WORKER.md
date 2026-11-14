# CMA existing-browser session worker

This optional path uses a user-enabled Edge/Chrome extension to submit a **new** CMA global Routing Finder POST for each worker request. It does not upload cookies, use saved result files, log credentials, or require CMA login. The existing official tab must already have the requested origin/destination selected and a usable verification session. Other routes fail explicitly rather than returning that tab's previous route. Browser verification expiry can still require user intervention.

## Local setup

1. Run `node scripts/browser-session-bridge/server.cjs`. It binds only `127.0.0.1:18342`, generates a local secret in the ignored `.client-token` and `local-config.js` files, and preserves that secret on restart. Never commit or share these files.
2. Load `scripts/browser-session-bridge` as an unpacked extension. Open its popup and enable the connection for this browser session. Browser restart/reload requires enabling it again.
3. In the Windows worker process environment set `CMA_USE_BROWSER_SESSION=true` and `CMA_SESSION_TOKEN_FILE` to the absolute `.client-token` path, then run `node scripts/oocl-worker.cjs`. Existing OOCL startup/token settings remain required. The new worker supports `/query` and `/cma/query` with the existing bearer authentication. Do not start a second process on an occupied port.
4. For isolated testing, set `OCEANSCOPE_WORKER_PORT=18343`. This leaves the existing port 18341 worker and SSH tunnel untouched.

## Application / Ubuntu

After deliberately updating the worker, set `CMA_USE_LOCAL_WORKER=true` on the application. By default it calls `http://127.0.0.1:18341/cma/query` with `OOCL_WORKER_TOKEN`. Optional `CMA_WORKER_URL` and `CMA_WORKER_TOKEN` support a separately forwarded CMA worker. Do not change or restart the existing SSH tunnel merely to test the local 18343 instance. Merely pushing code does not update an already-running worker or configure a new tunnel.

The application validates fresh-query metadata, exact port/date criteria, official source URL and parsed card count. Incomplete, stale, mismatched or failed responses are not substituted with China regional tables. Existing database records are retained; China-table records are excluded from global Routing Finder results.

No database migration, seed, password change, or port import is required. Keep the previous release for rollback; disabling `CMA_USE_LOCAL_WORKER` restores the standard public browser query path. Public sites can still restrict that path.
