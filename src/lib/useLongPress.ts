import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const LONG_PRESS_MS = 450;
const MOVE_THRESHOLD_PX = 10;

interface LongPressHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
}

/**
 * Distingue un tap de "mantener presionado" (450ms, sin moverse) sobre el
 * mismo elemento: toca -> `onTap`; mantiene -> `onLongPress` (y se cancela
 * el tap posterior, para que no se disparen los dos).
 */
export function useLongPress(onTap: (() => void) | undefined, onLongPress: (() => void) | undefined): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function onPointerDown(e: ReactPointerEvent) {
    start.current = { x: e.clientX, y: e.clientY };
    fired.current = false;
    clear();
    if (!onLongPress) return;
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) clear();
  }

  function onPointerUp() {
    clear();
    if (!fired.current) onTap?.();
    fired.current = false;
    start.current = null;
  }

  function onPointerCancel() {
    clear();
    fired.current = false;
    start.current = null;
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave: onPointerCancel };
}
