"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LiveSessionController, LiveState } from "@/lib/live-session";
import { useLiveSession } from "@/lib/use-live-session";
import { LiveView } from "./LiveView";

type LiveSessionContextValue = {
  controller: LiveSessionController;
  state: LiveState;
};

const LiveSessionContext = createContext<LiveSessionContextValue | null>(null);

/**
 * Owns the one live session for the app, so the Live tab in the bottom nav can
 * start it from any page. The full-screen LiveView is rendered from here too.
 */
export function LiveSessionProvider({ children }: { children: ReactNode }) {
  const { controller, state } = useLiveSession();

  return (
    <LiveSessionContext.Provider value={{ controller, state }}>
      {children}
      {state.status !== "idle" && <LiveView controller={controller} state={state} />}
    </LiveSessionContext.Provider>
  );
}

export function useLiveSessionContext(): LiveSessionContextValue {
  const value = useContext(LiveSessionContext);
  if (!value) throw new Error("useLiveSessionContext must be used inside LiveSessionProvider");
  return value;
}
