"use client";

import { useState, useSyncExternalStore } from "react";
import { CameraIcon, GoogleIcon, SparkIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

const noSubscribe = () => () => {};

/** Set just before the Google round trip; the callback route reads and clears it. */
const NEXT_COOKIE = "lensbite-next";

function rememberNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return;
  document.cookie = `${NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=600; SameSite=Lax`;
}

/** A query parameter of the current URL (null while server rendering). */
function useQueryParam(name: string): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}

export default function LoginPage() {
  const callbackError = useQueryParam("error");
  const next = useQueryParam("next");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setSigningIn(true);
    setError(null);
    // Carry the page the user was trying to reach through the OAuth round trip.
    rememberNext(next);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser is already navigating to Google; only failures land here.
    if (error) {
      setError(error.message);
      setSigningIn(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh w-full flex-col justify-center overflow-hidden px-4 pb-16 pt-[max(env(safe-area-inset-top),1.5rem)]">
      {/* Soft background glow. */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 size-80 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-16 size-64 rounded-full bg-protein/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-16 items-center justify-center rounded-3xl bg-foreground text-background shadow-xl">
            <CameraIcon width={28} height={28} />
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">
            Lens<span className="text-accent-ink">Bite</span>
          </h1>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-muted">
            Point your camera at your food and ask. The AI tells you what&apos;s in it and logs it for you.
          </p>
        </div>

        <ul className="mt-8 space-y-2.5">
          <Feature text="Talk it through — ask follow-ups mid-bite" />
          <Feature text="Scan a nutrition label and get a 0–10 score" />
          <Feature text="Weekly and monthly insights from your log" />
        </ul>

        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={signingIn}
          aria-busy={signingIn}
          className="mt-8 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-foreground px-5 text-base font-semibold text-background shadow-xl transition active:scale-[0.98] disabled:opacity-60"
        >
          {signingIn ? (
            <>
              <span
                className="h-5 w-5 animate-spin rounded-full border-2 border-background/40 border-t-background"
                aria-hidden="true"
              />
              Signing in…
            </>
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>
        <p className="mt-3 text-center text-xs text-muted">
          We only use your Google account to sign you in. Nothing is posted there.
        </p>

        {(error || callbackError) && (
          <p role="alert" className="mt-4 rounded-2xl bg-fat/15 px-4 py-3 text-center text-sm text-fat-ink">
            {error || callbackError}
          </p>
        )}
      </div>
    </main>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface/70 px-4 py-3 text-sm shadow-card ring-1 ring-line backdrop-blur">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
        <SparkIcon width={14} height={14} />
      </span>
      <span className="min-w-0">{text}</span>
    </li>
  );
}
