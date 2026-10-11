/**
 * Browser audio plumbing for the Live session:
 *  - MicStreamer: microphone -> 16 kHz 16-bit PCM chunks (base64) via an AudioWorklet
 *  - PcmPlayer:   base64 24 kHz PCM chunks from Gemini -> speakers, gap-free,
 *                 with an instant stop() for barge-in
 *
 * Both classes create their AudioContext in the constructor. Construct them
 * synchronously inside a user tap (the "Go Live" button) so iOS Safari allows
 * audio to start.
 */
import { MIC_SAMPLE_RATE, SPEAKER_SAMPLE_RATE } from "./config";

// ---------------------------------------------------------------------------
// base64 helpers
// ---------------------------------------------------------------------------

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000; // avoid "too many arguments" on large buffers
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToInt16(b64: string): Int16Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  // PCM from Gemini is little-endian, same as every browser platform.
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
}

// ---------------------------------------------------------------------------
// Microphone
// ---------------------------------------------------------------------------

export class MicStreamer {
  private ctx = new AudioContext();
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;

  constructor() {
    void this.ctx.resume();
  }

  /** Starts emitting ~100 ms chunks of base64 PCM plus an RMS level (0..1). */
  async start(stream: MediaStream, onChunk: (base64: string, rms: number) => void) {
    await this.ctx.audioWorklet.addModule("/worklets/pcm-recorder.js");
    await this.ctx.resume();

    this.source = this.ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    this.node = new AudioWorkletNode(this.ctx, "pcm-recorder", {
      processorOptions: { targetRate: MIC_SAMPLE_RATE, chunkSize: MIC_SAMPLE_RATE / 10 },
    });
    this.node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; rms: number }>) => {
      onChunk(bytesToBase64(new Uint8Array(e.data.pcm)), e.data.rms);
    };

    // Some browsers only run nodes that are connected to the destination,
    // so route through a muted gain node (we never want to hear ourselves).
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.source.connect(this.node);
    this.node.connect(mute);
    mute.connect(this.ctx.destination);
  }

  async close() {
    if (this.node) this.node.port.onmessage = null;
    this.source?.disconnect();
    this.node?.disconnect();
    await this.ctx.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Speaker
// ---------------------------------------------------------------------------

export class PcmPlayer {
  private ctx = new AudioContext({ sampleRate: SPEAKER_SAMPLE_RATE });
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();

  /** Called whenever playback starts or stops (used for the "speaking" UI). */
  onPlayingChange?: (playing: boolean) => void;

  constructor() {
    void this.ctx.resume();
  }

  get playing() {
    return this.sources.size > 0;
  }

  /** Queue a chunk of base64 PCM right after whatever is already scheduled. */
  enqueue(base64: string, mimeType = "") {
    const pcm = base64ToInt16(base64);
    if (pcm.length === 0) return;
    const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1]) || SPEAKER_SAMPLE_RATE;

    const buffer = this.ctx.createBuffer(1, pcm.length, rate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 0x8000;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);

    // If we fell behind (network hiccup), restart slightly in the future to avoid clicks.
    const startAt = Math.max(this.ctx.currentTime + 0.03, this.nextStartTime);
    src.start(startAt);
    this.nextStartTime = startAt + buffer.duration;

    const wasPlaying = this.playing;
    this.sources.add(src);
    if (!wasPlaying) this.onPlayingChange?.(true);
    src.onended = () => {
      this.sources.delete(src);
      if (!this.playing) this.onPlayingChange?.(false);
    };
  }

  /** Barge-in: drop everything that's playing or queued, immediately. */
  stop() {
    const wasPlaying = this.playing;
    for (const src of this.sources) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.nextStartTime = 0;
    if (wasPlaying) this.onPlayingChange?.(false);
  }

  async close() {
    this.stop();
    await this.ctx.close().catch(() => {});
  }
}
