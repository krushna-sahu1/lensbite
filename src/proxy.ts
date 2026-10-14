/**
 * Runs before every page and API request: keeps the Supabase session fresh and
 * redirects to /login when signed out. Data access is still enforced by Row
 * Level Security in the database, not here.
 */
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets (including the mic AudioWorklet), so they load without a session check.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|worklets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js)$).*)"],
};
