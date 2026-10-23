"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./use-reduced-motion";

/**
 * Eases a displayed number towards `target` whenever the target changes.
 * Starts from zero on mount so the first paint counts up, and snaps straight
 * to the value when the phone asks for reduced motion.
 */
export function useCountUp(target: number, duration = 700): number {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (reduced) {
      from.current = target;
      const frame = requestAnimationFrame(() => setDisplay(target));
      return () => cancelAnimationFrame(frame);
    }
    if (from.current === target) {
      const frame = requestAnimationFrame(() => setDisplay(target));
      return () => cancelAnimationFrame(frame);
    }

    let frame = 0;
    const start = performance.now();
    const origin = from.current;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = origin + (target - origin) * eased;
      from.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else {
        from.current = target;
        setDisplay(target);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);

  return display;
}
