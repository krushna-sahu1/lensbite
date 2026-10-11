/**
 * LiveSessionController: everything that happens while "Live".
 *
 *   mic ──16 kHz PCM──┐
 *   camera ─1 fps JPEG─┼──▶ Gemini Live (WebSocket, ephemeral token)
 *                      │        │
 *   speaker ◀─24 kHz PCM────────┤  audio replies (stopped instantly on barge-in)
 *   transcript ◀───────────────┤  input/output transcriptions
 *   localStorage ◀─tool calls──┘  log_meal / get_today_summary / delete_last_meal
 *
 * It's a plain class (not a React hook) so the many moving parts live in one
 * place. React subscribes to its state via `useLiveSession()`.
 */
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { MicStreamer, PcmPlayer } from "./audio";
import {
  FRAME_INTERVAL_MS,
  LIVE_MODEL,
  MAX_RECONNECT_ATTEMPTS,
  SILENCE_TIMEOUT_MS,
  SILENCE_WARNING_MS,
  VOICE_NAME,
} from "./config";
import { FrameGrabber, getMicAndCamera } from "./media";
import { buildSystemInstruction } from "./prompt";
import { getAccessCode, getSnapshot } from "./storage";
import { runTool, TOOL_DECLARATIONS } from "./tools";

export type LiveStatus =
  | "idle" // nothing running, overlay hidden
  | "starting" // asking for camera/mic
  | "connecting" // opening the Gemini session
  | "live"
  | "reconnecting"
  | "ended" // finished on its own (e.g. silence timeout) — show a message
  | "error"; // something went wrong — show the error

export interface TranscriptEntry {
  id: number;
  role: "user" | "model" | "event";
  text: string;
  /** False while the speaker is still talking (text keeps streaming in). */
  final: boolean;
}

export interface LiveState {
  status: LiveStatus;
  /** Error or end-of-session message shown on the overlay. */
  message?: string;
  /** Non-fatal warning, e.g. "camera unavailable, voice only". */
  notice?: string;
  transcript: TranscriptEntry[];
  modelSpeaking: boolean;
  /** Mic loudness 0..1 for the level indicator. */
  micLevel: number;
  /** Seconds until auto-end, shown only near the silence timeout. */
  silenceCountdown: number | null;
  stream: MediaStream | null;
}

const INITIAL_STATE: LiveState = {
  status: "idle",
  transcript: [],
  modelSpeaking: false,
  micLevel: 0,
  silenceCountdown: null,
  stream: null,
};

const CONNECT_TIMEOUT_MS = 15_000;
const MAX_TRANSCRIPT_ENTRIES = 60;

export class LiveSessionController {
  private state: LiveState = INITIAL_STATE;
  private listeners = new Set<() => void>();

  private session: Session | null = null;
  private mic: MicStreamer | null = null;
  private player: PcmPlayer | null = null;
  private frames: FrameGrabber | null = null;
  private video: HTMLVideoElement | null = null;
  private wakeLock: WakeLockSentinel | null = null;

  private frameTimer: ReturnType<typeof setInterval> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  /** Bumped on every connect/teardown so callbacks from stale sockets are ignored. */
  private generation = 0;
  /** Set once the session is being torn down; every async step checks it. */
  private stopped = true;
  private resumeHandle: string | null = null;
  private reconnectAttempts = 0;
  private reconnecting = false;
  private connectedAt = 0;
  private lastActivity = 0;
  private nextEntryId = 1;

  // --- tiny external store API for React --------------------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = () => this.state;

  private set(patch: Partial<LiveState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Callback ref for the <video> preview element. */
  attachVideo = (el: HTMLVideoElement | null) => {
    this.video = el;
    if (el && this.state.stream && el.srcObject !== this.state.stream) {
      el.srcObject = this.state.stream;
      void el.play().catch(() => {});
    }
  };

  // --- lifecycle ---------------------------------------------------------------

  /** Call directly from a click handler (needed for audio on iOS). */
  async start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.resumeHandle = null;
    this.reconnectAttempts = 0;
    this.nextEntryId = 1;
    this.set({ ...INITIAL_STATE, status: "starting" });

    // Create audio contexts synchronously, while we're still inside the user's tap.
    this.player = new PcmPlayer();
    this.player.onPlayingChange = (playing) => this.set({ modelSpeaking: playing });
    this.mic = new MicStreamer();
    this.frames = new FrameGrabber();

    try {
      // 1. Camera + mic
      const { stream, cameraError } = await getMicAndCamera();
      if (this.stopped) return stream.getTracks().forEach((t) => t.stop());
      this.set({ stream, notice: cameraError ? `${cameraError} Continuing with voice only.` : undefined });
      this.attachVideo(this.video);
      // If the user revokes permission or unplugs the mic mid-session.
      stream.getAudioTracks()[0]?.addEventListener("ended", () => this.fail("The microphone stopped."));

      // 2. Mic -> PCM chunks -> Gemini
      await this.mic.start(stream, (pcm, rms) => this.onMicChunk(pcm, rms));
      if (this.stopped) return;

      // 3. Open the Live session
      this.set({ status: "connecting" });
      await this.connect();
      if (this.stopped) return;

      this.set({ status: "live" });
      this.lastActivity = Date.now();
      this.frameTimer = setInterval(() => this.sendFrame(), FRAME_INTERVAL_MS);
      this.tickTimer = setInterval(() => this.tick(), 1000);
      void this.requestWakeLock();
    } catch (err) {
      this.fail(err instanceof Error ? err.message : String(err));
    }
  }

  /** User tapped "End": tear down and hide the overlay. */
  end() {
    this.teardown();
    this.set({ ...INITIAL_STATE });
  }

  /** Hide the "ended"/"error" overlay. */
  dismiss() {
    if (this.stopped) this.set({ ...INITIAL_STATE });
  }

  /** Session ended by itself (e.g. silence). Keeps the overlay up with a message. */
  private finish(message: string) {
    if (this.stopped) return;
    this.teardown();
    this.set({ status: "ended", message, stream: null, modelSpeaking: false, micLevel: 0, silenceCountdown: null });
  }

  private fail(message: string) {
    if (this.stopped) return;
    console.warn("[live] error:", message);
    this.teardown();
    this.set({ status: "error", message, stream: null, modelSpeaking: false, micLevel: 0, silenceCountdown: null });
  }

  /** Idempotent cleanup of every resource. */
  private teardown() {
    this.stopped = true;
    this.generation++;
    if (this.frameTimer) clearInterval(this.frameTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.frameTimer = this.tickTimer = null;

    try {
      this.session?.close();
    } catch {
      /* already closed */
    }
    this.session = null;

    void this.mic?.close();
    void this.player?.close();
    this.mic = this.player = this.frames = null;

    this.state.stream?.getTracks().forEach((t) => t.stop());
    if (this.video) this.video.srcObject = null;

    void this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
  }

  // --- Gemini connection ---------------------------------------------------------

  private async connect() {
    const gen = ++this.generation;
    const token = await fetchToken();
    if (gen !== this.generation) return;

    // The ephemeral token is used in place of an API key.
    const ai = new GoogleGenAI({ apiKey: token });
    const connecting = ai.live.connect({
      model: LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } },
        // Rebuilt on every connect so it includes the latest totals.
        systemInstruction: buildSystemInstruction(getSnapshot()),
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        // Text transcripts of both sides, for the on-screen transcript.
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        // Without compression, audio+video sessions are cut off after ~2 minutes.
        contextWindowCompression: { slidingWindow: {} },
        // Lets us reconnect (server GoAway / network blips) without losing the conversation.
        sessionResumption: this.resumeHandle ? { handle: this.resumeHandle } : {},
      },
      callbacks: {
        onmessage: (msg) => {
          if (gen === this.generation) this.handleMessage(msg);
        },
        onerror: (e) => {
          if (gen === this.generation) console.warn("[live] socket error", e);
        },
        onclose: (e) => {
          if (gen === this.generation) this.handleClose(e);
        },
      },
    });

    const session = await withTimeout(connecting, CONNECT_TIMEOUT_MS, "Timed out connecting to Gemini.");
    if (gen !== this.generation) {
      session.close();
      return;
    }
    this.session = session;
    this.connectedAt = Date.now();
  }

  private handleClose(e: CloseEvent) {
    if (this.stopped) return;
    this.session = null;
    console.info("[live] closed", e.code, e.reason);

    const reason = e.reason || "";
    if (isQuotaError(reason)) {
      return this.fail("Gemini quota exceeded (free-tier limit). Try again later, or check your usage in Google AI Studio.");
    }
    // 1007/1008 = invalid request/auth problems: retrying won't help.
    const fatal = e.code === 1007 || e.code === 1008;
    if (fatal || this.state.status === "connecting") {
      return this.fail(`Session closed${reason ? `: ${reason}` : "."}`);
    }

    // A session that stayed up a while earns a fresh set of retries.
    if (Date.now() - this.connectedAt > 30_000) this.reconnectAttempts = 0;
    void this.reconnect();
  }

  /** Reconnect with the session-resumption handle, keeping mic/camera running. */
  private async reconnect() {
    if (this.reconnecting || this.stopped) return;
    this.reconnecting = true;
    this.set({ status: "reconnecting" });

    const old = this.session;
    this.session = null;
    this.generation++; // ignore anything the old socket still sends
    try {
      old?.close();
    } catch {
      /* ignore */
    }
    // Model audio from the old connection may have been cut mid-sentence.
    this.player?.stop();

    try {
      while (!this.stopped) {
        this.reconnectAttempts++;
        try {
          await this.connect();
          if (this.stopped) return;
          this.set({ status: "live" });
          return;
        } catch (err) {
          if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            return this.fail(`Lost connection to Gemini. ${err instanceof Error ? err.message : ""}`.trim());
          }
          await new Promise((r) => setTimeout(r, 1000 * this.reconnectAttempts));
        }
      }
    } finally {
      this.reconnecting = false;
    }
  }

  private handleMessage(msg: LiveServerMessage) {
    // Keep the newest resumption handle so we can reconnect seamlessly.
    if (msg.sessionResumptionUpdate?.resumable && msg.sessionResumptionUpdate.newHandle) {
      this.resumeHandle = msg.sessionResumptionUpdate.newHandle;
    }

    // Server is about to close this connection (they last ~10 min). Move to a new one.
    if (msg.goAway) {
      console.info("[live] goAway, time left:", msg.goAway.timeLeft);
      void this.reconnect();
      return;
    }

    if (msg.toolCall?.functionCalls?.length) {
      this.markActivity();
      const results = msg.toolCall.functionCalls.map(runTool);
      results.forEach((r) => r.event && this.addEvent(r.event));
      this.safeSend(() => this.session?.sendToolResponse({ functionResponses: results.map((r) => r.response) }));
    }

    const content = msg.serverContent;
    if (!content) return;

    // Barge-in: the server detected the user speaking over the model.
    if (content.interrupted) {
      this.player?.stop();
      this.finalize("model");
    }

    for (const part of content.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (data && part.inlineData?.mimeType?.startsWith("audio/")) {
        this.player?.enqueue(data, part.inlineData.mimeType);
        this.markActivity();
      }
    }

    if (content.inputTranscription?.text) {
      this.markActivity();
      this.appendTranscript("user", content.inputTranscription.text);
    }
    if (content.outputTranscription?.text) {
      this.finalize("user"); // the model is answering, so the user's turn is done
      this.appendTranscript("model", content.outputTranscription.text);
    }
    if (content.turnComplete) this.finalize("model");
  }

  // --- streaming out ------------------------------------------------------------

  private onMicChunk(pcm: string, rms: number) {
    // Smooth-ish level meter; only re-render when it changes noticeably.
    const level = Math.min(1, rms * 6);
    if (Math.abs(level - this.state.micLevel) > 0.04) this.set({ micLevel: level });
    if (this.state.status !== "live") return;
    this.safeSend(() => this.session?.sendRealtimeInput({ audio: { data: pcm, mimeType: "audio/pcm;rate=16000" } }));
  }

  private sendFrame() {
    if (this.state.status !== "live" || document.hidden) return;
    const jpeg = this.frames?.capture(this.video);
    if (!jpeg) return;
    this.safeSend(() => this.session?.sendRealtimeInput({ video: { data: jpeg, mimeType: "image/jpeg" } }));
  }

  /** Sending on a socket that's closing throws; the onclose handler deals with it. */
  private safeSend(fn: () => void) {
    try {
      fn();
    } catch (err) {
      console.debug("[live] send failed", err);
    }
  }

  // --- silence timeout ----------------------------------------------------------

  private markActivity() {
    this.lastActivity = Date.now();
  }

  /** Runs every second: auto-end after SILENCE_TIMEOUT_MS of no conversation. */
  private tick() {
    if (this.stopped) return;
    if (this.player?.playing || this.state.status === "reconnecting") this.markActivity();
    const left = SILENCE_TIMEOUT_MS - (Date.now() - this.lastActivity);
    if (left <= 0) {
      this.finish("Session ended after 2 minutes of silence to save your quota.");
      return;
    }
    const countdown = left <= SILENCE_WARNING_MS ? Math.ceil(left / 1000) : null;
    if (countdown !== this.state.silenceCountdown) this.set({ silenceCountdown: countdown });
  }

  // --- transcript -----------------------------------------------------------------

  private appendTranscript(role: "user" | "model", text: string) {
    const list = this.state.transcript;
    const last = list.at(-1);
    let next: TranscriptEntry[];
    if (last && last.role === role && !last.final) {
      next = [...list.slice(0, -1), { ...last, text: last.text + text }];
    } else {
      next = [...list, { id: this.nextEntryId++, role, text: text.trimStart(), final: false }];
    }
    this.set({ transcript: next.slice(-MAX_TRANSCRIPT_ENTRIES) });
  }

  private finalize(role: "user" | "model") {
    const list = this.state.transcript;
    if (!list.some((e) => e.role === role && !e.final)) return;
    this.set({ transcript: list.map((e) => (e.role === role && !e.final ? { ...e, final: true } : e)) });
  }

  private addEvent(text: string) {
    this.finalize("user");
    this.set({
      transcript: [...this.state.transcript, { id: this.nextEntryId++, role: "event" as const, text, final: true }].slice(
        -MAX_TRANSCRIPT_ENTRIES,
      ),
    });
  }

  // --- misc -------------------------------------------------------------------------

  /** Keep the phone screen on while live (best effort). */
  private async requestWakeLock() {
    try {
      this.wakeLock = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      /* not supported or denied — fine */
    }
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function fetchToken(): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/token", { method: "POST", headers: { "x-access-code": getAccessCode() } });
  } catch {
    throw new Error("Can't reach the server. Check your internet connection.");
  }
  const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok || !body.token) throw new Error(body.error || `Token request failed (${res.status}).`);
  return body.token;
}

function isQuotaError(reason: string) {
  return /quota|resource[_ ]exhausted|rate limit/i.test(reason);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}
