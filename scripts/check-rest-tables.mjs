import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gpslfqjgkwlrhonrmhxp.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwc2xmcWpna3dscmhvbnJtaHhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDA3ODUyMCwiZXhwIjoyMTA1NjU0NTIwfQ.cCIS36Du9PWrhQFFdwPv9MYLQLoWLzNpLH4r-z6L1xo';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const candidateTables = [
  'users',
  'profiles',
  'inspections',
  'assets',
  'checklist_items',
  'audit_events',
  'conflicts',
  'photos',
  'voice_notes',
  'sync_operations'
];

async function checkTables() {
  console.log('Checking Supabase REST tables...');
  for (const table of candidateTables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`- ${table}: NOT FOUND (${error.message})`);
    } else {
      console.log(`- ${table}: EXISTS (row count sample: ${data.length})`);
    }
  }
}

checkTables();
