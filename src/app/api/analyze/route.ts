/**
 * POST /api/analyze  { text?: string, image?: { data: base64, mimeType } }
 *
 * Estimates the nutrition of a described or photographed meal with a regular
 * (non-live) Gemini call, for logging without starting a voice session.
 * Signed-in users only, subject to the allowlist and a daily per-user limit
 * (ANALYZE_REQUESTS_PER_DAY, default 60).
 */
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  ANALYZE_IMAGE_MAX_BASE64,
  ANALYZE_RESPONSE_SCHEMA,
  ANALYZE_SYSTEM_INSTRUCTION,
  ANALYZE_TEXT_MAX,
  sanitizeAnalyzeResult,
} from "@/lib/analyze";
import { ANALYZE_FALLBACK_MODEL, ANALYZE_MODEL } from "@/lib/config";
import { checkAllowlist, envLimit, geminiKey, requireUser } from "@/lib/server/guard";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const NO_STORE = { "Cache-Control": "no-store" };
/** Give up on one model after this long and try the fallback. */
const MODEL_TIMEOUT_MS = 20_000;

// Two model attempts plus the database checks.
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const denied = checkAllowlist(user);
  if (denied) return denied;
  const apiKey = geminiKey();
  if (apiKey instanceof Response) return apiKey;

  // --- validate input --------------------------------------------------------
  let body: { text?: unknown; image?: { data?: unknown; mimeType?: unknown } };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON with a description and/or a photo." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const image =
    body.image && typeof body.image.data === "string" && typeof body.image.mimeType === "string"
      ? { data: body.image.data, mimeType: body.image.mimeType }
      : null;
  if (!text && !image) return Response.json({ error: "Describe the food or add a photo." }, { status: 400 });
  if (text.length > ANALYZE_TEXT_MAX) {
    return Response.json({ error: `Keep the description under ${ANALYZE_TEXT_MAX} characters.` }, { status: 400 });
  }
  if (image && (!IMAGE_TYPES.has(image.mimeType) || image.data.length > ANALYZE_IMAGE_MAX_BASE64)) {
    return Response.json({ error: "That photo is too large or not a supported image." }, { status: 400 });
  }

  // --- daily limit ------------------------------------------------------------
  const { data: used, error: usageError } = await user.supabase.rpc("claim_ai_usage", { p_kind: "analyze" });
  if (usageError) {
    console.error("claim_ai_usage failed", usageError);
    return Response.json(
      { error: "Couldn't check your daily limit. If you run this app, apply the latest Supabase migration." },
      { status: 500 },
    );
  }
  if (used > envLimit("ANALYZE_REQUESTS_PER_DAY", 60)) {
    return Response.json(
      { error: "You've reached today's limit for AI estimates. It resets at midnight UTC." },
      { status: 429, headers: NO_STORE },
    );
  }

  // --- ask Gemini ----------------------------------------------------------------
  const ai = new GoogleGenAI({ apiKey });
  const parts = [
    ...(image ? [{ inlineData: { data: image.data, mimeType: image.mimeType } }] : []),
    { text: text ? `What I ate: ${text}` : "Estimate the food in this photo." },
  ];
  // The primary model is sometimes overloaded (503) or slow; then try the fallback once.
  const models = [...new Set([ANALYZE_MODEL, ANALYZE_FALLBACK_MODEL])];
  let lastError: unknown;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: ANALYZE_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: ANALYZE_RESPONSE_SCHEMA,
          temperature: 0.2,
          // Estimating a plate doesn't need long reasoning; low thinking keeps it quick.
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          httpOptions: { timeout: MODEL_TIMEOUT_MS },
        },
      });
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(response.text ?? "{}");
      } catch {
        console.warn("analyze: model returned non-JSON", response.text?.slice(0, 200));
      }
      return Response.json(sanitizeAnalyzeResult(parsed), { headers: NO_STORE });
    } catch (err) {
      lastError = err;
      console.warn(`analyze: ${model} failed`, err instanceof Error ? err.message : err);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  const quota = /quota|resource[_ ]exhausted|"code":429/i.test(message);
  return Response.json(
    {
      error: quota
        ? "Gemini quota exceeded. Try again later."
        : "The AI is busy right now and couldn't estimate that. Try again in a minute, or add it by hand.",
    },
    { status: quota ? 429 : 503, headers: NO_STORE },
  );
}
