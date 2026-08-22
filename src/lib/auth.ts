import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sends a 6-digit login code to the given email. shouldCreateUser: false means only an
 * account that already exists in Supabase Auth can log in — nobody can self-register.
 */
export async function sendLoginCode(client: SupabaseClient, email: string): Promise<void> {
  const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) throw error;
}

export async function verifyLoginCode(client: SupabaseClient, email: string, code: string): Promise<void> {
  const { error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error;
}

export async function signOut(client: SupabaseClient): Promise<void> {
  await client.auth.signOut();
}
