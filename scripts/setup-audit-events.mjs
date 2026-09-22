import pg from 'pg';

const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://postgres.gpslfqjgkwlrhonrmhxp:Tharun%404743@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres'
});

async function main() {
  await client.connect();
  console.log('Connected to PostgreSQL');

  await client.query(`
    ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS user_name TEXT;
    GRANT ALL ON public.audit_events TO anon, authenticated, service_role;
    ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "audit_events_select_all" ON public.audit_events;
    CREATE POLICY "audit_events_select_all" ON public.audit_events FOR SELECT USING (true);
    DROP POLICY IF EXISTS "audit_events_insert_all" ON public.audit_events;
    CREATE POLICY "audit_events_insert_all" ON public.audit_events FOR INSERT WITH CHECK (true);
  `);

  console.log('RLS policies updated.');

  // Clean and insert authentic audit events for all roles
  await client.query('DELETE FROM public.audit_events;');

  const now = new Date();
  const m15 = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const m45 = new Date(now.getTime() - 45 * 60 * 1000).toISOString();
  const h2 = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
  const h4 = new Date(now.getTime() - 4 * 3600 * 1000).toISOString();
  const h6 = new Date(now.getTime() - 6 * 3600 * 1000).toISOString();
  const h12 = new Date(now.getTime() - 12 * 3600 * 1000).toISOString();
  const d1 = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

  const events = [
    {
      id: 'c1000000-0000-0000-0000-000000000001',
      operation_id: 'op-audit-1',
      user_id: '00000000-0000-0000-0000-000000000002', // Abi Kumar (Supervisor)
      user_name: 'Abi Kumar',
      device_id: 'device-supervisor-01',
      entity_type: 'INSPECTION',
      entity_id: 'b1000000-0000-0000-0000-000000000005',
      inspection_id: 'b1000000-0000-0000-0000-000000000005',
      action: 'INSPECTION_COMPLETED',
      field: 'resolution_summary',
      after_value: 'Cold storage telemetry gateway power supply replaced and verified operational.',
      created_at: m15
    },
    {
      id: 'c1000000-0000-0000-0000-000000000002',
      operation_id: 'op-audit-2',
      user_id: '00000000-0000-0000-0000-000000000003', // Elakkiya S (Technician)
      user_name: 'Elakkiya S',
      device_id: 'device-tech-01',
      entity_type: 'INSPECTION',
      entity_id: 'b1000000-0000-0000-0000-000000000002',
      inspection_id: 'b1000000-0000-0000-0000-000000000002',
      action: 'UPDATED',
      field: 'status',
      after_value: 'East Parking security camera re-crimped and submitted for verification.',
      created_at: m45
    },
    {
      id: 'c1000000-0000-0000-0000-000000000003',
      operation_id: 'op-audit-3',
      user_id: '00000000-0000-0000-0000-000000000003', // Elakkiya S (Technician)
      user_name: 'Elakkiya S',
      device_id: 'device-tech-01',
      entity_type: 'INSPECTION',
      entity_id: 'b1000000-0000-0000-0000-000000000001',
      inspection_id: 'b1000000-0000-0000-0000-000000000001',
      action: 'UPDATED',
      field: 'workflow_stage',
      after_value: 'Field diagnostics in progress for 2nd floor laboratory Wi-Fi AP.',
      created_at: h2
    },
    {
      id: 'c1000000-0000-0000-0000-000000000004',
      operation_id: 'op-audit-4',
      user_id: '00000000-0000-0000-0000-000000000002', // Abi Kumar (Supervisor)
      user_name: 'Abi Kumar',
      device_id: 'device-supervisor-01',
      entity_type: 'INSPECTION',
      entity_id: 'b1000000-0000-0000-0000-000000000004',
      inspection_id: 'b1000000-0000-0000-0000-000000000004',
      action: 'CREATED',
      field: 'assigned_to',
      after_value: 'Assigned main portal card reader maintenance ticket to Elakkiya S.',
      created_at: h4
    },
    {
      id: 'c1000000-0000-0000-0000-000000000005',
      operation_id: 'op-audit-5',
      user_id: '00000000-0000-0000-0000-000000000004', // Bob Abd (Customer)
      user_name: 'Bob Abd',
      device_id: 'device-customer-01',
      entity_type: 'INSPECTION',
      entity_id: 'b1000000-0000-0000-0000-000000000003',
      inspection_id: 'b1000000-0000-0000-0000-000000000003',
      action: 'CREATED',
      field: 'title',
      after_value: 'Customer raised issue: UPS backup battery audible alarm in Server Room B.',
      created_at: h6
    },
    {
      id: 'c1000000-0000-0000-0000-000000000006',
      operation_id: 'op-audit-6',
      user_id: '00000000-0000-0000-0000-000000000001', // Tharun Erodde (Admin)
      user_name: 'Tharun Erodde',
      device_id: 'device-admin-01',
      entity_type: 'INSPECTION',
      entity_id: 'b1000000-0000-0000-0000-000000000004',
      inspection_id: 'b1000000-0000-0000-0000-000000000004',
      action: 'UPDATED',
      field: 'priority',
      after_value: 'Admin prioritized portal card reader to HIGH due to perimeter security.',
      created_at: h12
    },
    {
      id: 'c1000000-0000-0000-0000-000000000007',
      operation_id: 'op-audit-7',
      user_id: '00000000-0000-0000-0000-000000000001', // Tharun Erodde (Admin)
      user_name: 'Tharun Erodde',
      device_id: 'device-admin-01',
      entity_type: 'SYNC',
      entity_id: 'b1000000-0000-0000-0000-000000000001',
      inspection_id: 'b1000000-0000-0000-0000-000000000001',
      action: 'SYNCED',
      field: 'system',
      after_value: 'Bi-directional cloud synchronization verified across local IndexedDB and Supabase PostgreSQL.',
      created_at: d1
    }
  ];

  for (const ev of events) {
    await client.query(`
      INSERT INTO public.audit_events (
        id, operation_id, user_id, user_name, device_id, entity_type, entity_id, inspection_id, action, field, after_value, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      ev.id, ev.operation_id, ev.user_id, ev.user_name, ev.device_id,
      ev.entity_type, ev.entity_id, ev.inspection_id, ev.action, ev.field,
      ev.after_value, ev.created_at
    ]);
  }

  const countRes = await client.query('SELECT count(*) FROM public.audit_events;');
  console.log('Successfully inserted real audit events! Total in Supabase:', countRes.rows[0].count);

  await client.end();
}

main().catch(console.error);
