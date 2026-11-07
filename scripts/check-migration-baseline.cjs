const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const name = '20261029000000_fresh_database_baseline';
const sql = fs.readFileSync(path.join(root, 'prisma/migrations', name, 'migration.sql'), 'utf8');
const archive = path.join(root, 'prisma/migrations-archive/pre-20261029');
for (const item of JSON.parse(fs.readFileSync(path.join(archive, 'manifest.json')))) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(archive, item.name, 'migration.sql'))).digest('hex'), item.sha256);
}
const tables = [...sql.matchAll(/CREATE TABLE `([^`]+)`/g)].map(m => m[1]);
assert.equal(tables.length, 17);
assert(tables.every(t => t === t.toLowerCase()));
assert.equal(new Set(tables).size, tables.length);
const constraints = [...sql.matchAll(/ADD CONSTRAINT `([^`]+)`/g)].map(m => m[1]);
assert.equal(new Set(constraints).size, constraints.length);
assert(sql.includes('FOREIGN KEY (`carrierId`) REFERENCES `carrier`(`id`)'));
assert(!/\b(DROP|TRUNCATE|DELETE|INSERT|UPDATE|RENAME)\s+(TABLE|COLUMN|FROM|INTO|`)/i.test(sql));
const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], {
  cwd: root, encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'mysql://unused:unused@127.0.0.1:1/unused', CHECKPOINT_DISABLE: '1' },
});
assert.equal(result.status, 0, result.stderr);
const baselineOutput = result.stdout.replace(/\r\n/g, '\n').replace(/, '(?:ONE|EMC|YML|HMM|KMTC|PIL|SITC)_LIVE_QUERY'/g, '').replace(/^.*`routingKey` VARCHAR\(64\).*\n/gm, '').replace('`sailingschedule_routing_identity_key`', '`sailingschedule_carrierId_vesselName_voyageNumber_originPort_key`').replace(', `routingKey`)', ')');
assert.equal(baselineOutput.trim(), sql.replace(/\r\n/g, '\n').trim());
console.log('PASS: 17 lowercase tables, unique constraints, schema-generated baseline, unchanged archived migration bytes');

const extension = fs.readFileSync(path.join(root, 'prisma/migrations/20261030000000_add_one_schedule_source/migration.sql'), 'utf8');
const currentSource = result.stdout.split('\n').find(line => line.includes("\`source\` ENUM('SEED'")).trim().replace(/,$/, ';');
assert(extension.includes('ALTER TABLE \x60sailingschedule\x60 MODIFY ' + currentSource.replace(/, '(?:EMC|YML|HMM|KMTC|PIL|SITC)_LIVE_QUERY'/g, '')));
const expanded = fs.readFileSync(path.join(root, 'prisma/migrations/20261107000000_add_public_schedule_carriers/migration.sql'), 'utf8');
assert(expanded.replace(/,\s*/g, ',').includes(('ALTER TABLE `sailingschedule` MODIFY '+currentSource).replace(/,\s*/g, ',')));
assert.equal((expanded.match(/ALTER TABLE/g)||[]).length,1);
assert(!/DROP|TRUNCATE|DELETE|UPDATE|INSERT/.test(expanded));
assert.equal((extension.match(/ALTER TABLE/g) || []).length, 1);
console.log('PASS: ONE forward migration preserves all old enum values and defaults');
