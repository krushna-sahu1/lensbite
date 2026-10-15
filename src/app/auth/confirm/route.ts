/**
 * GET /auth/confirm
 *
 * Where the magic link in the sign-in email lands. Turns the link into a
 * session cookie, then redirects into the app (or back to /login with the
 * reason it failed). Handles both link styles:
 * - `?code=…` from Supabase's default email template (PKCE; the link has to be
 *   opened in the browser that asked for it), and
 * - `?token_hash=…&type=email` from a custom template (works in any browser).
 */
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Only same-site paths, so the link can't bounce the user to another site.
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  let error = searchParams.get("error_description");
  if (!error) {
    const supabase = await createClient();
    if (code) {
      error = (await supabase.auth.exchangeCodeForSession(code)).error?.message ?? null;
    } else if (tokenHash && type) {
      error = (await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error?.message ?? null;
    } else {
      error = "That sign-in link is incomplete.";
    }
  }

  if (!error) return NextResponse.redirect(new URL(safeNext, request.url));

  const login = new URL("/login", request.url);
  login.searchParams.set("error", `Couldn't sign you in: ${error.replace(/\.?$/, ".")} Request a new link below.`);
  return NextResponse.redirect(login);
}
