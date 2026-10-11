/**
 * POST /api/token
 *
 * Creates a short-lived Gemini Live *ephemeral token* so the browser can open a
 * Live API WebSocket without ever seeing GEMINI_API_KEY.
 * Docs: https://ai.google.dev/gemini-api/docs/ephemeral-tokens
 *
 * Optional protection: if ACCESS_CODE is set, the request must send the same
 * value in the `x-access-code` header (entered once in the app's Settings).
 * Without it, anyone who finds your deployed URL could spend your quota.
 */
import { GoogleGenAI } from "@google/genai";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "The server is missing GEMINI_API_KEY. Add it to .env.local (or your Vercel project's environment variables) and restart." },
      { status: 500 },
    );
  }

  const accessCode = process.env.ACCESS_CODE;
  if (accessCode && request.headers.get("x-access-code") !== accessCode) {
    return Response.json(
      { error: "Access code missing or wrong. Enter it in Settings." },
      { status: 401 },
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
        // We deliberately don't set `liveConnectConstraints`: locking the config
        // on the server would override the client's system prompt, which has to
        // include today's totals from localStorage.
      },
    });

    return Response.json({ token: token.name }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Failed to create ephemeral token", err);
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Couldn't create a session token: ${message}` }, { status: 502 });
  }
}
