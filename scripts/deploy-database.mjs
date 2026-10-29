import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// This release intentionally does not adopt legacy OceanScope databases.
if (process.env.OCEANSCOPE_DATABASE_MODE !== 'fresh-baseline') throw new Error('Deployment refused: explicitly set OCEANSCOPE_DATABASE_MODE=fresh-baseline for a new database.');
const root = fileURLToPath(new URL('../', import.meta.url));
const baseline = '20261029000000_fresh_database_baseline';
const migrations = path.join(root, 'prisma/migrations');
const prisma = new PrismaClient();
let allowed = false;
try {
  const tables = await prisma.$queryRaw`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`;
  if (tables.length === 0) allowed = true;
  else if (tables.some(t => t.name === '_prisma_migrations')) {
    const history = await prisma.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations`;
    const active = new Set(readdirSync(migrations));
    allowed = history.some(m => m.migration_name === baseline && m.finished_at && !m.rolled_back_at) && history.every(m => {
      if (!active.has(m.migration_name) || !m.finished_at || m.rolled_back_at) return false;
      return createHash('sha256').update(readFileSync(path.join(migrations, m.migration_name, 'migration.sql'))).digest('hex') === m.checksum;
    });
  }
} catch {
  console.error('Cannot verify target database. Create the empty database and check private connection settings first.');
} finally { await prisma.$disconnect(); }
if (!allowed) throw new Error('Deployment refused: target is not empty or does not have the verified fresh-baseline history. Existing databases need a separate migration plan.');
const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { cwd: root, env: process.env, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
