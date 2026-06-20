import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vrekigsesnqdhexflbcj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZWtpZ3Nlc25xZGhleGZsYmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTk0NjUsImV4cCI6MjA5MjI3NTQ2NX0.V_lzEcvieG8vrJCA8jeXmEJ95CKtQi5AkSa6n0HKBLo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedUser() {
  console.log('Attempting to create user tejamallam1233@gmail.com...');
  const { data, error } = await supabase.auth.signUp({
    email: 'tejamallam1233@gmail.com',
    password: 'Tejamallam12333@gmail.com',
  });

  if (error) {
    console.error('Error seeding user:', error.message);
    process.exit(1);
  } else {
    console.log('User created successfully!');
    console.log('User Details:', data.user);
  }
}

seedUser();
