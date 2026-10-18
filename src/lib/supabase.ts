import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let client: SupabaseClient | undefined;
export function getSupabase() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error('Konfigurasi Supabase belum tersedia. Lengkapi .env.local.');
    client = createClient(url, key);
  }
  return client;
}
