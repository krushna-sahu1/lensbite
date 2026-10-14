/**
 * Camera + microphone access and camera frame capture.
 */
import { FRAME_JPEG_QUALITY, FRAME_MAX_SIZE } from "./config";

export interface MediaResult {
  stream: MediaStream;
  /** Set when we got the mic but not the camera (we continue voice-only). */
  cameraError?: string;
}

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  // Echo cancellation keeps the agent from hearing (and interrupting) itself.
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: "environment" }, // rear camera on phones
  // Full HD where available so label mode has enough pixels for small print.
  width: { ideal: 1920 },
  height: { ideal: 1080 },
};

/** Ask for mic + rear camera. Falls back to mic-only if the camera fails. */
export async function getMicAndCamera(): Promise<MediaResult> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "Camera and microphone need a secure (HTTPS) connection. Open the app via https:// or http://localhost.",
    );
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: AUDIO_CONSTRAINTS,
      video: VIDEO_CONSTRAINTS,
    });
    return { stream };
  } catch (bothError) {
    // Either device could have failed. Try the mic alone so voice still works.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
      return { stream, cameraError: describeMediaError(bothError, "camera") };
    } catch (micError) {
      throw new Error(describeMediaError(micError, "microphone"));
    }
  }
}

/** Turn a getUserMedia error into a human-friendly message. */
export function describeMediaError(err: unknown, device: "camera" | "microphone"): string {
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return `Permission to use the ${device} was denied. Allow it in your browser's site settings (the icon next to the address bar), then try again.`;
    case "NotFoundError":
    case "OverconstrainedError":
      return `No ${device} was found on this device.`;
    case "NotReadableError":
    case "AbortError":
      return `The ${device} is being used by another app. Close it and try again.`;
    default:
      return `Couldn't start the ${device}${err instanceof Error ? `: ${err.message}` : "."}`;
  }
}

/** Grabs downscaled JPEG frames from a <video> element. */
export class FrameGrabber {
  private canvas = document.createElement("canvas");

  /** Returns base64 JPEG (no data: prefix), or null if the video isn't ready. */
  capture(video: HTMLVideoElement | null, maxSize = FRAME_MAX_SIZE, quality = FRAME_JPEG_QUALITY): string | null {
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
    const { videoWidth: w, videoHeight: h } = video;
    if (!w || !h) return null;

    const scale = Math.min(1, maxSize / Math.max(w, h));
    this.canvas.width = Math.round(w * scale);
    this.canvas.height = Math.round(h * scale);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high"; // keeps small text crisper when downscaling
    ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
    const dataUrl = this.canvas.toDataURL("image/jpeg", quality);
    return dataUrl.slice(dataUrl.indexOf(",") + 1);
  }
}
