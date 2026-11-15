import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync, openSync, closeSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Deliberately limited upgrade for an existing, verified baseline database.
// No reset, resolve, seed, data deletion, or reverse migration is permitted.
const target='20261115090000_nullable_schedule_eta';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=path.join(root,'prisma/migrations');
const names=readdirSync(dir).filter(n=>/^\d/.test(n)).sort();
const sql=readFileSync(path.join(dir,target,'migration.sql'),'utf8');
if(sql.replace(/--[^\n]*/g,'').trim()!=='ALTER TABLE `sailingschedule` MODIFY `eta` DATETIME(3) NULL;')throw Error('Unexpected migration SQL');
const backup=process.argv[2];
if(!backup||!path.isAbsolute(backup))throw Error('Absolute private backup directory required');
const prisma=new PrismaClient();
try {
 const history=await prisma.$queryRawUnsafe('SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations');
 const completed=new Set();
 for(const h of history){
  if(!names.includes(h.migration_name)||!h.finished_at||h.rolled_back_at||completed.has(h.migration_name))throw Error('Migration history needs manual review');
  const checksum=createHash('sha256').update(readFileSync(path.join(dir,h.migration_name,'migration.sql'))).digest('hex');
  if(checksum!==h.checksum)throw Error('Migration checksum mismatch');
  completed.add(h.migration_name);
 }
 if(names.some(n=>n!==target&&!completed.has(n)))throw Error('Earlier migrations missing; stopped');
 const columns=await prisma.$queryRawUnsafe("SELECT COLUMN_TYPE AS type, IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sailingschedule' AND COLUMN_NAME='eta'");
 if(columns.length!==1||columns[0].type.toLowerCase()!=='datetime(3)')throw Error('Unexpected ETA column; stopped');
 if(completed.has(target)){
  if(columns[0].nullable!=='YES')throw Error('Schema/history mismatch');
  console.log('ETA compatibility already applied; no database changes');
 } else {
  if(columns[0].nullable!=='NO')throw Error('Unrecorded schema change; stopped');
  const u=new URL(process.env.DATABASE_URL);
  if(u.protocol!=='mysql:'||!/^\/[A-Za-z0-9_]+$/.test(u.pathname))throw Error('Unsupported database URL');
  const db=u.pathname.slice(1),port=u.port||'3306';
  let command=process.env.OCEANSCOPE_MYSQLDUMP||'mysqldump',prefix=[],host=u.hostname,dumpPort=port;
  const available=spawnSync(command,['--version'],{encoding:'utf8'});
  if(available.error||available.status!==0){
   // A loopback MySQL Docker binding may supply its own compatible dump client.
   if(!['localhost','127.0.0.1'].includes(host))throw Error('Install a compatible mysqldump client first');
   const ids=spawnSync('docker',['ps','-q'],{encoding:'utf8'});
   if(ids.status!==0)throw Error('mysqldump unavailable; no database changes');
   const matches=[];
   for(const id of ids.stdout.trim().split(/\s+/).filter(Boolean)){
    const x=spawnSync('docker',['inspect',id],{encoding:'utf8'});
    if(x.status!==0)continue;
    const c=JSON.parse(x.stdout)[0];
    if((c.NetworkSettings?.Ports?.['3306/tcp']||[]).some(b=>b.HostPort===port)&&/^mysql(?::|@)/.test(c.Config?.Image||''))matches.push(id);
   }
   if(matches.length!==1)throw Error('Cannot identify unique MySQL container; stopped');
   command='docker';prefix=['exec','-e','MYSQL_PWD',matches[0],'mysqldump'];host='127.0.0.1';dumpPort='3306';
  }
  const dest=path.join(backup,'before-nullable-eta.sql');
  const fd=openSync(dest,'wx',0o600);
  let result;
  try{result=spawnSync(command,[...prefix,'--no-defaults','--protocol=TCP','-h',host,'-P',dumpPort,'-u',decodeURIComponent(u.username),'--single-transaction','--skip-lock-tables','--no-tablespaces','--set-gtid-purged=OFF','--hex-blob',db],{env:{...process.env,MYSQL_PWD:decodeURIComponent(u.password)},stdio:['ignore',fd,'pipe'],timeout:300000});}finally{closeSync(fd)}
  if(result.error||result.status!==0||statSync(dest).size<1024)throw Error('Database backup failed; migration not executed (credentials suppressed)');
  const content=readFileSync(dest);
  if(!content.toString().includes('-- Dump completed on'))throw Error('Incomplete database backup; stopped');
  writeFileSync(dest+'.sha256',createHash('sha256').update(content).digest('hex')+'\n',{mode:0o600,flag:'wx'});
  await prisma.$disconnect();
  const require=createRequire(import.meta.url);
  const migrated=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy'],{cwd:root,env:process.env,encoding:'utf8',timeout:300000});
  if(migrated.error||migrated.status!==0)throw Error('Migration did not finish; inspect database migration history; backup retained');
  const after=await prisma.$queryRawUnsafe("SELECT IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sailingschedule' AND COLUMN_NAME='eta'");
  if(after[0]?.nullable!=='YES')throw Error('ETA compatibility verification failed');
  console.log('Database backed up; only nullable ETA migration applied');
 }
} catch(error){ console.error(error instanceof Error && error.constructor === Error ? error.message : 'Database compatibility operation failed; credentials suppressed'); process.exitCode=1; }
finally{await prisma.$disconnect()}
