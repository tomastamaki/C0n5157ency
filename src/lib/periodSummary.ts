import type { LogsData } from "../types/logs";
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
import { getExerciseProgressForWeek, getWeeksWithData, type ExerciseProgressStatus } from "./progressEngine";

export function getTotalWeeks(program: Program): number {
  return program.blocks.reduce((sum, b) => sum + b.weeks.length, 0);
}

function daysPerWeek(program: Program): number {
  return program.blocks[0]?.weeks[0]?.days.length ?? 0;
}

export function getPeriodLabel(weekNumber: number): string {
  return `Semana ${weekNumber}`;
}

/** Última semana anterior a `weekNumber` que no sea de deload, o null si no hay ninguna (deload nunca sirve de base de comparación). */
export function getPreviousNonDeloadWeek(program: Program, weekNumber: number): number | null {
  let w = weekNumber - 1;
  while (w >= 1) {
    if (!isDeloadWeek(program, w)) return w;
    w -= 1;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cabecera + métricas globales
// ---------------------------------------------------------------------------

export interface PeriodData {
  weekNumber: number;
  isDeload: boolean;
  sessionsCompleted: number;
  sessionsPlanned: number;
  tonnageKg: number;
  totalSets: number;
  avgRir: number | null;
  avgSessionDurationSec: number | null;
  prCount: number;
}

export function getPeriodData(logs: LogsData, program: Program, cycle: number, weekNumber: number): PeriodData {
  const sessions = logs.sessions.filter((s) => (s.cycle ?? 0) === cycle && s.weekNumber === weekNumber);
  const completedSessions = sessions.filter((s) => s.status === "completed");

  let tonnageKg = 0;
  let totalSets = 0;
  const rirValues: number[] = [];
  for (const s of completedSessions) {
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
  const durations = completedSessions.map((s) => s.durationSec).filter((d): d is number => d !== null);
  const avgSessionDurationSec = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  const prCount = getPersonalRecordEvents(logs).filter(
    (e) => e.kind === "weight" && e.cycle === cycle && e.weekNumber === weekNumber
  ).length;

  return {
    weekNumber,
    isDeload: isDeloadWeek(program, weekNumber),
    sessionsCompleted: completedSessions.length,
    sessionsPlanned: daysPerWeek(program),
    tonnageKg,
    totalSets,
    avgRir,
    avgSessionDurationSec,
    prCount,
  };
}

// ---------------------------------------------------------------------------
// Por ejercicio (agrupado por tipo de día) — bases de comparación independientes
// ---------------------------------------------------------------------------

export interface ComparisonCell {
  variationPct: number | null;
  /** Semana de la que sale la base, o null si no hay ninguna base disponible. */
  baseWeekNumber: number | null;
  /** true = la base coincide con la columna "estándar" (semana 1 para inicio, la semana no-deload inmediatamente anterior para anterior) y no hace falta etiqueta de origen. */
  isStandardBase: boolean;
}

/** Mismo vocabulario que el motor de progresión (progressEngine.ts) — fuente única para "¿este ejercicio progresó?". */
export type ExerciseStatus = ExerciseProgressStatus;

export interface ExerciseRow {
  dayName: string;
  exercise: string;
  avgE1rm: number | null;
  setsCount: number;
  status: ExerciseStatus;
  /** Motivo concreto de la clasificación (ver progressEngine.ts). */
  statusDetail: string;
  /** true si la semana actual es el primer registro histórico de este ejercicio (variante) — no hay ninguna base para comparar. */
  isFirstRecordOverall: boolean;
  vsInicio: ComparisonCell;
  vsAnterior: ComparisonCell;
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

/** Semanas (ascendente, sin deload) anteriores a `beforeWeek` en las que este ejercicio (día + nombre efectivamente hecho) tiene al menos una serie registrada. */
function recordedWeeksBefore(
  logs: LogsData,
  program: Program,
  cycle: number,
  dayName: string,
  exercise: string,
  beforeWeek: number
): number[] {
  return getWeeksWithData(logs, program, cycle, dayName, exercise).filter((w) => w < beforeWeek);
}

function buildComparisonCell(
  logs: LogsData,
  cycle: number,
  dayName: string,
  exercise: string,
  currentAvg: number,
  baseWeek: number,
  standardWeek: number | null
): ComparisonCell {
  const { avg } = avgE1rmFor(logs, cycle, dayName, exercise, [baseWeek]);
  const variationPct = avg !== null && avg !== 0 ? ((currentAvg - avg) / avg) * 100 : null;
  return { variationPct, baseWeekNumber: baseWeek, isStandardBase: baseWeek === standardWeek };
}

const EMPTY_CELL: ComparisonCell = { variationPct: null, baseWeekNumber: null, isStandardBase: false };

/**
 * Filas de la tabla "por ejercicio", agrupadas por tipo de día. Cada fila es
 * un par (tipo de día, ejercicio efectivamente hecho) — si el mismo nombre
 * aparece en dos días, son dos filas separadas.
 *
 * Las bases de comparación son independientes por ejercicio: "inicio" es la
 * semana (sin deload) más vieja con registro de ESE ejercicio, no
 * necesariamente la semana 1; "anterior" es la semana (sin deload) más
 * reciente con registro antes de la actual, no necesariamente la
 * inmediatamente anterior. Así un ejercicio con pocos registros (porque
 * antes se hacía otra variante) siempre tiene con qué compararse, en vez de
 * quedar en "—" solo porque la semana estándar no lo incluye.
 */

export function getExerciseRows(
  logs: LogsData,
  program: Program,
  flatDays: FlatProgramDay[],
  cycle: number,
  weekNumber: number
): ExerciseRow[] {
  const pairs = new Set<string>();
  logs.sessions
    .filter((s) => s.status === "completed" && (s.cycle ?? 0) === cycle && s.weekNumber === weekNumber)
    .forEach((s) => s.exercises.forEach((ex) => {
      if (ex.sets.some(isSetLogged)) pairs.add(`${s.dayName}::${ex.exercise}`);
    }));

  const standardAnterior = getPreviousNonDeloadWeek(program, weekNumber);
  const isDeload = isDeloadWeek(program, weekNumber);

  const rows: ExerciseRow[] = [];
  for (const pair of pairs) {
    const [dayName, exercise] = pair.split("::");
    const { avg, sets } = avgE1rmFor(logs, cycle, dayName, exercise, [weekNumber]);
    const priorWeeks = recordedWeeksBefore(logs, program, cycle, dayName, exercise, weekNumber);
    const isFirstRecordOverall = priorWeeks.length === 0;

    let vsInicio = EMPTY_CELL;
    let vsAnterior = EMPTY_CELL;
    const anteriorWeek = priorWeeks.length > 0 ? priorWeeks[priorWeeks.length - 1] : null;
    if (!isFirstRecordOverall && avg !== null) {
      const inicioWeek = priorWeeks[0];
      vsInicio = buildComparisonCell(logs, cycle, dayName, exercise, avg, inicioWeek, 1);
      vsAnterior = buildComparisonCell(logs, cycle, dayName, exercise, avg, anteriorWeek as number, standardAnterior);
    }

    const { status, detail } = isFirstRecordOverall
      ? { status: "new" as const, detail: "primer registro de este ejercicio (variante): sin base para comparar" }
      : getExerciseProgressForWeek(logs, flatDays, cycle, dayName, exercise, weekNumber, anteriorWeek, isDeload);

    rows.push({ dayName, exercise, avgE1rm: avg, setsCount: sets, status, statusDetail: detail, isFirstRecordOverall, vsInicio, vsAnterior });
  }

  return rows.sort((a, b) => {
    const dayDiff = DAY_ORDER.indexOf(a.dayName) - DAY_ORDER.indexOf(b.dayName);
    if (dayDiff !== 0) return dayDiff;
    return a.exercise.localeCompare(b.exercise, "es");
  });
}

/** Variación promedio de e1RM del período (promedio de las filas con comparación válida), contra el anterior y contra el inicio — cada fila con su propia base. */
export function getPerformanceVariation(rows: ExerciseRow[]): { vsAnterior: number | null; vsInicio: number | null } {
  function avgOf(cells: ComparisonCell[]): number | null {
    const vals = cells.filter((c) => c.variationPct !== null).map((c) => c.variationPct as number);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return { vsAnterior: avgOf(rows.map((r) => r.vsAnterior)), vsInicio: avgOf(rows.map((r) => r.vsInicio)) };
}

// ---------------------------------------------------------------------------
// Series por tipo de día
// ---------------------------------------------------------------------------

export interface DaySetsRow {
  dayName: string;
  sets: number;
  vsPreviousPct: number | null;
}

function setsByDay(logs: LogsData, cycle: number, weekNumber: number | null): Map<string, number> {
  const m = new Map<string, number>();
  if (weekNumber === null) return m;
  logs.sessions
    .filter((s) => s.status === "completed" && (s.cycle ?? 0) === cycle && s.weekNumber === weekNumber)
    .forEach((s) => {
      const sets = s.exercises.reduce((sum, ex) => sum + ex.sets.filter(isSetLogged).length, 0);
      m.set(s.dayName, (m.get(s.dayName) ?? 0) + sets);
    });
  return m;
}

/** Series totales por tipo de día de la semana (Upper/Lower/Push/Pull) — vista alternativa a "por músculo". */
export function getSetsByDayType(logs: LogsData, program: Program, cycle: number, weekNumber: number): DaySetsRow[] {
  const previousWeek = getPreviousNonDeloadWeek(program, weekNumber);
  const current = setsByDay(logs, cycle, weekNumber);
  const previous = setsByDay(logs, cycle, previousWeek);

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

/** Series ponderadas por músculo (1 por serie al primario, SECONDARY_MUSCLE_WEIGHT a cada secundario — ver `muscleMapping.ts`), de la semana. */
function setsByMuscle(logs: LogsData, cycle: number, weekNumber: number | null): Map<string, number> {
  const m = new Map<string, number>();
  if (weekNumber === null) return m;
  logs.sessions
    .filter((s) => s.status === "completed" && (s.cycle ?? 0) === cycle && s.weekNumber === weekNumber)
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

/** Series ponderadas por grupo muscular de la semana, con la variación vs. la semana anterior (mismo criterio que "por tipo de día"). */
export function getSetsByMuscleGroup(logs: LogsData, program: Program, cycle: number, weekNumber: number): MuscleSetsRow[] {
  const previousWeek = getPreviousNonDeloadWeek(program, weekNumber);
  const current = setsByMuscle(logs, cycle, weekNumber);
  const previous = setsByMuscle(logs, cycle, previousWeek);

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
// Lifestyle de la semana
// ---------------------------------------------------------------------------

export interface LifestylePeriodRow {
  key: LifestyleMetricKey;
  label: string;
  avg: number | null;
  format: (v: number) => string;
  vsPreviousPct: number | null;
}

/** Rango de fechas calendario cubierto por las sesiones (de cualquier estado final) de una semana del programa — el programa no tiene fechas fijas por semana. */
function getWeekDateRange(logs: LogsData, cycle: number, weekNumber: number | null): { start: string; end: string } | null {
  if (weekNumber === null) return null;
  const dates = logs.sessions
    .filter((s) => (s.cycle ?? 0) === cycle && s.weekNumber === weekNumber && s.status !== "in_progress")
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
  weekNumber: number,
  previousWeekNumber: number | null
): LifestylePeriodRow[] {
  const range = getWeekDateRange(logs, cycle, weekNumber);
  const prevRange = getWeekDateRange(logs, cycle, previousWeekNumber);
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
 * peso entre series de la misma sesión, y fuera de semanas de deload.
 */
export function getMarginToPush(
  logs: LogsData,
  program: Program,
  flatDays: FlatProgramDay[],
  settings: AppSettings,
  cycle: number,
  weekNumber: number
): MarginToPushRow[] {
  const sessions = logs.sessions
    .filter(
      (s) =>
        s.status === "completed" &&
        (s.cycle ?? 0) === cycle &&
        s.weekNumber === weekNumber &&
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
