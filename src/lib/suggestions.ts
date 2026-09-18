import type { LogsData } from "../types/logs";
import { findLastLoggedSet } from "./history";

export interface WeightSuggestion {
  weightKg: number;
  reason: string;
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Sugerencia de peso para la próxima vez que aparezca la misma prescripción
 * de serie (mismo ejercicio + mismo índice de serie), en base al RIR logrado
 * la última vez:
 * - RIR 3+ (sobraron reps): subir el incremento completo del ejercicio.
 * - RIR 1-2 (rango esperado): progresión mínima (medio incremento).
 * - RIR 0 (fallo): mantener el mismo peso.
 */
export function getWeightSuggestion(
  logs: LogsData,
  exerciseName: string,
  setIndex: number,
  beforeGlobalSeq: number,
  incrementKg: number
): WeightSuggestion | null {
  const last = findLastLoggedSet(logs, exerciseName, setIndex, beforeGlobalSeq);
  if (!last || last.weightKg === null || last.rir === null) return null;

  if (last.rir === "3+") {
    return {
      weightKg: roundToStep(last.weightKg + incrementKg, 0.5),
      reason: "subiste RIR 3+ la última vez",
    };
  }

  if (last.rir === "0") {
    return {
      weightKg: last.weightKg,
      reason: "llegaste al fallo (RIR 0) la última vez",
    };
  }

  return {
    weightKg: roundToStep(last.weightKg + incrementKg / 2, 0.5),
    reason: `RIR ${last.rir} la última vez`,
  };
}
