import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection parameters
const host = process.env.PGHOST || 'aws-0-ap-southeast-2.pooler.supabase.com';
const port = parseInt(process.env.PGPORT || '6543', 10);
const database = process.env.PGDATABASE || 'postgres';
const user = process.env.PGUSER || 'postgres.gpslfqjgkwlrhonrmhxp';
const password = process.argv[2] || process.env.PGPASSWORD || 'qu7Z99BnHJ4PL3xsnc-AX7E5uQ0';

async function runSeed() {
  console.log(`Connecting to PostgreSQL at ${host}:${port} (${database}) as ${user}...`);
  const client = new Client({
    host,
    port,
    database,
    user,
    password,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Successfully connected to Supabase PostgreSQL database!');

    const sqlPath = path.resolve(__dirname, '../supabase/schema.sql');
    console.log(`Reading SQL file from ${sqlPath}...`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing schema and seed SQL...');
    await client.query(sql);
    console.log('✓ Schema and 5 sample real records for all roles created successfully!');

    // Verification queries
    console.log('\n--- Verifying Created Data ---');
    const usersRes = await client.query('SELECT id, email, role, full_name FROM public.users ORDER BY email;');
    console.log(`✓ Users in public.users (${usersRes.rows.length}):`);
    usersRes.rows.forEach(u => console.log(`   - [${u.role}] ${u.full_name} (${u.email})`));

    const assetsRes = await client.query('SELECT id, asset_code, name, location FROM public.assets ORDER BY asset_code;');
    console.log(`\n✓ Industrial Assets (${assetsRes.rows.length}):`);
    assetsRes.rows.forEach(a => console.log(`   - [${a.asset_code}] ${a.name} @ ${a.location}`));

    const inspRes = await client.query('SELECT id, title, category, status, workflow_stage FROM public.inspections ORDER BY id;');
    console.log(`\n✓ Inspections (${inspRes.rows.length}):`);
    inspRes.rows.forEach(i => console.log(`   - [${i.category} | ${i.workflow_stage}] ${i.title}`));

    const checklistCount = await client.query('SELECT count(*) FROM public.checklist_items;');
    console.log(`\n✓ Checklist items created: ${checklistCount.rows[0].count}`);

  } catch (err) {
    console.error('❌ Database error:', err.message);
    if (err.message.includes('password authentication failed')) {
      console.error('\nNOTE: The database password is required to run this script directly.');
      console.error('Usage: node scripts/seed-supabase.mjs <YOUR_SUPABASE_DB_PASSWORD>');
      console.error('Alternatively, copy and paste supabase/schema.sql into your Supabase Dashboard -> SQL Editor.');
    }
  } finally {
    await client.end();
  }
}

runSeed();
