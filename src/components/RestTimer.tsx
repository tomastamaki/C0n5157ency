import { useEffect, useState } from "react";

interface Props {
  /** Cambiar este número reinicia y arranca el cronómetro (ej. al loguear una serie). */
  startSignal: number;
  targetLabel?: string | null;
}

export function RestTimer({ startSignal, targetLabel }: Props) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (startSignal === 0) return;
    setElapsedSec(0);
    const start = Date.now();
    const interval = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [startSignal]);

  if (startSignal === 0) return null;

  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700 dark:bg-accent-900/30 dark:text-accent-300">
      <span className="font-mono text-base font-semibold tabular-nums">
        {m}:{s.toString().padStart(2, "0")}
      </span>
      <span>descanso{targetLabel ? ` · objetivo ${targetLabel}` : ""}</span>
    </div>
  );
}
