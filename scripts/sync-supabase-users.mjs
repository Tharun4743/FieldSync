import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gpslfqjgkwlrhonrmhxp.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwc2xmcWpna3dscmhvbnJtaHhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDA3ODUyMCwiZXhwIjoyMTA1NjU0NTIwfQ.cCIS36Du9PWrhQFFdwPv9MYLQLoWLzNpLH4r-z6L1xo';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log('--- Fetching existing Supabase Auth users ---');
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', error);
    return;
  }
  console.log(`Found ${users.length} users in auth.users:`);
  for (const u of users) {
    console.log(`- ${u.id}: ${u.email} (confirmed_at: ${u.email_confirmed_at})`);
  }

  const targetUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'tharun@gmail.com',
      password: '123456',
      fullName: 'Tharun Erodde',
      role: 'ADMIN'
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'abi@gmail.com',
      password: '123456',
      fullName: 'Abi Kumar',
      role: 'SUPERVISOR'
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      email: 'elakkiya@gmail.com',
      password: '123456',
      fullName: 'Elakkiya S',
      role: 'TECHNICIAN'
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      email: 'customer@company.com',
      password: '123456',
      fullName: 'Bob Abd',
      role: 'CUSTOMER'
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      email: 'rajesh@fieldsync.io',
      password: '123456',
      fullName: 'Rajesh M',
      role: 'TECHNICIAN'
    }
  ];

  // Delete old dummy accounts if present to strictly enforce <= 5 users in database
  const dummyEmails = ['admin@gmail.com', 'supervisor@gmail.com', 'technician@gmail.com'];
  for (const dummyEmail of dummyEmails) {
    const dummyUser = users.find(u => u.email?.toLowerCase() === dummyEmail.toLowerCase());
    if (dummyUser) {
      console.log(`Deleting obsolete dummy account: ${dummyEmail} (${dummyUser.id})...`);
      await supabaseAdmin.auth.admin.deleteUser(dummyUser.id);
    }
  }

  for (const target of targetUsers) {
    const existing = users.find(u => u.email?.toLowerCase() === target.email.toLowerCase());
    let userId = target.id;

    if (existing) {
      console.log(`User ${target.email} exists (id: ${existing.id}). Updating password & confirming email...`);
      userId = existing.id;
      const { data: updated, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        existing.id,
        {
          password: target.password,
          email_confirm: true,
          user_metadata: {
            full_name: target.fullName,
            role: target.role
          }
        }
      );
      if (updateErr) {
        console.error(`Failed to update ${target.email}:`, updateErr);
      } else {
        console.log(`Successfully updated ${target.email}!`);
      }
    } else {
      console.log(`User ${target.email} does not exist. Creating...`);
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        id: target.id,
        email: target.email,
        password: target.password,
        email_confirm: true,
        user_metadata: {
          full_name: target.fullName,
          role: target.role
        }
      });
      if (createErr) {
        console.error(`Failed to create ${target.email} with fixed id:`, createErr.message);
        // Try creating without specifying id
        const { data: created2, error: createErr2 } = await supabaseAdmin.auth.admin.createUser({
          email: target.email,
          password: target.password,
          email_confirm: true,
          user_metadata: {
            full_name: target.fullName,
            role: target.role
          }
        });
        if (createErr2) {
          console.error(`Failed to create ${target.email} without fixed id:`, createErr2);
        } else {
          userId = created2.user.id;
          console.log(`Created ${target.email} with id: ${userId}`);
        }
      } else {
        userId = created.user.id;
        console.log(`Created ${target.email} with fixed id: ${userId}`);
      }
    }

    // Now upsert into public.users / public.profiles table
    console.log(`Upserting public.users for ${target.email}...`);
    const { error: upsertErr } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        email: target.email,
        full_name: target.fullName,
        role: target.role,
        updated_at: new Date().toISOString()
      });

    if (upsertErr) {
      console.warn(`Note on public.users upsert: ${upsertErr.message}`);
    } else {
      console.log(`public.users synced for ${target.email}`);
    }
  }

  // Now test sign in with client anon key
  console.log('\n--- Testing Client Login with Anon Key ---');
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwc2xmcWpna3dscmhvbnJtaHhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzg1MjAsImV4cCI6MjEwNTY1NDUyMH0.sOwGnmWSb53SQAzE8fCb4B-SAWBqiWhWkTTM5BD49NI';
  const supabaseClient = createClient(SUPABASE_URL, ANON_KEY);

  for (const target of targetUsers) {
    const { data, error: signInErr } = await supabaseClient.auth.signInWithPassword({
      email: target.email,
      password: target.password
    });
    if (signInErr) {
      console.error(`FAIL: Login failed for ${target.email}:`, signInErr.message);
    } else {
      console.log(`SUCCESS: Login successful for ${target.email} (User ID: ${data.user.id})`);
    }
  }
}

main().catch(console.error);
