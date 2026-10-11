/**
 * App-wide constants. Shared by the browser code and the /api/token route.
 */

/** Current recommended Gemini Live model (see https://ai.google.dev/gemini-api/docs/models). */
export const LIVE_MODEL = "gemini-3.8-live";

/** Prebuilt voice for the agent's replies. Other options include "Puck", "Charon", "Aoede". */
export const VOICE_NAME = "Kore";

/** End the session automatically after this much silence (saves free-tier quota). */
export const SILENCE_TIMEOUT_MS = 2 * 60 * 1000;

/** Start showing an "auto-ending in Ns" countdown this long before the silence timeout. */
export const SILENCE_WARNING_MS = 20 * 1000;

/** Camera frames: the Live API accepts at most ~1 JPEG frame per second. */
export const FRAME_INTERVAL_MS = 1000;
export const FRAME_MAX_SIZE = 768; // longest edge in px
export const FRAME_JPEG_QUALITY = 0.6;

/** Audio formats required by the Live API. */
export const MIC_SAMPLE_RATE = 16000; // input: 16-bit PCM, 16 kHz, mono
export const SPEAKER_SAMPLE_RATE = 24000; // output: 16-bit PCM, 24 kHz, mono

/** How many times we try to transparently reconnect a dropped session. */
export const MAX_RECONNECT_ATTEMPTS = 3;
