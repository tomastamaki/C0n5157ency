import { rirToNumber } from "../types/logs";
import type { LoggedSet } from "../types/logs";
import { estimatedE1RM, PROGRESSION_CONFIG } from "./e1rm";
import { parseRepRange } from "./repRange";
import { DELOAD_MESSAGE, TRAINING_CONFIG } from "./trainingConfig";

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
  /** Aviso informativo (ej. una serie short de reps con tolerancia, o RIR lejos del objetivo) que no bloquea la sugerencia. */
  warning: string | null;
}

interface LiteralSetSpec {
  reps: string;
  targetRIR: string;
}

function targetRirNumber(targetRIR: string): number | null {
  if (targetRIR === "-") return null;
  return targetRIR === "3+" ? 3.5 : Number(targetRIR);
}

/** Lista en castellano de series (1-based) para un mensaje: "2", "2 y 3", "2, 3 y 4". */
function listSeries(indexes: number[]): string {
  const names = indexes.map((i) => `${i + 1}`);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/**
 * Sugerencias de peso por grupo de prescripción (todas las series que
 * comparten el mismo rango de reps dentro del ejercicio), no serie por serie
 * aislada ni para todo el ejercicio junto. El criterio principal para subir
 * son las REPS: el grupo sube si todas sus series llegaron al tope del rango,
 * permitiendo que como máximo una se quede a `ceilingToleranceReps` reps del
 * tope (con aviso). El RIR ya no bloquea subir: solo agrega un aviso cuando
 * alguna serie quedó muy por debajo del RIR pedido.
 *
 * Si alguna serie se hizo con menos peso que la anterior del mismo grupo, no
 * se evalúa para subir: si esa serie liviana igual llegó al tope con RIR
 * aceptable, se sugiere igualar su peso al de la serie anterior (y recién
 * cuando todo el grupo quede al mismo peso se vuelve a evaluar si sube); si
 * no llegó al tope o su RIR quedó muy lejos, se repite el peso de esa serie
 * sin más.
 *
 * `references[i]` es el set logueado de la sesión de referencia para la
 * serie `i` (ver `exerciseReference.ts`), alineado por índice; `null` = sin
 * referencia, sin sugerencia para esa serie.
 *
 * `isDeload` (semana de deload): nunca sugiere subir, sin importar las reps
 * logradas — el objetivo esa semana es el RIR más alto de la columna, no
 * marca. Mantiene el peso de la referencia (ya es la última semana normal:
 * `exerciseReference.ts` nunca usa una sesión de deload como referencia).
 */
export function buildWeightSuggestions(
  literalSets: LiteralSetSpec[],
  references: (LoggedSet | null)[],
  incrementKg: number,
  config = TRAINING_CONFIG,
  isDeload = false
): (WeightSuggestion | null)[] {
  if (isDeload) {
    return references.map((ref) =>
      ref && ref.weightKg !== null
        ? {
            weightKg: ref.weightKg,
            mode: "hold" as const,
            estimatedReps: null,
            extendedRange: null,
            reason: DELOAD_MESSAGE,
            warning: null,
          }
        : null
    );
  }

  const ranges = literalSets.map((s) => parseRepRange(s.reps));
  const targetRirs = literalSets.map((s) => targetRirNumber(s.targetRIR));

  const groupIndexesByReps = new Map<string, number[]>();
  literalSets.forEach((s, i) => {
    if (!groupIndexesByReps.has(s.reps)) groupIndexesByReps.set(s.reps, []);
    groupIndexesByReps.get(s.reps)!.push(i);
  });

  function estimateRepsAt(ref: LoggedSet, targetRir: number | null, newWeight: number): number {
    const e1rm = estimatedE1RM(ref.weightKg as number, ref.reps as number, rirToNumber(ref.rir as "0" | "1" | "2" | "3+"));
    return (e1rm / newWeight - 1) * PROGRESSION_CONFIG.epleyDivisor - (targetRir ?? 0);
  }

  interface PositionInfo {
    ref: LoggedSet;
    /** range.max - reps; 0 o negativo = llegó al tope (o más). */
    ceilingGap: number;
    /** targetRIR - RIR real; positivo = fue más cerca del fallo de lo pedido. */
    rirGap: number;
  }
  const positionInfo: (PositionInfo | null)[] = literalSets.map((_, i) => {
    const ref = references[i];
    if (!ref || ref.weightKg === null || ref.reps === null || ref.rir === null) return null;
    const targetRir = targetRirs[i];
    return {
      ref,
      ceilingGap: ranges[i].max - ref.reps,
      rirGap: targetRir === null ? 0 : targetRir - rirToNumber(ref.rir),
    };
  });

  interface EqualizePlan {
    kind: "equalize";
    lightIdx: number;
    catchupWeight: number;
    qualifies: boolean;
  }
  interface NormalPlan {
    kind: "normal";
    tooFar: number[];
    oneShort: number[];
    raiseEligible: boolean;
    warning: string | null;
  }
  const groupPlan = new Map<string, EqualizePlan | NormalPlan>();

  for (const [reps, indexes] of groupIndexesByReps) {
    // ¿Alguna serie se hizo con menos peso que la inmediatamente anterior del mismo grupo?
    let dropIdx: number | null = null;
    for (let k = 1; k < indexes.length; k++) {
      const prev = positionInfo[indexes[k - 1]];
      const cur = positionInfo[indexes[k]];
      if (prev && cur && (cur.ref.weightKg as number) < (prev.ref.weightKg as number)) {
        dropIdx = indexes[k];
        break;
      }
    }

    if (dropIdx !== null) {
      const lightIdx = dropIdx;
      const catchupWeight = positionInfo[indexes[indexes.indexOf(lightIdx) - 1]]!.ref.weightKg as number;
      const light = positionInfo[lightIdx]!;
      const qualifies = light.ceilingGap <= config.ceilingToleranceReps && light.rirGap < config.rirWarningGap;
      groupPlan.set(reps, { kind: "equalize", lightIdx, catchupWeight, qualifies });
      continue;
    }

    const tooFar = indexes.filter((i) => positionInfo[i] !== null && positionInfo[i]!.ceilingGap > config.ceilingToleranceReps);
    const oneShort = indexes.filter((i) => {
      const info = positionInfo[i];
      return info !== null && info.ceilingGap > 0 && info.ceilingGap <= config.ceilingToleranceReps;
    });
    const hasData = indexes.some((i) => positionInfo[i] !== null);
    const raiseEligible = hasData && tooFar.length === 0 && oneShort.length <= 1;

    let warning: string | null = null;
    if (raiseEligible) {
      const notes: string[] = [];
      if (oneShort.length === 1) {
        const i = oneShort[0];
        const info = positionInfo[i]!;
        notes.push(`la serie ${i + 1} se quedó en ${info.ref.reps} reps (tope ${ranges[i].max})`);
      }
      for (const i of indexes) {
        const info = positionInfo[i];
        if (info && info.rirGap >= config.rirWarningGap) {
          notes.push(`la serie ${i + 1} fue con RIR ${info.ref.rir} (pedía ${literalSets[i].targetRIR})`);
        }
      }
      if (notes.length > 0) warning = `Ojo: ${notes.join("; ")}`;
    }

    groupPlan.set(reps, { kind: "normal", tooFar, oneShort, raiseEligible, warning });
  }

  function explainNormalHold(i: number, plan: NormalPlan, ref: LoggedSet, range: { min: number; max: number }): string {
    if (plan.tooFar.includes(i) || plan.oneShort.includes(i)) {
      return `te quedaste en ${ref.reps} reps (tope ${range.max}) la última vez: todavía no llegaste al tope de esta serie`;
    }
    const blockers = [...plan.tooFar, ...plan.oneShort].filter((j) => j !== i);
    if (blockers.length > 0) {
      const serieWord = blockers.length === 1 ? "la serie" : "las series";
      const verb = blockers.length === 1 ? "no llegó" : "no llegaron";
      return `esta serie sí llegó al tope, pero ${serieWord} ${listSeries(blockers)} de este mismo rango ${verb} al tope la última vez: suben juntas o no sube ninguna`;
    }
    return "todavía no hay datos suficientes de este grupo para subir";
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
          warning: null,
          reason: `te quedaste a 1 rep del piso (${ref.reps} de ${range.min}) la última vez: conviene repetir el peso`,
        };
      }
      return {
        weightKg: roundToStep(ref.weightKg - incrementKg, 0.5),
        mode: "step-down" as const,
        estimatedReps: null,
        extendedRange: null,
        warning: null,
        reason: `te quedaste ${deficit} reps del piso (${ref.reps} de ${range.min}) la última vez: conviene bajar un escalón`,
      };
    }

    const plan = groupPlan.get(reps)!;

    if (plan.kind === "equalize") {
      if (i !== plan.lightIdx) {
        return {
          weightKg: ref.weightKg,
          mode: "hold" as const,
          estimatedReps: null,
          extendedRange: null,
          warning: null,
          reason: `esperá a que la serie ${plan.lightIdx + 1} llegue a ${plan.catchupWeight}kg antes de subir juntas`,
        };
      }
      if (!plan.qualifies) {
        return {
          weightKg: ref.weightKg,
          mode: "hold" as const,
          estimatedReps: null,
          extendedRange: null,
          warning: null,
          reason: "bajaste el peso entre series de este mismo rango la última vez",
        };
      }
      const estRepsRaw = estimateRepsAt(ref, targetRir, plan.catchupWeight);
      if (estRepsRaw < range.min) {
        return {
          weightKg: ref.weightKg,
          mode: "hold" as const,
          estimatedReps: null,
          extendedRange: null,
          warning: null,
          reason: `igualar a ${plan.catchupWeight}kg te dejaría debajo del piso: por ahora conviene repetir tu peso`,
        };
      }
      const low = Math.max(range.min, Math.floor(estRepsRaw));
      return {
        weightKg: plan.catchupWeight,
        mode: "raise" as const,
        estimatedReps: { min: low, max: low + 1 },
        extendedRange: null,
        warning: null,
        reason: `Igualá el peso: la serie ${i + 1} llegó al tope con ${ref.weightKg}kg`,
      };
    }

    if (!plan.raiseEligible) {
      return {
        weightKg: ref.weightKg,
        mode: "hold" as const,
        estimatedReps: null,
        extendedRange: null,
        warning: null,
        reason: explainNormalHold(i, plan, ref, range),
      };
    }

    const newWeight = roundToStep(ref.weightKg + incrementKg, 0.5);
    const estRepsRaw = estimateRepsAt(ref, targetRir, newWeight);

    if (estRepsRaw < range.min) {
      if (!config.extendRangeEnabled) {
        return {
          weightKg: ref.weightKg,
          mode: "hold" as const,
          estimatedReps: null,
          extendedRange: null,
          warning: null,
          reason: "llegaste al tope, pero con el peso nuevo no llegarías al piso: conviene mantener el mismo peso",
        };
      }
      return {
        weightKg: ref.weightKg,
        mode: "hold" as const,
        estimatedReps: null,
        extendedRange: { min: range.max + 1, max: range.max + config.rangeExtensionReps },
        warning: null,
        reason: `con ${newWeight}kg estimamos ~${Math.max(0, Math.round(estRepsRaw))} reps, debajo del piso: conviene mantener el peso y buscar el rango extendido`,
      };
    }

    const low = Math.max(range.min, Math.floor(estRepsRaw));
    return {
      weightKg: newWeight,
      mode: "raise" as const,
      estimatedReps: { min: low, max: low + 1 },
      extendedRange: null,
      warning: plan.warning,
      reason: "llegaste al tope con las reps la última vez, sin bajar el peso entre series",
    };
  });
}
