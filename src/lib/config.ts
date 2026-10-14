/**
 * App-wide constants. Shared by the browser code and the /api/token route.
 */
import { MediaResolution } from "@google/genai";

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

/**
 * Label mode (reading a package's nutrition table / ingredients): sharper, less
 * compressed frames so small print survives. Same 1 fps rate.
 */
export const LABEL_FRAME_MAX_SIZE = 1536;
export const LABEL_FRAME_JPEG_QUALITY = 0.9;
/** Label mode switches itself off this long after the last label-related activity. */
export const LABEL_MODE_TIMEOUT_MS = 60 * 1000;

/**
 * How many tokens Gemini spends per camera frame. At the default, video frames
 * get ~70 tokens each, too few to read small print however sharp the JPEG is.
 * HIGH (~280 tokens/frame) makes labels legible but uses ~4x the video tokens.
 * Set to MEDIA_RESOLUTION_UNSPECIFIED for the API default if you don't scan labels.
 */
export const LIVE_MEDIA_RESOLUTION = MediaResolution.MEDIA_RESOLUTION_HIGH;

/** Audio formats required by the Live API. */
export const MIC_SAMPLE_RATE = 16000; // input: 16-bit PCM, 16 kHz, mono
export const SPEAKER_SAMPLE_RATE = 24000; // output: 16-bit PCM, 24 kHz, mono

/** How many times we try to transparently reconnect a dropped session. */
export const MAX_RECONNECT_ATTEMPTS = 3;
