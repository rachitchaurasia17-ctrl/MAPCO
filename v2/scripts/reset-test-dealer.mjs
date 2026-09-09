import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lswzrkvdwirhvggtvuch.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const email = 'demo-owner@mapco.dev';
  const password = process.env.MAPCO_TEST_DEALER_PASSWORD;
  if (!password) throw new Error('MAPCO_TEST_DEALER_PASSWORD is required.');

  // 1. Get all users to see if it exists
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Failed to list users:', listError);
    return;
  }

  let user = usersData.users.find(u => u.email === email);

  if (user) {
    console.log(`User ${email} found (id: ${user.id}). Resetting password...`);
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true
    });
    if (updateError) {
      console.error('Failed to update password:', updateError);
    } else {
      console.log('Password reset successfully.');
    }
  } else {
    console.log(`User ${email} not found.`);
  }
}

main();
