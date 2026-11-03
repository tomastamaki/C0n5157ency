import type { LogsData, WorkoutSession } from "../types/logs";
import { isSetLogged, rirToNumber } from "../types/logs";
import type { FlatProgramDay, Program } from "../types/program";
import { getExerciseProgression, getPctImprovement } from "./history";
import { getPersonalRecordEvents } from "./records";
import { estimatedE1RM, PROGRESSION_CONFIG } from "./e1rm";
import { isDeloadWeek } from "./recommendation";
import { getExerciseMuscles } from "./muscleMapping";
import { getExerciseProgressForWeek, getWeeksWithData, isProgressingOrImproving } from "./progressEngine";
import { globalSeq } from "./cycle";

/** Los KPIs de "momentum" (racha, atención, destacado, último entrenamiento) solo miran el ciclo actual. */
function filterByCycle(logs: LogsData, cycle: number): LogsData {
  return { ...logs, sessions: logs.sessions.filter((s) => (s.cycle ?? 0) === cycle) };
}

/** Racha de días consecutivos completados en el ciclo actual, mirando hacia atrás. Se corta en el primer salteado. */
export function getCurrentStreak(logs: LogsData, cycle: number): number {
  const sessions = filterByCycle(logs, cycle)
    .sessions.filter((s) => s.status !== "in_progress")
    .sort((a, b) => b.programIndex - a.programIndex);
  let streak = 0;
  for (const s of sessions) {
    if (s.status === "completed") streak++;
    else break;
  }
  return streak;
}

export interface PREvent {
  exercise: string;
  newWeight: number;
  previousWeight: number | null;
  date: string;
  sessionId: string;
}

/**
 * Récords de peso logrados durante una semana de programa puntual del ciclo
 * actual. La base de comparación ("¿es un récord?") es siempre el historial
 * completo (todos los ciclos): un PR de peso es real sin importar si se
 * reinició el programa. Se apoya en `getPersonalRecordEvents`, la misma
 * línea de tiempo que usa la vista de "PR actual de todos los ejercicios".
 */
export function getPRsInWeek(logs: LogsData, weekNumber: number, cycle: number): PREvent[] {
  return getPersonalRecordEvents(logs)
    .filter((e) => e.kind === "weight" && e.weekNumber === weekNumber && e.cycle === cycle)
    .map((e) => ({
      exercise: e.exercise,
      newWeight: e.weightKg,
      previousWeight: e.previousBest,
      date: e.date,
      sessionId: e.sessionId,
    }));
}

export interface AttentionFlag {
  exercise: string;
  kind: "e1rm_decline" | "stalled";
  detail: string;
}

/**
 * Señal calculada puramente sobre lo ya registrado en el ciclo actual (sin
 * re-derivar el plan del programa, que cambia semana a semana): el e1RM
 * estimado (peso ajustado por reps y RIR) bajó de forma sostenida.
 *
 * Usa e1RM y no el peso ni las reps por separado, para no marcar casos donde
 * el peso subió pero las reps bajaron (progreso real) ni casos donde las
 * reps bajaron pero el RIR subió (mismo esfuerzo real). Las semanas de
 * deload se excluyen del todo de la comparación porque ahí se entrena más
 * liviano a propósito. "Sostenido" exige que las últimas N sesiones (no solo
 * la última) estén por debajo del promedio previo, con un margen de
 * tolerancia para no marcar por ruido normal entre sesiones.
 *
 * Se agrupa por ejercicio + tipo de día (no solo por nombre): el mismo
 * nombre puede ser un sustituto en una rutina y el prescripto en otra con
 * una prescripción de reps distinta (ej. "DB Bench Press" en Upper vs.
 * Push), y mezclar esos dos historiales daría una caída/mejora falsa.
 *
 * Veto (fase 2): un ejercicio que la semana más reciente clasificó como
 * Progresa, o Mixto con e1RM al alza (motor único de progresión, ver
 * `progressEngine.ts`), nunca se marca, aunque el chequeo de e1RM sostenido
 * lo hubiera disparado.
 */
export function getAttentionFlags(
  logs: LogsData,
  cycle: number,
  program: Program,
  flatDays: FlatProgramDay[],
  limit = 3
): AttentionFlag[] {
  const byExercise = new Map<string, { exercise: string; points: { e1rm: number; weekNumber: number }[] }>();
  const completed = filterByCycle(logs, cycle)
    .sessions.filter((s) => s.status === "completed" && !isDeloadWeek(program, s.weekNumber))
    .sort((a, b) => a.programIndex - b.programIndex);

  for (const session of completed) {
    for (const ex of session.exercises) {
      const set = ex.sets.find((s) => s.setIndex === 0);
      if (!set || !isSetLogged(set) || set.weightKg === null || set.reps === null || set.rir === null) continue;
      const key = `${session.dayName}::${ex.exercise}`;
      if (!byExercise.has(key)) byExercise.set(key, { exercise: ex.exercise, points: [] });
      byExercise.get(key)!.points.push({
        e1rm: estimatedE1RM(set.weightKg, set.reps, rirToNumber(set.rir)),
        weekNumber: session.weekNumber,
      });
    }
  }

  function isVetoed(dayName: string, exercise: string): boolean {
    const weeks = getWeeksWithData(logs, program, cycle, dayName, exercise);
    if (weeks.length < 2) return false;
    const latest = weeks[weeks.length - 1];
    const base = weeks[weeks.length - 2];
    const progress = getExerciseProgressForWeek(logs, flatDays, cycle, dayName, exercise, latest, base, false);
    return isProgressingOrImproving(progress);
  }

  const flags: AttentionFlag[] = [];
  const declineCount = PROGRESSION_CONFIG.attentionDeclineSessionCount;
  const tolerance = PROGRESSION_CONFIG.attentionTolerancePct / 100;
  const stalledCount = PROGRESSION_CONFIG.stalledSessionCount;

  for (const [key, { exercise, points }] of byExercise) {
    const dayName = key.split("::")[0];

    if (points.length >= declineCount + 1) {
      const recent = points.slice(-declineCount);
      const baselinePoints = points.slice(0, points.length - declineCount);
      const baseline = baselinePoints.reduce((sum, p) => sum + p.e1rm, 0) / baselinePoints.length;
      const threshold = baseline * (1 - tolerance);

      const sustainedDecline = recent.every((p) => p.e1rm < threshold);
      if (sustainedDecline && !isVetoed(dayName, exercise)) {
        const last = recent[recent.length - 1];
        flags.push({
          exercise,
          kind: "e1rm_decline",
          detail: `e1RM bajó de ${Math.round(baseline)} a ${Math.round(last.e1rm)}kg en ${declineCount} sesiones`,
        });
        continue;
      }
    }

    // Estancamiento: las últimas `stalledCount` semanas (cada una contra la inmediatamente anterior) salieron "Estable".
    if (points.length >= stalledCount + 1) {
      const weeks = points.slice(-(stalledCount + 1)).map((p) => p.weekNumber);
      const allStable = weeks.slice(1).every((week, idx) => {
        const base = weeks[idx];
        const progress = getExerciseProgressForWeek(logs, flatDays, cycle, dayName, exercise, week, base, false);
        return progress.status === "stable";
      });
      if (allStable && !isVetoed(dayName, exercise)) {
        flags.push({
          exercise,
          kind: "stalled",
          detail: `mismo rendimiento en las últimas ${stalledCount} sesiones (sin avance ni retroceso)`,
        });
      }
    }
  }

  return flags.slice(0, limit);
}

export interface HighlightExercise {
  exercise: string;
  pct: number;
}

/**
 * El ejercicio con mayor % de mejora en el ciclo actual (primer registro vs.
 * más reciente de ese ciclo). Se mira por ejercicio + tipo de día, para no
 * mezclar el historial de un mismo nombre usado como sustituto en una
 * rutina y prescripto en otra con una prescripción de reps distinta.
 *
 * Gate (fase 2): además de tener %-mejora positivo a largo plazo, la semana
 * más reciente tiene que clasificar como Progresa (o Mixto con e1RM al
 * alza) contra su propia base — mismo motor único que el resto de la app —
 * para no destacar un ejercicio que viene mejorando en general pero que
 * ahora mismo está retrocediendo.
 */
export function getHighlightExercise(logs: LogsData, cycle: number, program: Program, flatDays: FlatProgramDay[]): HighlightExercise | null {
  const scoped = filterByCycle(logs, cycle);
  const pairs = new Set<string>();
  for (const s of scoped.sessions) {
    if (s.status !== "completed") continue;
    for (const ex of s.exercises) pairs.add(`${s.dayName}::${ex.exercise}`);
  }

  let best: HighlightExercise | null = null;
  for (const pair of pairs) {
    const [dayName, name] = pair.split("::");
    const pct = getPctImprovement(getExerciseProgression(scoped, program, name, 0, dayName));
    if (pct === null || pct <= 0 || (best && pct <= best.pct)) continue;

    const weeks = getWeeksWithData(logs, program, cycle, dayName, name);
    if (weeks.length < 2) continue;
    const progress = getExerciseProgressForWeek(
      logs,
      flatDays,
      cycle,
      dayName,
      name,
      weeks[weeks.length - 1],
      weeks[weeks.length - 2],
      false
    );
    if (!isProgressingOrImproving(progress)) continue;

    best = { exercise: name, pct };
  }
  return best;
}

export function getLastCompletedSession(logs: LogsData, cycle: number): WorkoutSession | null {
  const completed = filterByCycle(logs, cycle)
    .sessions.filter((s) => s.status === "completed")
    .sort((a, b) => b.programIndex - a.programIndex);
  return completed[0] ?? null;
}

/**
 * Cuántos sets de una sesión superaron el récord previo a esa sesión (por
 * ejercicio), ya sea de peso o de e1RM estimado (sin contar dos veces un
 * mismo set que logre ambos). Compara contra TODO el historial (todos los
 * ciclos): un PR es real sin importar si el programa se reinició.
 */
export function countPRsInSession(logs: LogsData, session: WorkoutSession): number {
  const sessionSeq = globalSeq(session);
  let count = 0;
  for (const ex of session.exercises) {
    const priorSets = logs.sessions
      .filter((s) => s.status === "completed" && globalSeq(s) < sessionSeq)
      .flatMap((s) => s.exercises.filter((e) => e.exercise === ex.exercise))
      .flatMap((e) => e.sets)
      .filter((s) => isSetLogged(s) && s.weightKg !== null && s.reps !== null && s.rir !== null);

    const priorBestWeight = priorSets.reduce((max, s) => Math.max(max, s.weightKg as number), -Infinity);
    const priorBestE1rm = priorSets.reduce(
      (max, s) => Math.max(max, estimatedE1RM(s.weightKg as number, s.reps as number, rirToNumber(s.rir!))),
      -Infinity
    );

    for (const set of ex.sets) {
      if (!isSetLogged(set) || set.weightKg === null || set.reps === null || set.rir === null) continue;
      const e1rm = estimatedE1RM(set.weightKg, set.reps, rirToNumber(set.rir));
      if (set.weightKg > priorBestWeight || e1rm > priorBestE1rm) count++;
    }
  }
  return count;
}

export function getWeeksUntilDeload(program: Program, currentWeekNumber: number): number | null {
  const deloadWeek = program.blocks
    .flatMap((b) => b.weeks)
    .find((w) => w.label.toLowerCase().includes("deload") && w.weekNumber >= currentWeekNumber);
  if (!deloadWeek) return null;
  return deloadWeek.weekNumber - currentWeekNumber;
}

/** Músculos primarios (sin duplicar) de los ejercicios prescriptos de un día, para los chips de la card de Inicio. Misma fuente que el resumen y la recuperación — ver `muscleMapping.ts`. */
export function getMuscleChips(flatDay: FlatProgramDay): string[] {
  const muscles = new Set<string>();
  for (const group of flatDay.day.exerciseGroups) {
    const mapping = getExerciseMuscles(group.exercise, null);
    if (mapping) muscles.add(mapping.primary);
  }
  return [...muscles];
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buen día";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}
