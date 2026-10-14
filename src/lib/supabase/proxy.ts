/**
 * Session handling for src/proxy.ts: refreshes the Supabase auth cookies on
 * every request and sends signed-out visitors to /login.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/** Pages that work without a session. */
const PUBLIC_PATHS = ["/login", "/auth"];

export async function updateSession(request: NextRequest) {
  const { url, key } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        // Pass refreshed tokens on to the route being rendered *and* back to the browser.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // No-cache headers, so a CDN never serves one user's cookies to another.
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Verifies the JWT (and refreshes it if it's about to expire). Don't put code
  // between createServerClient and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;

  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // API routes answer 401 themselves; redirecting a fetch() to an HTML page would just confuse it.
  const isApi = pathname.startsWith("/api/");

  if (!signedIn && !isPublic && !isApi) return redirectKeepingCookies(request, response, "/login", pathname + search);
  if (signedIn && pathname === "/login") return redirectKeepingCookies(request, response, "/");
  return response;
}

function redirectKeepingCookies(request: NextRequest, response: NextResponse, to: string, next?: string) {
  const target = request.nextUrl.clone();
  target.pathname = to;
  target.search = "";
  if (next && next !== "/") target.searchParams.set("next", next);
  const redirect = NextResponse.redirect(target);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(name);
    if (value) redirect.headers.set(name, value);
  }
  return redirect;
}
