import { useEffect, useState } from "react";
import { formatDuration } from "../lib/time";

export function SessionTimer({ startedAtIso }: { startedAtIso: string }) {
  const [elapsedSec, setElapsedSec] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(startedAtIso).getTime()) / 1000))
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - new Date(startedAtIso).getTime()) / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [startedAtIso]);

  return <span className="font-mono tabular-nums">{formatDuration(elapsedSec)}</span>;
}
