import { useRef, useState } from "react";
import { IconSkipForward } from "../icons";

const REVEAL = 84;
const THRESHOLD = 0.4;

interface SwipeToSkipProps {
  onSkip: () => void;
  children: React.ReactNode;
}

/** Envoltorio de gesto: deslizar a la izquierda revela "Saltear"; pasado el 40% del ancho, saltea al soltar. */
export function SwipeToSkip({ onSkip, children }: SwipeToSkipProps) {
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    dragging.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current || startX.current === null) return;
    const delta = e.clientX - startX.current;
    setDragX(Math.max(-REVEAL, Math.min(0, delta)));
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragX <= -REVEAL * THRESHOLD) onSkip();
    setDragX(0);
  }

  return (
    <div className="relative overflow-hidden rounded-card">
      <div className="absolute inset-y-0 right-0 flex w-[84px] flex-col items-center justify-center gap-1 bg-warning/20 text-xs font-extrabold text-warning">
        <IconSkipForward className="h-5 w-5" />
        Saltear
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${dragX}px)`, transition: dragging.current ? "none" : "transform 0.2s ease-out" }}
        className="touch-pan-y"
      >
        {children}
      </div>
    </div>
  );
}
