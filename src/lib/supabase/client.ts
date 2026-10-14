/**
 * Supabase client for the browser. Every query runs as the signed-in user, so
 * Row Level Security decides what it can read and write.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/** Returns the same client on every call (createBrowserClient is a singleton in the browser). */
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient<Database>(url, key);
}
