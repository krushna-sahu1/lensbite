/**
 * Shared checks for the API routes that spend money (Gemini) or proxy other
 * services: a verified Supabase session, the optional email allowlist, and a
 * per-user daily counter kept in Supabase.
 */
import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface SignedIn {
  supabase: ServerClient;
  userId: string;
  email: string;
}

/** The signed-in user, or a 401 response to return as is. */
export async function requireUser(message = "You're signed out. Sign in again."): Promise<SignedIn | Response> {
  const supabase = await createClient();
  // getClaims() verifies the JWT signature, unlike getSession().
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return Response.json({ error: message }, { status: 401 });
  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email.toLowerCase() : "",
  };
}

/**
 * LENSBITE_ALLOWED_EMAILS limits the AI features to those accounts when set.
 * Returns a 403 response for anyone else, or null when they may continue.
 */
export function checkAllowlist(user: SignedIn): Response | null {
  const raw = process.env.LENSBITE_ALLOWED_EMAILS?.trim();
  if (!raw) return null;
  const allowed = new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  if (allowed.has(user.email)) return null;
  return Response.json(
    { error: "AI features aren't enabled for this account yet. Ask the app's owner to add your email." },
    { status: 403 },
  );
}

/** A positive integer from an environment variable, or the fallback. */
export function envLimit(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** The standard "set GEMINI_API_KEY" response, or the key. */
export function geminiKey(): string | Response {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) return apiKey;
  return Response.json(
    {
      error:
        "The server is missing GEMINI_API_KEY. Add it to .env.local (or your Vercel project's environment variables) and restart.",
    },
    { status: 500 },
  );
}
