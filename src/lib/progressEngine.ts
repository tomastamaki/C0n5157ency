import type { LogsData, RIRValue, WorkoutSession } from "../types/logs";
import { isSetLogged, rirToNumber } from "../types/logs";
import type { FlatProgramDay, Program } from "../types/program";
import { estimatedE1RM } from "./e1rm";
import { getLiteralWorkingSets } from "./program";
import { matchWithinSession } from "./exerciseReference";
import { isDeloadWeek } from "./recommendation";
import { parseRepRange, type RepRange } from "./repRange";
import { TRAINING_CONFIG } from "./trainingConfig";

/** Semanas (ascendente, sin deload) con al menos un set logueado de este ejercicio (día + nombre efectivamente hecho) en el ciclo. Fuente única para "¿en qué semanas hay datos de este ejercicio?". */
export function getWeeksWithData(logs: LogsData, program: Program, cycle: number, dayName: string, exercise: string): number[] {
  const weeks = new Set<number>();
  logs.sessions.forEach((s) => {
    if (s.status !== "completed" || (s.cycle ?? 0) !== cycle) return;
    if (s.dayName !== dayName) return;
    if (isDeloadWeek(program, s.weekNumber)) return;
    const ex = s.exercises.find((e) => e.exercise === exercise);
    if (ex && ex.sets.some(isSetLogged)) weeks.add(s.weekNumber);
  });
  return [...weeks].sort((a, b) => a - b);
}

export interface SetPerformance {
  weightKg: number;
  reps: number;
  rir: RIRValue;
}

export type SetProgressStatus = "advance" | "same" | "regression";

export interface SetProgress {
  status: SetProgressStatus;
  /** Motivo concreto: qué dato disparó la clasificación (rule 6 — explicabilidad). */
  reason: string;
  /** true si avanzó en reps/RIR pero el e1RM no subió (ej. 10 reps @2 -> 11 reps @0): progreso real, con más esfuerzo. */
  moreEffort: boolean;
  e1rmDeltaPct: number;
}

function cmp(a: number, b: number): -1 | 0 | 1 {
  return a > b ? 1 : a < b ? -1 : 0;
}

/**
 * Clasifica una serie contra su equivalente de la sesión de referencia (ver
 * `exerciseReference.ts`) en avance / igual / retroceso, según las reglas
 * del plan de progresión (fase 2a). Los combos no cubiertos por una regla
 * explícita se deciden por el cambio de e1RM, con tolerancia.
 */
export function classifySet(
  current: SetPerformance,
  reference: SetPerformance,
  targetRange: RepRange,
  tolerancePct: number = TRAINING_CONFIG.progressTolerancePct
): SetProgress {
  const w = cmp(current.weightKg, reference.weightKg);
  const r = cmp(current.reps, reference.reps);
  const i = cmp(rirToNumber(current.rir), rirToNumber(reference.rir));

  const e1rmCurrent = estimatedE1RM(current.weightKg, current.reps, rirToNumber(current.rir));
  const e1rmReference = estimatedE1RM(reference.weightKg, reference.reps, rirToNumber(reference.rir));
  const e1rmDeltaPct = e1rmReference !== 0 ? ((e1rmCurrent - e1rmReference) / e1rmReference) * 100 : 0;
  const moreEffort = e1rmDeltaPct <= tolerancePct;

  if (w === 0 && r === 0 && i === 0) {
    return { status: "same", reason: "mismo peso, reps y RIR que la vez anterior", moreEffort: false, e1rmDeltaPct };
  }

  // --- Avance ---
  if (w === 0 && r === 0 && i === 1) {
    return {
      status: "advance",
      reason: `mismo peso y reps, con más RIR (antes RIR ${reference.rir}, ahora RIR ${current.rir})`,
      moreEffort,
      e1rmDeltaPct,
    };
  }
  if (w === 0 && r === 1 && i === -1) {
    return {
      status: "advance",
      reason: `mismo peso, más reps (antes ${reference.reps}, ahora ${current.reps}) con menos RIR`,
      moreEffort,
      e1rmDeltaPct,
    };
  }
  if (w === 1 && r === -1 && i === -1 && current.reps >= targetRange.min) {
    return {
      status: "advance",
      reason: `subiste el peso (antes ${reference.weightKg}kg, ahora ${current.weightKg}kg) con menos reps, dentro del rango objetivo`,
      moreEffort,
      e1rmDeltaPct,
    };
  }
  if (w === 1 && r >= 0) {
    return {
      status: "advance",
      reason: `subiste el peso (antes ${reference.weightKg}kg, ahora ${current.weightKg}kg) con igual o más reps`,
      moreEffort,
      e1rmDeltaPct,
    };
  }

  // --- Retroceso ---
  if (w === -1) {
    return {
      status: "regression",
      reason: `bajaste el peso (antes ${reference.weightKg}kg, ahora ${current.weightKg}kg)`,
      moreEffort: false,
      e1rmDeltaPct,
    };
  }
  if (w === 1 && r === -1 && current.reps < targetRange.min) {
    return {
      status: "regression",
      reason: `subiste el peso pero las reps (${current.reps}) quedaron debajo del piso del rango (${targetRange.min})`,
      moreEffort: false,
      e1rmDeltaPct,
    };
  }
  if (w === 0 && r === -1) {
    return {
      status: "regression",
      reason: `mismo peso, menos reps (antes ${reference.reps}, ahora ${current.reps})`,
      moreEffort: false,
      e1rmDeltaPct,
    };
  }
  if (w === 0 && i === -1) {
    return {
      status: "regression",
      reason: `mismo peso y reps, con menos RIR (antes RIR ${reference.rir}, ahora RIR ${current.rir})`,
      moreEffort: false,
      e1rmDeltaPct,
    };
  }

  // --- Caso no cubierto por ninguna regla explícita: por cambio de e1RM ---
  if (e1rmDeltaPct > tolerancePct) {
    return { status: "advance", reason: `e1RM subió ${e1rmDeltaPct.toFixed(1)}%`, moreEffort: false, e1rmDeltaPct };
  }
  if (e1rmDeltaPct < -tolerancePct) {
    return { status: "regression", reason: `e1RM bajó ${Math.abs(e1rmDeltaPct).toFixed(1)}%`, moreEffort: false, e1rmDeltaPct };
  }
  return { status: "same", reason: "sin cambio significativo de e1RM", moreEffort: false, e1rmDeltaPct };
}

export type ExerciseProgressStatus = "progress" | "stable" | "regression" | "mixed" | "new" | "deload";

export interface ExerciseProgress {
  status: ExerciseProgressStatus;
  /** Una entrada por serie actual, en el mismo orden; null = sin referencia para esa serie (no evaluable). */
  sets: (SetProgress | null)[];
  avgE1rmDeltaPct: number | null;
  detail: string;
}

/**
 * Clasificación del ejercicio completo a partir de sus series individuales
 * (fase 2a): Progresa (≥1 avanzó, ninguna retrocedió), Estable (todas
 * iguales), Retrocede (≥1 retrocedió, ninguna avanzó), Mixto (hay de ambas,
 * con el promedio de e1RM como dato de apoyo). Fuente única: todo lo que
 * necesite "¿este ejercicio progresó?" pasa por acá.
 */
export function evaluateExerciseProgress(
  currentSets: SetPerformance[],
  referenceSets: (SetPerformance | null)[],
  targetRanges: RepRange[],
  isCurrentDeload: boolean,
  tolerancePct: number = TRAINING_CONFIG.progressTolerancePct
): ExerciseProgress {
  if (isCurrentDeload) {
    return {
      status: "deload",
      sets: currentSets.map(() => null),
      avgE1rmDeltaPct: null,
      detail: "semana de deload: no se evalúa el progreso",
    };
  }

  const classified = currentSets.map((cur, i) => {
    const ref = referenceSets[i];
    if (!ref) return null;
    return classifySet(cur, ref, targetRanges[i], tolerancePct);
  });

  const withRef = classified.filter((c): c is SetProgress => c !== null);
  if (withRef.length === 0) {
    return {
      status: "new",
      sets: classified,
      avgE1rmDeltaPct: null,
      detail: "primer registro de este ejercicio (variante): sin base para comparar",
    };
  }

  const avgE1rmDeltaPct = withRef.reduce((sum, c) => sum + c.e1rmDeltaPct, 0) / withRef.length;
  const hasAdvance = withRef.some((c) => c.status === "advance");
  const hasRegression = withRef.some((c) => c.status === "regression");

  if (hasAdvance && hasRegression) {
    const sign = avgE1rmDeltaPct >= 0 ? "+" : "";
    return {
      status: "mixed",
      sets: classified,
      avgE1rmDeltaPct,
      detail: `mixto: alguna serie avanzó y otra retrocedió (e1RM promedio ${sign}${avgE1rmDeltaPct.toFixed(1)}%)`,
    };
  }
  if (hasAdvance) {
    return { status: "progress", sets: classified, avgE1rmDeltaPct, detail: "progresó: al menos una serie avanzó y ninguna retrocedió" };
  }
  if (hasRegression) {
    return { status: "regression", sets: classified, avgE1rmDeltaPct, detail: "retrocedió: al menos una serie retrocedió y ninguna avanzó" };
  }
  return { status: "stable", sets: classified, avgE1rmDeltaPct, detail: "estable: todas las series iguales a la vez anterior" };
}

/** true si, según este resultado, el ejercicio nunca debe marcarse como "a vigilar" ni "estancado" (Progresa, o Mixto con e1RM al alza). */
export function isProgressingOrImproving(progress: ExerciseProgress): boolean {
  if (progress.status === "progress") return true;
  if (progress.status === "mixed" && progress.avgE1rmDeltaPct !== null && progress.avgE1rmDeltaPct > 0) return true;
  return false;
}

function findSession(logs: LogsData, cycle: number, dayName: string, weekNumber: number): WorkoutSession | null {
  return (
    logs.sessions.find(
      (s) => s.status === "completed" && (s.cycle ?? 0) === cycle && s.dayName === dayName && s.weekNumber === weekNumber
    ) ?? null
  );
}

/**
 * Clasificación de un ejercicio en una semana puntual contra una semana base
 * de referencia ya elegida (ej. "la anterior con registro") — fuente única
 * para "¿este ejercicio progresó en esta semana?", usada por el resumen
 * semanal y por las alertas (necesita atención / estancamiento), para que
 * nunca haya dos cálculos distintos de lo mismo.
 */
export function getExerciseProgressForWeek(
  logs: LogsData,
  flatDays: FlatProgramDay[],
  cycle: number,
  dayName: string,
  exercise: string,
  weekNumber: number,
  baseWeek: number | null,
  isDeload: boolean
): ExerciseProgress {
  if (isDeload) {
    return { status: "deload", sets: [], avgE1rmDeltaPct: null, detail: "semana de deload: no se evalúa el progreso" };
  }

  const session = findSession(logs, cycle, dayName, weekNumber);
  const exIndex = session?.exercises.findIndex((e) => e.exercise === exercise) ?? -1;
  if (!session || exIndex === -1) {
    return { status: "new", sets: [], avgE1rmDeltaPct: null, detail: "sin series registradas esta semana" };
  }

  const flatDay = flatDays[session.programIndex];
  const group = flatDay?.day.exerciseGroups[exIndex];
  const literal = group ? getLiteralWorkingSets(group) : [];
  const loggedSets = session.exercises[exIndex].sets.filter(
    (s) => isSetLogged(s) && s.weightKg !== null && s.reps !== null && s.rir !== null
  );
  if (literal.length === 0 || loggedSets.length === 0) {
    return { status: "new", sets: [], avgE1rmDeltaPct: null, detail: "sin series registradas esta semana" };
  }

  const currentSets: SetPerformance[] = loggedSets.map((s) => ({
    weightKg: s.weightKg as number,
    reps: s.reps as number,
    rir: s.rir!,
  }));
  const targetRanges = loggedSets.map((s) => parseRepRange(literal[s.setIndex]?.reps ?? "0"));

  let referenceSets: (SetPerformance | null)[] = loggedSets.map(() => null);
  const baseSession = baseWeek !== null ? findSession(logs, cycle, dayName, baseWeek) : null;
  const baseExIndex = baseSession?.exercises.findIndex((e) => e.exercise === exercise) ?? -1;
  if (baseSession && baseExIndex !== -1) {
    const paired = matchWithinSession(
      flatDays,
      baseSession,
      baseExIndex,
      exercise,
      loggedSets.map((s) => literal[s.setIndex]?.reps ?? "0"),
      "same-day"
    );
    referenceSets = paired.map((p) =>
      p.set && p.set.weightKg !== null && p.set.reps !== null && p.set.rir !== null
        ? { weightKg: p.set.weightKg, reps: p.set.reps, rir: p.set.rir }
        : null
    );
  }

  return evaluateExerciseProgress(currentSets, referenceSets, targetRanges, false);
}
