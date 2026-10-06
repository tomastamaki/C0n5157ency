import type { LogsData, SleepEntry, WorkoutSession } from "../types/logs";
import { isSetLogged, rirToNumber } from "../types/logs";
import type { FlatProgramDay, Program } from "../types/program";
import { getLiteralWorkingSets } from "./program";
import { estimatedE1RM } from "./e1rm";
import { globalSeq } from "./cycle";
import { localDateKey } from "./time";
import {
  DAY_MUSCLES,
  LAYER2_MIN_SESSIONS,
  LAYER2_PARAM_WEIGHTS,
  LAYER2_RECENCY_WEIGHTS,
  LAYER2_THRESHOLDS,
  LAYER2_WINDOW_SIZE,
  MUSCLE_RECOVERY_HOURS,
  PARAM_THRESHOLDS,
  RECOVERY_INTENSITY_ADJUSTMENT,
  SLEEP_MIN_NIGHTS,
} from "./recoveryConfig";

function getDayMuscles(dayName: string): string[] {
  return DAY_MUSCLES[dayName] ?? [];
}

function isDeloadWeek(program: Program, weekNumber: number): boolean {
  const week = program.blocks.flatMap((b) => b.weeks).find((w) => w.weekNumber === weekNumber);
  return week ? week.label.toLowerCase().includes("deload") : false;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

// ---------------------------------------------------------------------------
// Capa 1: recuperación muscular
// ---------------------------------------------------------------------------

export interface MuscleAlert {
  muscle: string;
  hoursSince: number;
  recommendedHours: number;
}

/** Sesión completada más reciente (cualquier ciclo) cuyo día haya trabajado un músculo dado. */
function findLastSessionForMuscle(completedByRecency: WorkoutSession[], muscle: string): WorkoutSession | null {
  return completedByRecency.find((s) => getDayMuscles(s.dayName).includes(muscle)) ?? null;
}

export function checkMuscleRecovery(logs: LogsData, todayDayName: string, now: Date = new Date()): MuscleAlert[] {
  const musclesToday = getDayMuscles(todayDayName);
  if (musclesToday.length === 0) return [];

  const completedByRecency = [...logs.sessions]
    .filter((s) => s.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.completedAt ?? b.startedAt).getTime() - new Date(a.completedAt ?? a.startedAt).getTime()
    );

  const alerts: MuscleAlert[] = [];

  for (const muscle of musclesToday) {
    const lastSession = findLastSessionForMuscle(completedByRecency, muscle);
    if (!lastSession) continue;

    const lastDate = new Date(lastSession.completedAt ?? lastSession.startedAt);
    const hoursSince = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);

    const rirValues = lastSession.exercises
      .flatMap((ex) => ex.sets)
      .filter(isSetLogged)
      .map((s) => rirToNumber(s.rir!));
    const avgRir = average(rirValues);

    let recommendedHours = MUSCLE_RECOVERY_HOURS[muscle] ?? 48;
    if (avgRir !== null) {
      if (avgRir >= RECOVERY_INTENSITY_ADJUSTMENT.lightRirThreshold) {
        recommendedHours *= 1 - RECOVERY_INTENSITY_ADJUSTMENT.lightReductionPct;
      } else if (avgRir <= RECOVERY_INTENSITY_ADJUSTMENT.hardRirThreshold) {
        recommendedHours *= 1 + RECOVERY_INTENSITY_ADJUSTMENT.hardIncreasePct;
      }
    }

    if (hoursSince < recommendedHours) {
      alerts.push({ muscle, hoursSince, recommendedHours });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Capa 2: score de fatiga general
// ---------------------------------------------------------------------------

function getEligibleSessions(logs: LogsData, program: Program, cycle: number): WorkoutSession[] {
  return logs.sessions
    .filter((s) => s.status === "completed" && (s.cycle ?? 0) === cycle && !isDeloadWeek(program, s.weekNumber))
    .sort((a, b) => globalSeq(b) - globalSeq(a));
}

function getSessionActualRirAvg(session: WorkoutSession): number | null {
  const values = session.exercises
    .flatMap((ex) => ex.sets)
    .filter(isSetLogged)
    .map((s) => rirToNumber(s.rir!));
  return average(values);
}

/** RIR objetivo promedio de una sesión, cruzando contra el programa (el objetivo varía semana a semana). */
function getSessionTargetRirAvg(session: WorkoutSession, flatDays: FlatProgramDay[]): number | null {
  const flatDay = flatDays[session.programIndex];
  if (!flatDay) return null;

  const values: number[] = [];
  session.exercises.forEach((ex, i) => {
    const group = flatDay.day.exerciseGroups[i];
    if (!group) return;
    const literal = getLiteralWorkingSets(group);
    for (const set of ex.sets) {
      if (!isSetLogged(set)) continue;
      const literalSet = literal[set.setIndex];
      if (!literalSet || literalSet.targetRIR === "-") continue;
      const num = literalSet.targetRIR === "3+" ? 3.5 : Number(literalSet.targetRIR);
      if (!Number.isNaN(num)) values.push(num);
    }
  });
  return average(values);
}

/** Mejor e1RM entre las series registradas de un ejercicio dentro de una sesión. */
function getExerciseBestE1rm(sets: WorkoutSession["exercises"][number]["sets"]): number | null {
  const values = sets
    .filter(isSetLogged)
    .filter((s) => s.weightKg !== null && s.reps !== null && s.rir !== null)
    .map((s) => estimatedE1RM(s.weightKg as number, s.reps as number, rirToNumber(s.rir!)));
  return values.length > 0 ? Math.max(...values) : null;
}

/**
 * % de cambio del e1RM (1RM estimado ajustado por RIR) de esta sesión vs. el
 * promedio de las 2-3 sesiones previas de cada mismo ejercicio (independiente
 * del sistema de sugerencia de progresión, para no contaminar el score con
 * ese otro cálculo). Usa e1RM en vez de peso×reps para no leer como
 * "sin progreso" una sesión donde se mantuvo el peso pero subieron las reps
 * o bajó el esfuerzo (RIR).
 */
function getSessionOwnProgressPct(session: WorkoutSession, allSessions: WorkoutSession[]): number | null {
  const sessionSeq = globalSeq(session);
  const pctChanges: number[] = [];

  for (const ex of session.exercises) {
    const thisE1rm = getExerciseBestE1rm(ex.sets);
    if (thisE1rm === null) continue;

    const priorE1rms = allSessions
      .filter((s) => s.status === "completed" && globalSeq(s) < sessionSeq)
      .sort((a, b) => globalSeq(b) - globalSeq(a))
      .map((s) => s.exercises.find((e) => e.exercise === ex.exercise))
      .filter((e): e is (typeof session.exercises)[number] => e !== undefined)
      .slice(0, 3)
      .map((priorEx) => getExerciseBestE1rm(priorEx.sets))
      .filter((v): v is number => v !== null);

    if (priorE1rms.length === 0) continue;
    const avgPrior = average(priorE1rms)!;
    pctChanges.push(((thisE1rm - avgPrior) / avgPrior) * 100);
  }

  return average(pctChanges);
}

function getSessionSetsCompletedPct(session: WorkoutSession): number | null {
  const total = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  if (total === 0) return null;
  const done = session.exercises.reduce((sum, ex) => sum + ex.sets.filter(isSetLogged).length, 0);
  return (done / total) * 100;
}

function getSessionSleepScore(session: WorkoutSession, sleepEntries: SleepEntry[]): number | null {
  const dateKey = localDateKey(session.completedAt ?? session.startedAt);
  return sleepEntries.find((e) => e.date === dateKey)?.score ?? null;
}

function weightedAverage(pairs: { value: number; weight: number }[]): number | null {
  const totalWeight = pairs.reduce((s, p) => s + p.weight, 0);
  if (totalWeight === 0) return null;
  return pairs.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight;
}

export type ParamKey = "feeling" | "rirDeviation" | "ownProgress" | "setsCompleted" | "sleep";

export interface Layer2ParamResult {
  key: ParamKey;
  label: string;
  rawValue: number | null;
  classified: -1 | 0 | 1 | null;
  weight: number;
}

export interface Layer2Result {
  score: number;
  params: Layer2ParamResult[];
  sessionsUsed: number;
}

function classifyFeeling(v: number): -1 | 0 | 1 {
  if (v < PARAM_THRESHOLDS.feeling.low) return -1;
  if (v >= PARAM_THRESHOLDS.feeling.high) return 1;
  return 0;
}
function classifyRirDeviation(v: number): -1 | 0 | 1 {
  if (v <= PARAM_THRESHOLDS.rirDeviation.low) return -1;
  if (v >= PARAM_THRESHOLDS.rirDeviation.high) return 1;
  return 0;
}
function classifyOwnProgress(v: number): -1 | 0 | 1 {
  if (v < PARAM_THRESHOLDS.ownProgressPct.low) return -1;
  if (v > PARAM_THRESHOLDS.ownProgressPct.high) return 1;
  return 0;
}
function classifySetsCompleted(v: number): -1 | 0 | 1 {
  if (v < PARAM_THRESHOLDS.setsCompletedPct.low) return -1;
  if (v > PARAM_THRESHOLDS.setsCompletedPct.high) return 1;
  return 0;
}
function classifySleep(v: number): -1 | 0 | 1 {
  if (v < PARAM_THRESHOLDS.sleepScore.low) return -1;
  if (v > PARAM_THRESHOLDS.sleepScore.high) return 1;
  return 0;
}

function computeLayer2(
  window: WorkoutSession[],
  allCompletedSessions: WorkoutSession[],
  flatDays: FlatProgramDay[],
  sleepEntries: SleepEntry[]
): Layer2Result | null {
  if (window.length < LAYER2_MIN_SESSIONS) return null;

  const weights = window.map((_, i) => LAYER2_RECENCY_WEIGHTS[i] ?? 1);

  function paramAverage(values: (number | null)[]): number | null {
    const pairs = values
      .map((v, i) => (v !== null ? { value: v, weight: weights[i] } : null))
      .filter((p): p is { value: number; weight: number } => p !== null);
    return weightedAverage(pairs);
  }

  const feelingAvg = paramAverage(window.map((s) => s.feeling));
  const rirAvg = paramAverage(
    window.map((s) => {
      const actual = getSessionActualRirAvg(s);
      const target = getSessionTargetRirAvg(s, flatDays);
      return actual !== null && target !== null ? actual - target : null;
    })
  );
  const progressAvg = paramAverage(window.map((s) => getSessionOwnProgressPct(s, allCompletedSessions)));
  const setsAvg = paramAverage(window.map((s) => getSessionSetsCompletedPct(s)));

  const sleepValues = window.map((s) => getSessionSleepScore(s, sleepEntries));
  const sleepNights = sleepValues.filter((v) => v !== null).length;
  const sleepAvg = sleepNights >= SLEEP_MIN_NIGHTS ? paramAverage(sleepValues) : null;

  const params: Layer2ParamResult[] = [
    {
      key: "feeling",
      label: "Feeling post-entreno",
      rawValue: feelingAvg,
      classified: feelingAvg !== null ? classifyFeeling(feelingAvg) : null,
      weight: LAYER2_PARAM_WEIGHTS.feeling,
    },
    {
      key: "rirDeviation",
      label: "Desvío de RIR",
      rawValue: rirAvg,
      classified: rirAvg !== null ? classifyRirDeviation(rirAvg) : null,
      weight: LAYER2_PARAM_WEIGHTS.rirDeviation,
    },
    {
      key: "ownProgress",
      label: "Progreso propio (vs. tu historial)",
      rawValue: progressAvg,
      classified: progressAvg !== null ? classifyOwnProgress(progressAvg) : null,
      weight: LAYER2_PARAM_WEIGHTS.ownProgress,
    },
    {
      key: "setsCompleted",
      label: "Series completadas",
      rawValue: setsAvg,
      classified: setsAvg !== null ? classifySetsCompleted(setsAvg) : null,
      weight: LAYER2_PARAM_WEIGHTS.setsCompleted,
    },
    {
      key: "sleep",
      label: "Calidad de sueño",
      rawValue: sleepAvg,
      classified: sleepAvg !== null ? classifySleep(sleepAvg) : null,
      weight: LAYER2_PARAM_WEIGHTS.sleep,
    },
  ];

  const available = params.filter((p) => p.classified !== null);
  if (available.length === 0) return null;

  const totalWeight = available.reduce((s, p) => s + p.weight, 0);
  const score = available.reduce((s, p) => s + p.weight * (p.classified as number), 0) / totalWeight;

  return { score, params, sessionsUsed: window.length };
}

// ---------------------------------------------------------------------------
// Orquestación
// ---------------------------------------------------------------------------

export type RecommendationLevel = "rest" | "normal" | "push" | "deload" | "muscle-alert" | "not-enough-data";

export interface Recommendation {
  level: RecommendationLevel;
  title: string;
  detail: string;
  trendNote: string | null;
  muscleAlerts: MuscleAlert[];
  layer2: Layer2Result | null;
}

export function getRecommendation(
  logs: LogsData,
  program: Program,
  flatDays: FlatProgramDay[],
  todayDayName: string,
  todayWeekNumber: number,
  cycle: number
): Recommendation {
  if (isDeloadWeek(program, todayWeekNumber)) {
    return {
      level: "deload",
      title: "Semana de deload",
      detail: "Seguí el plan reducido tal cual está programado.",
      trendNote: null,
      muscleAlerts: [],
      layer2: null,
    };
  }

  const muscleAlerts = checkMuscleRecovery(logs, todayDayName);
  if (muscleAlerts.length > 0) {
    const detail = muscleAlerts
      .map(
        (a) =>
          `${capitalize(a.muscle)} entrenado hace ${Math.round(a.hoursSince)}h, recomendado ${Math.round(
            a.recommendedHours
          )}h — considerá descansar o ajustar el volumen de hoy.`
      )
      .join("\n");
    return {
      level: "muscle-alert",
      title: "Considerá descansar o ajustar el volumen",
      detail,
      trendNote: null,
      muscleAlerts,
      layer2: null,
    };
  }

  const eligible = getEligibleSessions(logs, program, cycle);
  const recentWindow = eligible.slice(0, LAYER2_WINDOW_SIZE);
  const layer2 = computeLayer2(recentWindow, logs.sessions, flatDays, logs.sleepEntries);

  if (!layer2) {
    return {
      level: "not-enough-data",
      title: "Normal",
      detail: "Todavía no hay suficiente historial (mínimo 3 sesiones) para calcular una recomendación de fatiga.",
      trendNote: null,
      muscleAlerts: [],
      layer2: null,
    };
  }

  const previousWindow = eligible.slice(LAYER2_WINDOW_SIZE, LAYER2_WINDOW_SIZE * 2);
  const previousLayer2 =
    previousWindow.length >= LAYER2_MIN_SESSIONS
      ? computeLayer2(previousWindow, logs.sessions, flatDays, logs.sleepEntries)
      : null;

  const trendNote =
    previousLayer2 && layer2.score < previousLayer2.score ? "Venís en baja las últimas semanas." : null;

  let level: RecommendationLevel;
  let title: string;
  let detail: string;
  if (layer2.score <= LAYER2_THRESHOLDS.rest) {
    level = "rest";
    title = "Descansá";
    detail = "Considerá un día extra de descanso, o bajar el volumen de la sesión de hoy.";
  } else if (layer2.score >= LAYER2_THRESHOLDS.pushForward) {
    level = "push";
    title = "Dale para adelante";
    detail = "Tu recuperación viene bien: animate a un peso extra sobre lo sugerido.";
  } else {
    level = "normal";
    title = "Normal";
    detail = "Seguí el plan tal cual está.";
  }

  return { level, title, detail, trendNote, muscleAlerts: [], layer2 };
}
