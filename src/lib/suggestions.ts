import type { LogsData } from "../types/logs";
import { rirToNumber } from "../types/logs";
import type { FlatProgramDay } from "../types/program";
import { findExerciseReferences } from "./exerciseReference";
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
 * de serie (mismo ejercicio + mismo rango de reps, sin importar en qué
 * rutina se haya hecho antes — ver `exerciseReference.ts`), en base al RIR
 * logrado la última vez:
 * - RIR 3+ (sobraron reps): subir el incremento completo del ejercicio.
 * - Mismo peso que la vez anterior a esa, pero con más reps o más RIR
 *   (e1RM mejoró): progreso real aunque el peso no haya subido, también
 *   justifica el incremento completo.
 * - RIR 1-2 (rango esperado): progresión mínima (medio incremento).
 * - RIR 0 (fallo), sin mejora previa al mismo peso: mantener el mismo peso.
 */
export function getWeightSuggestion(
  logs: LogsData,
  flatDays: FlatProgramDay[],
  exerciseName: string,
  currentDayName: string,
  targetReps: string,
  beforeGlobalSeq: number,
  incrementKg: number
): WeightSuggestion | null {
  const [last, prior] = findExerciseReferences(
    logs,
    flatDays,
    exerciseName,
    currentDayName,
    targetReps,
    beforeGlobalSeq,
    2
  );
  if (!last || last.set.weightKg === null || last.set.rir === null) return null;

  const improvedAtSameWeight =
    prior &&
    prior.set.weightKg === last.set.weightKg &&
    prior.set.reps !== null &&
    prior.set.rir !== null &&
    last.set.reps !== null &&
    estimatedE1RM(last.set.weightKg, last.set.reps, rirToNumber(last.set.rir)) >
      estimatedE1RM(prior.set.weightKg as number, prior.set.reps, rirToNumber(prior.set.rir));

  if (last.set.rir === "3+" || improvedAtSameWeight) {
    return {
      weightKg: roundToStep(last.set.weightKg + incrementKg, 0.5),
      reason:
        last.set.rir === "3+"
          ? "subiste RIR 3+ la última vez"
          : "mejoraste reps/esfuerzo al mismo peso la última vez",
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
