import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sends a magic login link to the given email. shouldCreateUser: false means only an
 * account that already exists in Supabase Auth can log in — nobody can self-register.
 * Clicking the link returns to the app with the session in the URL; supabase-js picks
 * it up automatically (detectSessionInUrl), no further step needed in the app.
 */
export async function sendLoginLink(client: SupabaseClient, email: string): Promise<void> {
  const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) throw error;
}

export async function signOut(client: SupabaseClient): Promise<void> {
  await client.auth.signOut();
}
