import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const BUCKET = 'plantes-photos';

let client: SupabaseClient | null = null;

/** Client Supabase créé à la demande (évite une erreur au build si les variables manquent). */
export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        'Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes.'
      );
    }
    client = createClient(url, key);
  }
  return client;
}

export function photoUrl(path?: string | null): string | null {
  if (!path) return null;
  return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
