import { rirToNumber } from "../types/logs";
import type { LoggedSet } from "../types/logs";
import { estimatedE1RM, PROGRESSION_CONFIG } from "./e1rm";
import { parseRepRange } from "./repRange";
import { TRAINING_CONFIG } from "./trainingConfig";

export function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export type SuggestionMode = "raise" | "hold" | "step-down";

export interface WeightSuggestion {
  weightKg: number;
  mode: SuggestionMode;
  /** Reps estimadas con el peso nuevo (solo cuando mode = "raise"). */
  estimatedReps: { min: number; max: number } | null;
  /** Rango extendido a buscar la próxima vez, mientras no se suba de peso (solo cuando aplica y está habilitado). */
  extendedRange: { min: number; max: number } | null;
  reason: string;
}

interface LiteralSetSpec {
  reps: string;
  targetRIR: string;
}

function targetRirNumber(targetRIR: string): number | null {
  if (targetRIR === "-") return null;
  return targetRIR === "3+" ? 3.5 : Number(targetRIR);
}

/**
 * Sugerencias de peso por grupo de prescripción (todas las series que
 * comparten el mismo rango de reps dentro del ejercicio), no serie por serie
 * aislada ni para todo el ejercicio junto: "¿subo de peso en este grupo?"
 * depende de que ESE grupo haya llegado al tope con buen RIR y sin bajar el
 * peso entre sus propias series — no bloquea una serie "20" liviana de
 * backoff el que la serie "4-6" pesada sí haya progresado, y viceversa.
 * `references[i]` es el set logueado de la sesión de referencia para la
 * serie `i` (ver `exerciseReference.ts`), alineado por índice; `null` = sin
 * referencia, sin sugerencia para esa serie (fase 2b).
 */
export function buildWeightSuggestions(
  literalSets: LiteralSetSpec[],
  references: (LoggedSet | null)[],
  incrementKg: number,
  config = TRAINING_CONFIG
): (WeightSuggestion | null)[] {
  const ranges = literalSets.map((s) => parseRepRange(s.reps));
  const targetRirs = literalSets.map((s) => targetRirNumber(s.targetRIR));

  // Índices de cada grupo de prescripción (mismo rango de reps), en el orden en que aparecen.
  const groupIndexesByReps = new Map<string, number[]>();
  literalSets.forEach((s, i) => {
    if (!groupIndexesByReps.has(s.reps)) groupIndexesByReps.set(s.reps, []);
    groupIndexesByReps.get(s.reps)!.push(i);
  });

  const groupCanRaise = new Map<string, boolean>();
  const groupWeightDropped = new Map<string, boolean>();
  for (const [reps, indexes] of groupIndexesByReps) {
    const groupRefs = indexes.map((i) => references[i]).filter(
      (r): r is LoggedSet => r !== null && r.weightKg !== null && r.reps !== null && r.rir !== null
    );
    const weights = groupRefs.map((r) => r.weightKg as number);
    const weightDropped = weights.some((w, i) => i > 0 && w < weights[i - 1]);
    const reachedCeilingWithRir = indexes.every((i) => {
      const ref = references[i];
      if (!ref || ref.reps === null || ref.rir === null) return true; // no evaluable: no bloquea al resto del grupo
      const targetRir = targetRirs[i];
      const rirOk = targetRir === null || rirToNumber(ref.rir) >= targetRir;
      return ref.reps >= ranges[i].max && rirOk;
    });
    groupWeightDropped.set(reps, weightDropped);
    groupCanRaise.set(reps, !weightDropped && reachedCeilingWithRir && groupRefs.length > 0);
  }

  return references.map((ref, i) => {
    if (!ref || ref.weightKg === null || ref.reps === null || ref.rir === null) return null;
    const range = ranges[i];
    const targetRir = targetRirs[i];
    const reps = literalSets[i].reps;

    if (ref.reps < range.min) {
      const deficit = range.min - ref.reps;
      if (deficit <= 1) {
        return {
          weightKg: ref.weightKg,
          mode: "hold" as const,
          estimatedReps: null,
          extendedRange: null,
          reason: `te quedaste a 1 rep del piso (${ref.reps} de ${range.min}) la última vez: repetí el peso`,
        };
      }
      return {
        weightKg: roundToStep(ref.weightKg - incrementKg, 0.5),
        mode: "step-down" as const,
        estimatedReps: null,
        extendedRange: null,
        reason: `te quedaste ${deficit} reps del piso (${ref.reps} de ${range.min}) la última vez: bajá un escalón`,
      };
    }

    if (!groupCanRaise.get(reps)) {
      const reason = groupWeightDropped.get(reps)
        ? "bajaste el peso entre series de este mismo rango la última vez"
        : "las reps quedaron lejos del tope la última vez";
      return { weightKg: ref.weightKg, mode: "hold" as const, estimatedReps: null, extendedRange: null, reason };
    }

    const newWeight = roundToStep(ref.weightKg + incrementKg, 0.5);
    const e1rmRef = estimatedE1RM(ref.weightKg, ref.reps, rirToNumber(ref.rir));
    const estRepsRaw = (e1rmRef / newWeight - 1) * PROGRESSION_CONFIG.epleyDivisor - (targetRir ?? 0);

    if (estRepsRaw < range.min) {
      if (!config.extendRangeEnabled) {
        return {
          weightKg: ref.weightKg,
          mode: "hold" as const,
          estimatedReps: null,
          extendedRange: null,
          reason: "llegaste al tope, pero con el peso nuevo no llegarías al piso: mantené el mismo peso",
        };
      }
      return {
        weightKg: ref.weightKg,
        mode: "hold" as const,
        estimatedReps: null,
        extendedRange: { min: range.max + 1, max: range.max + config.rangeExtensionReps },
        reason: `con ${newWeight}kg estimamos ~${Math.max(0, Math.round(estRepsRaw))} reps, debajo del piso: mantené el peso y buscá el rango extendido`,
      };
    }

    const low = Math.max(range.min, Math.floor(estRepsRaw));
    return {
      weightKg: newWeight,
      mode: "raise" as const,
      estimatedReps: { min: low, max: low + 1 },
      extendedRange: null,
      reason: "llegaste al tope con buen RIR la última vez, sin bajar el peso entre series",
    };
  });
}
