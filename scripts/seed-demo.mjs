import 'dotenv/config';
if (process.env.NODE_ENV === 'production' || process.env.OCEANSCOPE_ALLOW_DEMO_SEED !== 'true') {
  throw new Error('Demo seed refused. Development only; requires OCEANSCOPE_ALLOW_DEMO_SEED=true.');
}
await import('../prisma/seed.mjs');
