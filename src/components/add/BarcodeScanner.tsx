"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CloseIcon } from "@/components/icons";
import { lookupBarcode } from "@/lib/api";
import { describeMediaError } from "@/lib/media";
import type { BarcodeProduct } from "@/lib/openfoodfacts";
import type { Meal } from "@/lib/types";
import { ProductLogger } from "./ProductLogger";

/** Retail barcode formats; QR codes and the like are ignored. */
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/**
 * The browser's own BarcodeDetector where it exists (Chrome on Android, Edge),
 * otherwise the zxing-wasm ponyfill (iOS Safari, Firefox), loaded on demand.
 */
async function createDetector(): Promise<Detector> {
  const native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  if (native) {
    const supported = (await native.getSupportedFormats?.().catch(() => [])) ?? [];
    if (FORMATS.some((f) => supported.includes(f))) return new native({ formats: FORMATS });
  }
  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  return new BarcodeDetector({ formats: FORMATS as never[] });
}

type Phase = { kind: "scanning" } | { kind: "looking-up"; code: string } | { kind: "found"; product: BarcodeProduct };

/** Full-screen barcode scanner: camera + detection, manual entry, then the product to log. */
export function BarcodeScanner({ open, ...props }: ScannerProps & { open: boolean }) {
  // Mounted only while open, so each scan starts fresh and the camera is released on close.
  return open ? <ScannerBody {...props} /> : null;
}

interface ScannerProps {
  onClose: () => void;
  onLogged: (meals: Meal[]) => void;
}

function ScannerBody({ onClose, onLogged }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "scanning" });
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const lookup = useCallback(async (code: string) => {
    setPhase({ kind: "looking-up", code });
    setError(null);
    try {
      setPhase({ kind: "found", product: await lookupBarcode(code) });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase({ kind: "scanning" });
    }
  }, []);

  // Camera + detection loop, only while scanning.
  useEffect(() => {
    if (phase.kind !== "scanning") return;
    const video = videoRef.current;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("The camera needs a secure (HTTPS) connection. You can still type the barcode below.");
        }
        stream = await navigator.mediaDevices
          .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } })
          .catch((err: unknown) => {
            throw new Error(`${describeMediaError(err, "camera")} You can still type the barcode below.`);
          });
        if (stopped || !video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});
        const detector = await createDetector();

        const tick = async () => {
          if (stopped) return;
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const codes = await detector.detect(video).catch(() => []);
            const code = codes.find((c) => /^\d{8,14}$/.test(c.rawValue))?.rawValue;
            if (code && !stopped) {
              navigator.vibrate?.(40);
              void lookup(code);
              return;
            }
          }
          timer = setTimeout(() => void tick(), 250);
        };
        void tick();
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    };
  }, [phase.kind, lookup]);

  function submitManual(event: FormEvent) {
    event.preventDefault();
    const code = manual.replace(/\D/g, "");
    if (code.length < 8) return setError("Enter all the digits under the barcode.");
    void lookup(code);
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Scan a barcode">
      {phase.kind === "found" ? (
        <ProductLogger
          product={phase.product}
          onBack={() => setPhase({ kind: "scanning" })}
          onClose={onClose}
          onLogged={(meals) => {
            onLogged(meals);
            onClose();
          }}
        />
      ) : (
        <>
          <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
          <header className="relative z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-[max(env(safe-area-inset-top),1rem)]">
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-md">
              {phase.kind === "looking-up" ? `Looking up ${phase.code}…` : "Point at a barcode"}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close scanner"
              className="flex size-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-md transition hover:bg-white/25"
            >
              <CloseIcon />
            </button>
          </header>

          {/* Aiming frame */}
          <div className="relative z-10 flex flex-1 items-center justify-center px-8">
            <div className="relative h-40 w-full max-w-xs rounded-3xl ring-2 ring-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-accent" />
              {phase.kind === "looking-up" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="size-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
                </div>
              )}
            </div>
          </div>

          <footer className="relative z-10 bg-gradient-to-t from-black/85 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-10">
            {error && <p className="mb-3 rounded-2xl bg-amber-500/90 px-4 py-2.5 text-sm text-black">{error}</p>}
            <form onSubmit={submitManual} className="flex gap-2">
              <label htmlFor="manual-barcode" className="sr-only">
                Barcode number
              </label>
              <input
                id="manual-barcode"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Or type the numbers"
                className="h-12 min-w-0 flex-1 rounded-2xl bg-white/15 px-4 text-white placeholder:text-white/60 outline-none backdrop-blur-md focus:bg-white/20"
              />
              <button
                type="submit"
                disabled={phase.kind === "looking-up"}
                className="h-12 rounded-2xl bg-accent px-5 font-semibold text-black transition active:scale-95 disabled:opacity-60"
              >
                Look up
              </button>
            </form>
            <p className="mt-2 text-center text-xs text-white/60">Product data from Open Food Facts</p>
          </footer>
        </>
      )}
    </div>
  );
}
