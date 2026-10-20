"use client";

import { useState, useSyncExternalStore } from "react";
import { GoogleIcon } from "@/components/icons";
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 pb-16 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <h1 className="text-center text-3xl font-semibold tracking-tight">
        Lens<span className="text-accent-ink">Bite</span>
      </h1>
      <p className="mt-1 text-center text-sm text-muted">Sign in to see your food log.</p>

      <section className="mt-8 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line">
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={signingIn}
          aria-busy={signingIn}
          className="flex w-full items-center justify-center gap-3 rounded-full bg-foreground py-3 font-semibold text-background transition active:scale-[0.98] disabled:opacity-60"
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
      </section>

      {(error || callbackError) && (
        <p role="alert" className="mt-4 rounded-2xl bg-fat/15 px-4 py-3 text-center text-sm text-fat-ink">
          {error || callbackError}
        </p>
      )}
    </main>
  );
}
