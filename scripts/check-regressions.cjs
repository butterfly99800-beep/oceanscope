const { spawnSync } = require('node:child_process');
const path = require('node:path');
for (const name of ['check-query-state-memory', 'check-routing-evidence', 'check-evergreen-routing', 'check-location-match', 'check-migration-baseline', 'check-expanded-schedules', 'check-zim-public', 'check-cosco-itineraries', 'check-maersk-inland', 'check-provider-fallback', 'check-public-request-retry', 'check-source-port-match', 'check-live-date-window', 'check-oocl-http', 'check-oocl-alternate-loading', 'check-oocl-loops', 'check-one-http', 'check-live-carrier-identity', 'check-schedule-pagination']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, name + '.cjs')], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
