/**
 * POST /api/token
 *
 * Creates a short-lived Gemini Live *ephemeral token* so the browser can open a
 * Live API WebSocket without ever seeing GEMINI_API_KEY.
 * Docs: https://ai.google.dev/gemini-api/docs/ephemeral-tokens
 *
 * Three guards keep strangers from spending your Gemini quota:
 *  1. Only signed-in users get a token (checked from the Supabase session cookie).
 *  2. LENSBITE_ALLOWED_EMAILS, if set, limits tokens to those accounts.
 *  3. A per-user daily limit (LIVE_TOKENS_PER_DAY), counted in Supabase.
 *
 * The token is also locked to LensBite's model, system prompt and tools, so it
 * can't be used for anything else.
 */
import { GoogleGenAI, Modality } from "@google/genai";
import { LIVE_MODEL } from "@/lib/config";
import { SYSTEM_INSTRUCTION } from "@/lib/prompt";
import { createClient } from "@/lib/supabase/server";
import { TOOL_DECLARATIONS } from "@/lib/tool-declarations";

/** Each connect and reconnect uses one token; a session reconnects about every 10 minutes. */
const DEFAULT_TOKENS_PER_DAY = 40;

export async function POST() {
  // getClaims() verifies the JWT signature, unlike getSession().
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    return Response.json({ error: "You're signed out. Sign in again, then tap Go Live." }, { status: 401 });
  }

  const allowed = allowedEmails();
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
  if (allowed && !allowed.has(email)) {
    return Response.json(
      { error: "Live sessions aren't enabled for this account yet. Ask the app's owner to add your email." },
      { status: 403 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "The server is missing GEMINI_API_KEY. Add it to .env.local (or your Vercel project's environment variables) and restart." },
      { status: 500 },
    );
  }

  // Count this request against today's limit before spending anything.
  const { data: issued, error: usageError } = await supabase.rpc("claim_live_token");
  if (usageError) {
    console.error("claim_live_token failed", usageError);
    return Response.json(
      {
        error:
          "Couldn't check your daily Live limit. If you run this app, apply the latest Supabase migration (live_usage).",
      },
      { status: 500 },
    );
  }
  const limit = tokensPerDay();
  if (issued > limit) {
    return Response.json(
      { error: "You've reached today's limit for Live sessions. It resets at midnight UTC." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const now = Date.now();
    const token = await ai.authTokens.create({
      config: {
        // One Live session per token. The client fetches a new token for every
        // (re)connect, so this can stay at 1.
        uses: 1,
        // Hard cap on how long messages can be sent with this token.
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        // The session must be *started* within 1 minute.
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        // Lock the model, prompt and tools, so the token only works as LensBite.
        // The client still chooses voice, transcription, compression, resumption
        // and media resolution. Per-user context (goals, today's meals) is sent as
        // the session's first message instead of in the system prompt.
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          },
        },
        // Empty: lock exactly the fields set above.
        lockAdditionalFields: [],
      },
    });

    return Response.json({ token: token.name }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Failed to create ephemeral token", err);
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Couldn't create a session token: ${message}` }, { status: 502 });
  }
}

/** LENSBITE_ALLOWED_EMAILS as a set of lowercase emails, or null when unset (everyone may use Live). */
function allowedEmails(): Set<string> | null {
  const raw = process.env.LENSBITE_ALLOWED_EMAILS?.trim();
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function tokensPerDay(): number {
  const n = Number(process.env.LIVE_TOKENS_PER_DAY);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_TOKENS_PER_DAY;
}
