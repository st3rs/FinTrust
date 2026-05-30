import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = rawUrl && rawUrl.startsWith('http') ? rawUrl : 'https://placeholder-project.supabase.co';
const supabaseAnonKey = rawKey || 'placeholder-anon-key';

if (!rawUrl || !rawKey) {
  console.warn('Supabase URL and Anon Key are missing. Falling back to placeholder credentials to prevent app crash.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

