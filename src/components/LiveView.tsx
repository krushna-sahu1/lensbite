"use client";

import { useCallback, useEffect, useRef } from "react";
import type { LiveSessionController, LiveState } from "@/lib/live-session";
import { CloseIcon, LabelIcon, MicIcon } from "./icons";
import { ProductCard } from "./ProductCard";

const STATUS_LABEL: Record<LiveState["status"], string> = {
  idle: "",
  starting: "Starting camera & mic…",
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  ended: "Session ended",
  error: "Something went wrong",
};

/** Full-screen live camera view with transcript and controls. */
export function LiveView({ controller, state }: { controller: LiveSessionController; state: LiveState }) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  // Callback ref: hands the <video> element to the controller so it can show the stream.
  const videoRef = useCallback((el: HTMLVideoElement | null) => controller.attachVideo(el), [controller]);
  const hasCamera = !!state.stream?.getVideoTracks().length;
  const busy = state.status === "starting" || state.status === "connecting";
  const over = state.status === "ended" || state.status === "error";

  // Keep the newest transcript line in view.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.transcript]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black text-white" role="dialog" aria-label="Live session">
      {/* Camera preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${hasCamera ? "opacity-100" : "opacity-0"}`}
      />
      {!hasCamera && !over && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex size-32 items-center justify-center rounded-full bg-white/5">
            <MicIcon width={40} height={40} className="text-white/60" />
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="relative z-10 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="flex flex-col gap-2">
          {!over && (
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-sm font-medium backdrop-blur">
              <span
                className={`size-2 rounded-full ${
                  state.status === "live" ? "animate-pulse bg-red-500" : "animate-pulse bg-amber-400"
                }`}
              />
              {STATUS_LABEL[state.status]}
            </span>
          )}
          {state.silenceCountdown !== null && (
            <span className="w-fit rounded-full bg-amber-500/90 px-3 py-1 text-xs font-medium text-black">
              No one talking: ending in {state.silenceCountdown}s
            </span>
          )}
        </div>
        {!over && (
          <div className="flex items-center gap-2">
            {/* Label mode: sharper frames for reading small print. The agent also turns it on by itself. */}
            <button
              type="button"
              onClick={() => controller.toggleLabelMode()}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium backdrop-blur transition ${
                state.labelMode ? "bg-accent text-black" : "bg-black/40 hover:bg-black/60"
              }`}
              aria-pressed={state.labelMode}
            >
              <LabelIcon width={18} height={18} />
              Label
            </button>
            <button
              type="button"
              onClick={() => controller.end()}
              className="rounded-full bg-black/40 p-2.5 backdrop-blur transition hover:bg-black/60"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        )}
      </header>

      {state.notice && !over && (
        <p className="relative z-10 mx-4 rounded-2xl bg-amber-500/90 px-4 py-2.5 text-sm text-black">{state.notice}</p>
      )}

      {/* Product card for the current label scan (scrolls if it doesn't fit) */}
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {!over && state.product && (
          <ProductCard key={state.product.ratedAt} product={state.product} onClose={() => controller.dismissProduct()} />
        )}
        {!over && !state.product && state.labelMode && (
          <p className="mx-auto w-fit rounded-full bg-black/50 px-3.5 py-1.5 text-center text-xs text-white/85 backdrop-blur">
            Label mode: fill the screen with the label and hold steady
          </p>
        )}
      </div>

      {/* Transcript + controls */}
      {!over && (
        <footer
          className={`relative z-10 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] ${
            state.product ? "pt-4" : "pt-16"
          }`}
        >
          {/* Shorter transcript while a product card needs the room. */}
          <div
            ref={transcriptRef}
            className={`mask-fade-top mb-4 space-y-2 overflow-y-auto pr-1 ${state.product ? "max-h-[18vh]" : "max-h-[38vh]"}`}
          >
            {state.transcript.length === 0 && state.status === "live" && (
              <p className="text-center text-sm text-white/70">
                Point at your food and ask, &ldquo;How many calories is this?&rdquo; Or show the back of a pack and
                say &ldquo;Rate this.&rdquo;
              </p>
            )}
            {state.transcript.map((entry) =>
              entry.role === "event" ? (
                <p key={entry.id} className="text-center">
                  <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-black">
                    ✓ {entry.text}
                  </span>
                </p>
              ) : (
                <div key={entry.id} className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}>
                  <p
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
                      entry.role === "user"
                        ? "rounded-br-md bg-white/20 backdrop-blur"
                        : "rounded-bl-md bg-black/50 backdrop-blur"
                    } ${entry.final ? "" : "opacity-80"}`}
                  >
                    {entry.text}
                  </p>
                </div>
              ),
            )}
          </div>

          <div className="flex items-center justify-between">
            <ActivityIndicator speaking={state.modelSpeaking} micLevel={state.micLevel} busy={busy} />
            <button
              type="button"
              onClick={() => controller.end()}
              className="flex h-16 items-center gap-2 rounded-full bg-red-600 px-8 text-lg font-semibold shadow-lg shadow-red-900/40 transition active:scale-95"
            >
              End
            </button>
            <div className="w-24" />
          </div>
        </footer>
      )}

      {busy && (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <div className="size-14 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        </div>
      )}

      {/* Ended / error card */}
      {over && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-6">
          <div className="w-full max-w-sm rounded-3xl bg-zinc-900 p-6 text-center ring-1 ring-white/10">
            <p className="text-lg font-semibold">{STATUS_LABEL[state.status]}</p>
            <p className="mt-2 text-sm text-white/70">{state.message}</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => controller.dismiss()}
                className="flex-1 rounded-full bg-white/10 py-3 font-medium transition hover:bg-white/15"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void controller.start()}
                className="flex-1 rounded-full bg-accent py-3 font-semibold text-black transition active:scale-95"
              >
                Go Live again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Left of the End button: animated bars while the AI talks, mic level otherwise. */
function ActivityIndicator({ speaking, micLevel, busy }: { speaking: boolean; micLevel: number; busy: boolean }) {
  if (busy) return <div className="w-24" />;
  return (
    <div className="flex w-24 items-center gap-2 text-xs text-white/80">
      {speaking ? (
        <>
          <span className="flex h-6 items-end gap-0.5" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-1 animate-[speak_0.9s_ease-in-out_infinite] rounded-full bg-accent"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
          Speaking
        </>
      ) : (
        <>
          <span className="relative flex size-9 items-center justify-center rounded-full bg-white/10">
            <span
              className="absolute inset-0 rounded-full bg-white/25 transition-transform duration-100"
              style={{ transform: `scale(${1 + micLevel * 0.6})`, opacity: 0.3 + micLevel }}
            />
            <MicIcon width={16} height={16} className="relative" />
          </span>
          Listening
        </>
      )}
    </div>
  );
}
