import type { SupabaseClient } from '@supabase/supabase-js';

export async function signInWithPassword(client: SupabaseClient, email: string, password: string): Promise<void> {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(client: SupabaseClient): Promise<void> {
  await client.auth.signOut();
}
