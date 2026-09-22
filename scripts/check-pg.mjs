import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres.gpslfqjgkwlrhonrmhxp:qu7Z99BnHJ4PL3xsnc-AX7E5uQ0@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';

async function checkDb() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully!');
    const res = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Tables in public schema:', res.rows.map(r => r.table_name));
    
    // Check if users table exists
    const usersCheck = res.rows.find(r => r.table_name === 'users');
    if (usersCheck) {
      const usersRes = await client.query('SELECT id, email, full_name, role FROM public.users;');
      console.log('Rows in public.users:', usersRes.rows);
    }
  } catch (err) {
    console.error('Database connection error:', err);
  } finally {
    await client.end();
  }
}

checkDb();
