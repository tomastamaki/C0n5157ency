import type { LogsData } from "../types/logs";
import { rirToNumber } from "../types/logs";
import { findRecentLoggedSets } from "./history";
import { estimatedE1RM } from "./e1rm";

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
 * - Mismo peso que la vez anterior a esa, pero con más reps o más RIR
 *   (e1RM mejoró): progreso real aunque el peso no haya subido, también
 *   justifica el incremento completo.
 * - RIR 1-2 (rango esperado): progresión mínima (medio incremento).
 * - RIR 0 (fallo), sin mejora previa al mismo peso: mantener el mismo peso.
 */
export function getWeightSuggestion(
  logs: LogsData,
  exerciseName: string,
  setIndex: number,
  beforeGlobalSeq: number,
  incrementKg: number
): WeightSuggestion | null {
  const [last, prior] = findRecentLoggedSets(logs, exerciseName, setIndex, beforeGlobalSeq, 2);
  if (!last || last.weightKg === null || last.rir === null) return null;

  const improvedAtSameWeight =
    prior &&
    prior.weightKg === last.weightKg &&
    prior.reps !== null &&
    prior.rir !== null &&
    last.reps !== null &&
    estimatedE1RM(last.weightKg, last.reps, rirToNumber(last.rir)) >
      estimatedE1RM(prior.weightKg as number, prior.reps, rirToNumber(prior.rir));

  if (last.rir === "3+" || improvedAtSameWeight) {
    return {
      weightKg: roundToStep(last.weightKg + incrementKg, 0.5),
      reason:
        last.rir === "3+"
          ? "subiste RIR 3+ la última vez"
          : "mejoraste reps/esfuerzo al mismo peso la última vez",
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
