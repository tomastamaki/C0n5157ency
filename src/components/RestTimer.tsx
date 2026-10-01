import { useEffect, useRef, useState } from "react";
import { playBeep, vibrate } from "../lib/feedback";

interface Props {
  /** Marca de cuándo arrancó el descanso actual (persistida en la sesión), o null si no hay uno en curso. */
  restStartedAt: string | null;
  targetLabel?: string | null;
}

/** Descanso por defecto (segundos) cuando el programa no especifica uno para el ejercicio: el timer siempre tiene que ser una cuenta regresiva, nunca solo contar para arriba. */
const DEFAULT_REST_SECONDS = 60;

/** Extrae segundos del límite inferior de un rango tipo "1-2 min" o "30-60 sec". */
function parseRestSeconds(label?: string | null): number | null {
  if (!label) return null;
  const match = label.match(/(\d+)(?:\s*-\s*\d+)?\s*(sec|seg|min)/i);
  if (!match) return null;
  const lower = Number(match[1]);
  if (Number.isNaN(lower)) return null;
  return match[2].toLowerCase().startsWith("min") ? lower * 60 : lower;
}

export function RestTimer({ restStartedAt, targetLabel }: Props) {
  const targetSec = parseRestSeconds(targetLabel) ?? DEFAULT_REST_SECONDS;
  // Guarda el restStartedAt ya alertado, para sonar una sola vez por descanso sin importar cuántas veces se remonte el componente.
  const alertedForRef = useRef<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!restStartedAt) return;
    const interval = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(interval);
  }, [restStartedAt]);

  const elapsedSec = restStartedAt ? Math.floor((Date.now() - new Date(restStartedAt).getTime()) / 1000) : 0;

  useEffect(() => {
    if (!restStartedAt || alertedForRef.current === restStartedAt || elapsedSec < targetSec) return;
    alertedForRef.current = restStartedAt;
    playBeep();
    vibrate([120, 60, 120]);
  }, [restStartedAt, elapsedSec, targetSec]);

  if (!restStartedAt) return null;

  const remaining = targetSec - elapsedSec;
  const overtime = remaining <= 0;
  const displaySec = Math.abs(remaining);
  const m = Math.floor(displaySec / 60);
  const s = displaySec % 60;

  return (
    <div
      className={`flex items-center gap-2 rounded-block px-3 py-2 text-sm ${
        overtime ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
      }`}
    >
      <span className="font-mono text-base font-semibold tabular-nums">
        {overtime && "+"}
        {m}:{s.toString().padStart(2, "0")}
      </span>
      <span>{overtime ? "descanso listo · podés seguir" : `descanso · objetivo ${targetLabel ?? "1 min"}`}</span>
    </div>
  );
}
