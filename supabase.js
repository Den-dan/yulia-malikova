const SUPABASE_URL = 'https://eabrqsbxmyojojnozpov.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ghNtYZHR2m2h2RBOvXrX_w_Ech7-bFV';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);