import { useEffect, useState } from "react";
import { formatDuration } from "../lib/time";

interface Props {
  /** Segundos acumulados hasta la última pausa (o el total, si no está corriendo). */
  pausedElapsedSec: number;
  /** Marca desde la que corre el cronómetro; null si está en pausa. */
  runningSince: string | null;
}

function computeElapsed(pausedElapsedSec: number, runningSince: string | null): number {
  if (!runningSince) return Math.max(0, Math.round(pausedElapsedSec));
  const extra = (Date.now() - new Date(runningSince).getTime()) / 1000;
  return Math.max(0, Math.round(pausedElapsedSec + extra));
}

export function SessionTimer({ pausedElapsedSec, runningSince }: Props) {
  const [elapsedSec, setElapsedSec] = useState(() => computeElapsed(pausedElapsedSec, runningSince));

  useEffect(() => {
    setElapsedSec(computeElapsed(pausedElapsedSec, runningSince));
    if (!runningSince) return;
    const interval = window.setInterval(() => {
      setElapsedSec(computeElapsed(pausedElapsedSec, runningSince));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [pausedElapsedSec, runningSince]);

  return (
    <span className="font-mono tabular-nums">
      {formatDuration(elapsedSec)}
      {!runningSince && <span className="ml-1 text-xs text-amber-500">(en pausa)</span>}
    </span>
  );
}
