import type { LogsData, WorkoutSession } from "../types/logs";
import { isSetLogged, rirToNumber } from "../types/logs";
import type { FlatProgramDay, Program } from "../types/program";
import type { AppSettings } from "./storage";
import { isDeloadWeek } from "./recommendation";
import { estimatedE1RM } from "./e1rm";
import { getLiteralWorkingSets } from "./program";
import { getPersonalRecordEvents } from "./records";
import { getIncrementKg } from "./increments";
import { roundToStep } from "./suggestions";
import { parseRepRange } from "./repRange";
import { SUMMARY_CONFIG } from "./summaryConfig";
import { DAY_ORDER } from "./history";
import { dailyValues, metricConfigs, type LifestyleMetricKey } from "./lifestyleKpis";
import { getMuscleContributions, MUSCLE_GROUPS, OTHER_MUSCLE_GROUP } from "./muscleMapping";

export type PeriodKind = "week" | "month";

export interface PeriodRef {
  kind: PeriodKind;
  /** Para "week": el weekNumber (1-based). Para "month": el índice de mes (1-based, bloques de 4 semanas). */
  index: number;
}

export function getTotalWeeks(program: Program): number {
  return program.blocks.reduce((sum, b) => sum + b.weeks.length, 0);
}

export function getTotalMonths(program: Program): number {
  return Math.ceil(getTotalWeeks(program) / 4);
}

export function getMonthIndexForWeek(weekNumber: number): number {
  return Math.ceil(weekNumber / 4);
}

function daysPerWeek(program: Program): number {
  return program.blocks[0]?.weeks[0]?.days.length ?? 0;
}

/** Semanas del programa que caen dentro de un período (rango completo, incluidas las de deload). */
export function getWeeksInPeriod(program: Program, period: PeriodRef): number[] {
  const total = getTotalWeeks(program);
  if (period.kind === "week") {
    return period.index >= 1 && period.index <= total ? [period.index] : [];
  }
  const start = (period.index - 1) * 4 + 1;
  const end = Math.min(period.index * 4, total);
  const weeks: number[] = [];
  for (let w = start; w <= end; w++) weeks.push(w);
  return weeks;
}

/** Semanas "con datos" para promediar: en vista Mes se excluyen las de deload; en vista Semana se muestra igual (se marca con chip). */
function dataWeeksInPeriod(program: Program, period: PeriodRef): number[] {
  const weeks = getWeeksInPeriod(program, period);
  if (period.kind === "week") return weeks;
  return weeks.filter((w) => !isDeloadWeek(program, w));
}

export function periodContainsDeload(program: Program, period: PeriodRef): boolean {
  return getWeeksInPeriod(program, period).some((w) => isDeloadWeek(program, w));
}

export function getPeriodLabel(period: PeriodRef): string {
  return period.kind === "week" ? `Semana ${period.index}` : `Mes ${period.index}`;
}

/** Período anterior comparable: si cae en una semana de deload, salta hacia atrás hasta la última que no lo sea. */
export function getPreviousPeriod(program: Program, period: PeriodRef): PeriodRef | null {
  if (period.kind === "month") {
    const prevIndex = period.index - 1;
    return prevIndex >= 1 ? { kind: "month", index: prevIndex } : null;
  }
  let idx = period.index - 1;
  while (idx >= 1) {
    if (!isDeloadWeek(program, idx)) return { kind: "week", index: idx };
    idx -= 1;
  }
  return null;
}

export function getFirstPeriod(kind: PeriodKind): PeriodRef {
  return { kind, index: 1 };
}

export function getCurrentPeriodIndex(kind: PeriodKind, currentWeekNumber: number): number {
  return kind === "week" ? currentWeekNumber : getMonthIndexForWeek(currentWeekNumber);
}

// ---------------------------------------------------------------------------
// Cabecera + métricas globales
// ---------------------------------------------------------------------------

export interface PeriodData {
  period: PeriodRef;
  weekNumbers: number[];
  isDeload: boolean;
  sessionsCompleted: number;
  sessionsPlanned: number;
  tonnageKg: number;
  totalSets: number;
  avgRir: number | null;
  avgSessionDurationSec: number | null;
  prCount: number;
}

function getSessionsInWeeks(logs: LogsData, cycle: number, weekNumbers: number[]): WorkoutSession[] {
  const set = new Set(weekNumbers);
  return logs.sessions.filter((s) => (s.cycle ?? 0) === cycle && set.has(s.weekNumber));
}

export function getPeriodData(logs: LogsData, program: Program, cycle: number, period: PeriodRef): PeriodData {
  const weekNumbers = getWeeksInPeriod(program, period);
  const dataWeeks = dataWeeksInPeriod(program, period);
  const completedSessions = getSessionsInWeeks(logs, cycle, weekNumbers).filter((s) => s.status === "completed");
  const dataSessions = getSessionsInWeeks(logs, cycle, dataWeeks).filter((s) => s.status === "completed");

  let tonnageKg = 0;
  let totalSets = 0;
  const rirValues: number[] = [];
  for (const s of dataSessions) {
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        if (!isSetLogged(set) || set.weightKg === null || set.reps === null || set.rir === null) continue;
        tonnageKg += set.weightKg * set.reps;
        totalSets += 1;
        rirValues.push(rirToNumber(set.rir));
      }
    }
  }
  const avgRir = rirValues.length > 0 ? rirValues.reduce((a, b) => a + b, 0) / rirValues.length : null;
  const durations = dataSessions.map((s) => s.durationSec).filter((d): d is number => d !== null);
  const avgSessionDurationSec = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  const prCount = getPersonalRecordEvents(logs).filter(
    (e) => e.kind === "weight" && e.cycle === cycle && weekNumbers.includes(e.weekNumber)
  ).length;

  return {
    period,
    weekNumbers,
    isDeload: periodContainsDeload(program, period),
    sessionsCompleted: completedSessions.length,
    sessionsPlanned: weekNumbers.length * daysPerWeek(program),
    tonnageKg,
    totalSets,
    avgRir,
    avgSessionDurationSec,
    prCount,
  };
}

// ---------------------------------------------------------------------------
// Por ejercicio (agrupado por tipo de día)
// ---------------------------------------------------------------------------

export type ComparisonReason = "ok" | "variant-mismatch" | "no-data";

export interface ComparisonCell {
  variationPct: number | null;
  reason: ComparisonReason;
}

export type ExerciseStatus = "progress" | "stable" | "decline" | "new-variant";

export interface ExerciseRow {
  dayName: string;
  exercise: string;
  avgE1rm: number | null;
  setsCount: number;
  status: ExerciseStatus;
  vsPrevious: ComparisonCell;
  vsFirst: ComparisonCell;
}

function avgE1rmFor(
  logs: LogsData,
  cycle: number,
  dayName: string,
  exercise: string,
  weekNumbers: number[]
): { avg: number | null; sets: number } {
  const weeks = new Set(weekNumbers);
  const e1rms: number[] = [];
  for (const s of logs.sessions) {
    if (s.status !== "completed" || (s.cycle ?? 0) !== cycle || s.dayName !== dayName || !weeks.has(s.weekNumber)) {
      continue;
    }
    for (const ex of s.exercises) {
      if (ex.exercise !== exercise) continue;
      for (const set of ex.sets) {
        if (!isSetLogged(set) || set.weightKg === null || set.reps === null || set.rir === null) continue;
        e1rms.push(estimatedE1RM(set.weightKg, set.reps, rirToNumber(set.rir)));
      }
    }
  }
  return { avg: e1rms.length > 0 ? e1rms.reduce((a, b) => a + b, 0) / e1rms.length : null, sets: e1rms.length };
}

function exercisesTrainedOnDay(logs: LogsData, cycle: number, dayName: string, weekNumbers: number[]): Set<string> {
  const weeks = new Set(weekNumbers);
  const names = new Set<string>();
  logs.sessions
    .filter((s) => s.status === "completed" && (s.cycle ?? 0) === cycle && s.dayName === dayName && weeks.has(s.weekNumber))
    .forEach((s) => s.exercises.forEach((ex) => {
      if (ex.sets.some(isSetLogged)) names.add(ex.exercise);
    }));
  return names;
}

function compareTo(
  logs: LogsData,
  program: Program,
  cycle: number,
  dayName: string,
  exercise: string,
  currentAvg: number | null,
  comparePeriod: PeriodRef | null
): ComparisonCell {
  if (!comparePeriod) return { variationPct: null, reason: "no-data" };
  const weeks = dataWeeksInPeriod(program, comparePeriod);
  const trained = exercisesTrainedOnDay(logs, cycle, dayName, weeks);
  if (trained.size === 0) return { variationPct: null, reason: "no-data" };
  if (!trained.has(exercise)) return { variationPct: null, reason: "variant-mismatch" };
  const { avg } = avgE1rmFor(logs, cycle, dayName, exercise, weeks);
  if (avg === null || currentAvg === null || avg === 0) return { variationPct: null, reason: "no-data" };
  return { variationPct: ((currentAvg - avg) / avg) * 100, reason: "ok" };
}

/**
 * Filas de la tabla "por ejercicio", agrupadas por tipo de día. Cada fila es
 * un par (tipo de día, ejercicio efectivamente hecho) — si el mismo nombre
 * aparece en dos días (sustituto en uno, prescripto en otro), son dos filas
 * separadas, cada una comparada contra el mismo tipo de día en los otros
 * períodos (nunca se mezclan prescripciones de rutinas distintas).
 */
export function getExerciseRows(logs: LogsData, program: Program, cycle: number, period: PeriodRef): ExerciseRow[] {
  const weeks = dataWeeksInPeriod(program, period);
  const pairs = new Set<string>();
  logs.sessions
    .filter((s) => s.status === "completed" && (s.cycle ?? 0) === cycle && weeks.includes(s.weekNumber))
    .forEach((s) => s.exercises.forEach((ex) => {
      if (ex.sets.some(isSetLogged)) pairs.add(`${s.dayName}::${ex.exercise}`);
    }));

  const isFirst = period.index === 1;
  const previousPeriod = getPreviousPeriod(program, period);
  const firstPeriod = isFirst ? null : getFirstPeriod(period.kind);

  const rows: ExerciseRow[] = [];
  for (const pair of pairs) {
    const [dayName, exercise] = pair.split("::");
    const { avg, sets } = avgE1rmFor(logs, cycle, dayName, exercise, weeks);

    const vsPrevious = compareTo(logs, program, cycle, dayName, exercise, avg, previousPeriod);
    const vsFirst = firstPeriod ? compareTo(logs, program, cycle, dayName, exercise, avg, firstPeriod) : { variationPct: null, reason: "no-data" as const };

    let status: ExerciseStatus;
    if (vsPrevious.reason !== "ok" || vsPrevious.variationPct === null) {
      status = "new-variant";
    } else if (vsPrevious.variationPct > SUMMARY_CONFIG.exerciseStatusStablePct) {
      status = "progress";
    } else if (vsPrevious.variationPct < -SUMMARY_CONFIG.exerciseStatusStablePct) {
      status = "decline";
    } else {
      status = "stable";
    }

    rows.push({ dayName, exercise, avgE1rm: avg, setsCount: sets, status, vsPrevious, vsFirst });
  }

  return rows.sort((a, b) => {
    const dayDiff = DAY_ORDER.indexOf(a.dayName) - DAY_ORDER.indexOf(b.dayName);
    if (dayDiff !== 0) return dayDiff;
    return a.exercise.localeCompare(b.exercise, "es");
  });
}

/** Variación promedio de e1RM del período (promedio de las filas con comparación válida), contra el anterior y contra el inicio. */
export function getPerformanceVariation(rows: ExerciseRow[]): { vsPrevious: number | null; vsFirst: number | null } {
  function avgOf(cells: ComparisonCell[]): number | null {
    const vals = cells.filter((c) => c.reason === "ok" && c.variationPct !== null).map((c) => c.variationPct as number);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return { vsPrevious: avgOf(rows.map((r) => r.vsPrevious)), vsFirst: avgOf(rows.map((r) => r.vsFirst)) };
}

// ---------------------------------------------------------------------------
// Series por tipo de día
// ---------------------------------------------------------------------------

export interface DaySetsRow {
  dayName: string;
  sets: number;
  vsPreviousPct: number | null;
}

function setsByDay(logs: LogsData, cycle: number, weekNumbers: number[]): Map<string, number> {
  const weeks = new Set(weekNumbers);
  const m = new Map<string, number>();
  logs.sessions
    .filter((s) => s.status === "completed" && (s.cycle ?? 0) === cycle && weeks.has(s.weekNumber))
    .forEach((s) => {
      const sets = s.exercises.reduce((sum, ex) => sum + ex.sets.filter(isSetLogged).length, 0);
      m.set(s.dayName, (m.get(s.dayName) ?? 0) + sets);
    });
  return m;
}

/** Series totales por tipo de día del período (Upper/Lower/Push/Pull) — vista alternativa a "por músculo". */
export function getSetsByDayType(logs: LogsData, program: Program, cycle: number, period: PeriodRef): DaySetsRow[] {
  const weeks = dataWeeksInPeriod(program, period);
  const previousPeriod = getPreviousPeriod(program, period);
  const prevWeeks = previousPeriod ? dataWeeksInPeriod(program, previousPeriod) : [];

  const current = setsByDay(logs, cycle, weeks);
  const previous = setsByDay(logs, cycle, prevWeeks);

  return DAY_ORDER.filter((d) => current.has(d)).map((dayName) => {
    const sets = current.get(dayName) ?? 0;
    const prevSets = previous.get(dayName);
    const vsPreviousPct = prevSets && prevSets > 0 ? ((sets - prevSets) / prevSets) * 100 : null;
    return { dayName, sets, vsPreviousPct };
  });
}

// ---------------------------------------------------------------------------
// Series por grupo muscular
// ---------------------------------------------------------------------------

export interface MuscleSetsRow {
  muscle: string;
  sets: number;
  vsPreviousPct: number | null;
}

/** Series ponderadas por músculo (1 por serie al primario, SECONDARY_MUSCLE_WEIGHT a cada secundario — ver `muscleMapping.ts`), sumando todas las sesiones del rango de semanas. */
function setsByMuscle(logs: LogsData, cycle: number, weekNumbers: number[]): Map<string, number> {
  const weeks = new Set(weekNumbers);
  const m = new Map<string, number>();
  logs.sessions
    .filter((s) => s.status === "completed" && (s.cycle ?? 0) === cycle && weeks.has(s.weekNumber))
    .forEach((s) => {
      s.exercises.forEach((ex) => {
        const setsCount = ex.sets.filter(isSetLogged).length;
        if (setsCount === 0) return;
        for (const { muscle, weight } of getMuscleContributions(ex.exercise, ex.originalExercise)) {
          m.set(muscle, (m.get(muscle) ?? 0) + setsCount * weight);
        }
      });
    });
  return m;
}

/** Series ponderadas por grupo muscular del período, con la variación vs. el período anterior (mismo criterio que "por tipo de día"). */
export function getSetsByMuscleGroup(logs: LogsData, program: Program, cycle: number, period: PeriodRef): MuscleSetsRow[] {
  const weeks = dataWeeksInPeriod(program, period);
  const previousPeriod = getPreviousPeriod(program, period);
  const prevWeeks = previousPeriod ? dataWeeksInPeriod(program, previousPeriod) : [];

  const current = setsByMuscle(logs, cycle, weeks);
  const previous = setsByMuscle(logs, cycle, prevWeeks);

  const order = [...MUSCLE_GROUPS, OTHER_MUSCLE_GROUP];
  return order
    .filter((m) => current.has(m))
    .map((muscle) => {
      const sets = current.get(muscle) ?? 0;
      const prevSets = previous.get(muscle);
      const vsPreviousPct = prevSets && prevSets > 0 ? ((sets - prevSets) / prevSets) * 100 : null;
      return { muscle, sets: Math.round(sets * 10) / 10, vsPreviousPct };
    });
}

// ---------------------------------------------------------------------------
// Lifestyle del período
// ---------------------------------------------------------------------------

export interface LifestylePeriodRow {
  key: LifestyleMetricKey;
  label: string;
  avg: number | null;
  format: (v: number) => string;
  vsPreviousPct: number | null;
}

/** Rango de fechas calendario cubierto por las sesiones (de cualquier estado final) de un conjunto de semanas del programa — el programa no tiene fechas fijas por semana. */
function getPeriodDateRange(logs: LogsData, cycle: number, weekNumbers: number[]): { start: string; end: string } | null {
  const weeks = new Set(weekNumbers);
  const dates = logs.sessions
    .filter((s) => (s.cycle ?? 0) === cycle && weeks.has(s.weekNumber) && s.status !== "in_progress")
    .map((s) => (s.completedAt ?? s.startedAt).slice(0, 10));
  if (dates.length === 0) return null;
  return { start: dates.reduce((a, b) => (a < b ? a : b)), end: dates.reduce((a, b) => (a > b ? a : b)) };
}

function averageInRange(daily: Map<string, number>, range: { start: string; end: string }): number | null {
  const values = [...daily.entries()].filter(([date]) => date >= range.start && date <= range.end).map(([, v]) => v);
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function getLifestylePeriod(
  logs: LogsData,
  cycle: number,
  weekNumbers: number[],
  previousWeekNumbers: number[]
): LifestylePeriodRow[] {
  const range = getPeriodDateRange(logs, cycle, weekNumbers);
  const prevRange = getPeriodDateRange(logs, cycle, previousWeekNumbers);
  if (!range) return [];

  const rows: LifestylePeriodRow[] = [];
  for (const cfg of metricConfigs(logs)) {
    if (cfg.entries.length === 0) continue;
    const daily = dailyValues(cfg.entries, cfg.dateOf, cfg.valueOf, cfg.combine);
    const avg = averageInRange(daily, range);
    if (avg === null) continue;
    const prevAvg = prevRange ? averageInRange(daily, prevRange) : null;
    const vsPreviousPct = prevAvg !== null && prevAvg !== 0 ? ((avg - prevAvg) / prevAvg) * 100 : null;
    rows.push({ key: cfg.key, label: cfg.label, avg, format: cfg.format, vsPreviousPct });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Destacado: margen para subir
// ---------------------------------------------------------------------------

export interface MarginToPushRow {
  dayName: string;
  exercise: string;
  targetRir: number;
  actualRir: number;
  weightKg: number;
  suggestedWeightKg: number;
  weekNumber: number;
}

/**
 * Ejercicios donde sobró RIR respecto al objetivo del programa, sin falsos
 * positivos: reps dentro o por encima del rango pedido, sin haber bajado el
 * peso entre series de la misma sesión, y fuera de semanas de deload. Un
 * registro por (día, ejercicio): el de la sesión más reciente del período.
 */
export function getMarginToPush(
  logs: LogsData,
  program: Program,
  flatDays: FlatProgramDay[],
  settings: AppSettings,
  cycle: number,
  period: PeriodRef
): MarginToPushRow[] {
  const weeks = dataWeeksInPeriod(program, period);
  const sessions = logs.sessions
    .filter(
      (s) =>
        s.status === "completed" &&
        (s.cycle ?? 0) === cycle &&
        weeks.includes(s.weekNumber) &&
        !isDeloadWeek(program, s.weekNumber)
    )
    .sort((a, b) => a.programIndex - b.programIndex);

  const byPair = new Map<string, MarginToPushRow>();

  for (const session of sessions) {
    const flatDay = flatDays[session.programIndex];
    if (!flatDay) continue;

    session.exercises.forEach((ex, exIndex) => {
      const group = flatDay.day.exerciseGroups[exIndex];
      if (!group) return;
      const literal = getLiteralWorkingSets(group);
      const loggedSets = ex.sets.filter(isSetLogged);
      if (loggedSets.length === 0) return;

      const weights = loggedSets.map((s) => s.weightKg as number);
      const weightDropped = weights.some((w, i) => i > 0 && w < weights[i - 1]);
      if (weightDropped) return;

      let targetSum = 0;
      let actualSum = 0;
      let count = 0;
      let belowRange = false;

      for (const set of loggedSets) {
        const literalSet = literal[set.setIndex];
        if (!literalSet || literalSet.targetRIR === "-" || set.reps === null || set.rir === null) continue;
        const targetRirNum = literalSet.targetRIR === "3+" ? 3.5 : Number(literalSet.targetRIR);
        if (Number.isNaN(targetRirNum)) continue;
        const range = parseRepRange(literalSet.reps);
        if (set.reps < range.min) belowRange = true;
        targetSum += targetRirNum;
        actualSum += rirToNumber(set.rir);
        count += 1;
      }
      if (count === 0 || belowRange) return;

      const avgTarget = targetSum / count;
      const avgActual = actualSum / count;
      if (avgActual - avgTarget < SUMMARY_CONFIG.marginToPushMinRirSurplus) return;

      const lastWeight = weights[weights.length - 1];
      const incrementKg = getIncrementKg(settings.exerciseIncrements, ex.exercise);

      byPair.set(`${session.dayName}::${ex.exercise}`, {
        dayName: session.dayName,
        exercise: ex.exercise,
        targetRir: Math.round(avgTarget * 2) / 2,
        actualRir: Math.round(avgActual * 2) / 2,
        weightKg: lastWeight,
        suggestedWeightKg: roundToStep(lastWeight + incrementKg, 0.5),
        weekNumber: session.weekNumber,
      });
    });
  }

  return [...byPair.values()].sort((a, b) => (b.actualRir - b.targetRir) - (a.actualRir - a.targetRir));
}
