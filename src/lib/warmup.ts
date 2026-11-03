import type { ExerciseGroup } from "../types/program";
import { parseRepRange } from "./repRange";
import { roundToStep } from "./suggestions";
import { WARMUP_CONFIG } from "./warmupConfig";

export interface WarmupSetSuggestion {
  pct: number;
  weightKg: number;
}

export interface WarmupSuggestion {
  /** Rango prescripto tal cual el programa ("2-3", "0-1", etc.), para mostrarlo sin perder el texto original. */
  countLabel: string;
  /** El rango incluye 0 (ej. "0-1"): el calentamiento es opcional. */
  optional: boolean;
  sets: WarmupSetSuggestion[];
}

/**
 * Series de calentamiento sugeridas para un ejercicio, a partir del peso de
 * referencia de la primera serie de trabajo (la sugerencia de hoy si existe,
 * o si no el peso de la última vez — fase 1), escalado por la tabla de
 * porcentajes (`WARMUP_CONFIG`) según cuántas series de calentamiento pide el
 * programa. Null si el ejercicio no tiene calentamiento prescripto o todavía
 * no hay ningún peso de referencia para calcular contra.
 */
export function getWarmupSuggestion(
  group: ExerciseGroup,
  referenceWeightKg: number | null,
  incrementKg: number
): WarmupSuggestion | null {
  const warmup = group.sets.find((s) => s.type === "warmup");
  if (!warmup || referenceWeightKg === null || referenceWeightKg <= 0) return null;

  const range = parseRepRange(warmup.count);
  const setCount = Math.min(Math.max(range.max, 1), WARMUP_CONFIG.maxTableSets);
  const pcts = WARMUP_CONFIG.percentagesBySetCount[setCount];
  const sets = pcts.map((pct) => ({ pct, weightKg: roundToStep(referenceWeightKg * pct, incrementKg) }));

  return { countLabel: warmup.count, optional: range.min === 0, sets };
}
