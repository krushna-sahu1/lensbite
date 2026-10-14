/**
 * Supabase project URL and publishable (anon) key. Both are public by design:
 * the browser uses them directly, and Row Level Security keeps each user's rows
 * private. Written out in full so Next.js inlines them into the client bundle.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase isn't configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local (or your Vercel project's environment variables) and restart.",
    );
  }
  return { url, key };
}
