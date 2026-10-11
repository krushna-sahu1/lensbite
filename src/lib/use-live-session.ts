"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LiveSessionController } from "./live-session";

/** React binding for LiveSessionController. One controller per component. */
export function useLiveSession() {
  const [controller] = useState(() => new LiveSessionController());
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  // Make sure the mic/camera are released if the page unmounts mid-session.
  useEffect(() => () => controller.end(), [controller]);

  return { controller, state };
}
