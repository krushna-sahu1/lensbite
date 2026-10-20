/**
 * GET /auth/callback
 *
 * Where Supabase sends the browser back after Google sign-in. Exchanges the
 * PKCE `code` for a session (set as cookies by the server client), then
 * redirects into the app (or back to /login with the reason it failed).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Written by the login page so a deep link survives the trip through Google. */
const NEXT_COOKIE = "lensbite-next";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");

  // Google reports a cancelled or refused sign-in with these instead of a code.
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");
  if (oauthError) {
    return backToLogin(request, `Google sign-in didn't complete: ${oauthError.replace(/\.?$/, ".")}`);
  }
  if (!code) return backToLogin(request, "That sign-in response was incomplete. Try again.");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return backToLogin(request, `Couldn't sign you in: ${error.message.replace(/\.?$/, ".")}`);

  return finish(NextResponse.redirect(new URL(safeNext(request), request.url)));
}

/** The page the user was trying to reach, if it's a same-site path. */
function safeNext(request: NextRequest): string {
  const raw = request.cookies.get(NEXT_COOKIE)?.value;
  let next = "/";
  try {
    if (raw) next = decodeURIComponent(raw);
  } catch {
    // Ignore malformed values and fall back to the home page.
  }
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function backToLogin(request: NextRequest, message: string) {
  const login = new URL("/login", request.url);
  login.searchParams.set("error", message);
  return finish(NextResponse.redirect(login));
}

/** Drops the one-shot deep-link cookie from the outgoing response. */
function finish(response: NextResponse) {
  response.cookies.delete(NEXT_COOKIE);
  return response;
}
