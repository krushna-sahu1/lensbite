"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const noSubscribe = () => () => {};

/** A query parameter of the current URL (null while server rendering). */
function useQueryParam(name: string): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}

export default function LoginPage() {
  const linkError = useQueryParam("error");
  const next = useQueryParam("next");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email) return;
    setSending(true);
    setError(null);
    const confirmUrl = new URL("/auth/confirm", window.location.origin);
    if (next) confirmUrl.searchParams.set("next", next);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: confirmUrl.toString() },
    });
    setSending(false);
    if (error) setError(error.message);
    else setSentTo(email);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 pb-16 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <h1 className="text-center text-3xl font-semibold tracking-tight">
        Lens<span className="text-accent-ink">Bite</span>
      </h1>
      <p className="mt-1 text-center text-sm text-muted">Sign in to see your food log.</p>

      <section className="mt-8 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line">
        {sentTo ? (
          <div className="text-center" role="status">
            <h2 className="font-semibold">Check your email</h2>
            <p className="mt-1 text-sm text-muted">
              We sent a sign-in link to <span className="font-medium text-foreground">{sentTo}</span>. Open it on this
              device.
            </p>
            <button
              type="button"
              onClick={() => setSentTo(null)}
              className="mt-4 rounded-full px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-track"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={sendLink}>
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                placeholder="you@example.com"
                className="mt-2 w-full rounded-xl border border-line bg-background px-3 py-2.5 outline-none focus:border-accent-ink"
              />
            </label>
            <button
              type="submit"
              disabled={sending}
              className="mt-4 w-full rounded-full bg-foreground py-3 font-semibold text-background transition active:scale-[0.98] disabled:opacity-60"
            >
              {sending ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
        )}
      </section>

      {(error || linkError) && (
        <p role="alert" className="mt-4 rounded-2xl bg-fat/15 px-4 py-3 text-center text-sm text-fat-ink">
          {error || linkError}
        </p>
      )}
    </main>
  );
}
