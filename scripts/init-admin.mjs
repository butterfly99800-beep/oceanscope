import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

if (process.env.OCEANSCOPE_INIT_ADMIN !== 'true') throw new Error('Set OCEANSCOPE_INIT_ADMIN=true explicitly.');
const email = process.env.INIT_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.INIT_ADMIN_PASSWORD;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 16 || Buffer.byteLength(password) > 72) {
  throw new Error('Provide a valid INIT_ADMIN_EMAIL and a unique password of at least 16 characters, at most 72 UTF-8 bytes.');
}
const prisma = new PrismaClient();
try {
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new Error('Account already exists; no password, role or status was changed.');
  await prisma.user.create({ data: { email, name: 'OceanScope Admin', passwordHash: await bcrypt.hash(password, 12), role: 'ADMIN', status: 'ACTIVE' } });
  console.log('Administrator created. Remove the one-time initialization variables from the environment.');
} catch (error) {
  console.error(error?.code === 'P2002' ? 'Account already exists; unchanged.' : 'Administrator creation refused or failed; check configuration and database availability.');
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
