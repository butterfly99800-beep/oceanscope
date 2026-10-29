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
assert.equal(result.stdout.replace(/\r\n/g, '\n').trim(), sql.replace(/\r\n/g, '\n').trim());
console.log('PASS: 17 lowercase tables, unique constraints, schema-generated baseline, unchanged archived migration bytes');
