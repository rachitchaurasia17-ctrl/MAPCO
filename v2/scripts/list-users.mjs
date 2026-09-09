import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lswzrkvdwirhvggtvuch.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { data: usersData } = await supabase.auth.admin.listUsers();
  console.log('--- ALL USERS ---');
  for (const u of usersData.users) {
      console.log(`Email: ${u.email} ID: ${u.id}`);
  }

  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log('--- ALL PROFILES ---');
  console.log(profiles);
}
main();
