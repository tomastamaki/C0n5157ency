import { rirToNumber } from "../types/logs";
import type { SetReference } from "./exerciseReference";
import { estimatedE1RM } from "./e1rm";

export interface WeightSuggestion {
  weightKg: number;
  reason: string;
}

export function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Sugerencia de peso para la próxima vez que aparezca la misma prescripción
 * de serie, a partir de las referencias ya emparejadas por
 * `matchExerciseReferences` (fuente única — no vuelve a buscar nada), en
 * base al RIR logrado la última vez:
 * - RIR 3+ (sobraron reps): subir el incremento completo del ejercicio.
 * - Mismo peso que la vez anterior a esa, pero con más reps o más RIR
 *   (e1RM mejoró): progreso real aunque el peso no haya subido, también
 *   justifica el incremento completo.
 * - RIR 1-2 (rango esperado): progresión mínima (medio incremento).
 * - RIR 0 (fallo), sin mejora previa al mismo peso: mantener el mismo peso.
 */
export function getWeightSuggestion(last: SetReference, prior: SetReference | null, incrementKg: number): WeightSuggestion | null {
  if (!last.set || last.set.weightKg === null || last.set.rir === null) return null;

  const improvedAtSameWeight =
    prior?.set &&
    prior.set.weightKg === last.set.weightKg &&
    prior.set.reps !== null &&
    prior.set.rir !== null &&
    last.set.reps !== null &&
    estimatedE1RM(last.set.weightKg, last.set.reps, rirToNumber(last.set.rir)) >
      estimatedE1RM(prior.set.weightKg as number, prior.set.reps, rirToNumber(prior.set.rir));

  if (last.set.rir === "3+" || improvedAtSameWeight) {
    return {
      weightKg: roundToStep(last.set.weightKg + incrementKg, 0.5),
      reason: last.set.rir === "3+" ? "subiste RIR 3+ la última vez" : "mejoraste reps/esfuerzo al mismo peso la última vez",
    };
  }

  if (last.set.rir === "0") {
    return {
      weightKg: last.set.weightKg,
      reason: "llegaste al fallo (RIR 0) la última vez",
    };
  }

  return {
    weightKg: roundToStep(last.set.weightKg + incrementKg / 2, 0.5),
    reason: `RIR ${last.set.rir} la última vez`,
  };
}
