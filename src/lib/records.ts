import type { LogsData, LoggedSet } from "../types/logs";
import { isSetLogged, rirToNumber } from "../types/logs";
import type { Program } from "../types/program";
import { estimatedE1RM } from "./e1rm";
import { globalSeq } from "./cycle";
import { buildExerciseDayMap, DAY_ORDER } from "./history";

export interface PersonalRecord {
  weightKg: number;
  reps: number;
  date: string;
}

/**
 * Peso máximo histórico registrado para un ejercicio (por nombre real logueado,
 * así que un sustituto lleva su propio récord independiente del original).
 * Solo cuenta series de sesiones completadas y confirmadas.
 */
export function getPersonalRecord(logs: LogsData, exerciseName: string): PersonalRecord | null {
  let best: PersonalRecord | null = null;

  for (const session of logs.sessions) {
    if (session.status !== "completed") continue;
    for (const ex of session.exercises) {
      if (ex.exercise !== exerciseName) continue;
      for (const set of ex.sets) {
        if (!isSetLogged(set) || set.weightKg === null) continue;
        if (!best || set.weightKg > best.weightKg) {
          best = {
            weightKg: set.weightKg,
            reps: set.reps ?? 0,
            date: session.completedAt ?? session.startedAt,
          };
        }
      }
    }
  }

  return best;
}

export interface E1rmRecord {
  e1rm: number;
  weightKg: number;
  reps: number;
  rir: string;
  date: string;
}

/** 1RM estimado máximo histórico para un ejercicio: puede ser un PR aunque el peso no haya subido (más reps o más RIR al mismo peso). */
export function getE1rmRecord(logs: LogsData, exerciseName: string): E1rmRecord | null {
  let best: E1rmRecord | null = null;

  for (const session of logs.sessions) {
    if (session.status !== "completed") continue;
    for (const ex of session.exercises) {
      if (ex.exercise !== exerciseName) continue;
      for (const set of ex.sets) {
        if (!isSetLogged(set) || set.weightKg === null || set.reps === null || set.rir === null) continue;
        const e1rm = estimatedE1RM(set.weightKg, set.reps, rirToNumber(set.rir));
        if (!best || e1rm > best.e1rm) {
          best = {
            e1rm,
            weightKg: set.weightKg,
            reps: set.reps,
            rir: set.rir,
            date: session.completedAt ?? session.startedAt,
          };
        }
      }
    }
  }

  return best;
}

export type PREventKind = "weight" | "e1rm";

export interface PREvent {
  exercise: string;
  cycle: number;
  dayName: string;
  weekNumber: number;
  sessionId: string;
  date: string;
  kind: PREventKind;
  weightKg: number;
  reps: number;
  rir: string;
  e1rm: number;
  /** Mejor marca previa del mismo tipo (peso o e1RM), null si es el primer registro de ese ejercicio. */
  previousBest: number | null;
}

/**
 * Recorre todo el historial en orden cronológico y arma la línea de tiempo
 * completa de récords personales, de dos tipos independientes por ejercicio:
 * - "weight": nuevo peso máximo levantado.
 * - "e1rm": nuevo 1RM estimado máximo (puede pasar sin PR de peso: más reps
 *   o más RIR —menos esfuerzo— al mismo peso que antes).
 * Sirve de base única para "PRs de la semana" y "PR actual de cada ejercicio".
 */
export function getPersonalRecordEvents(logs: LogsData): PREvent[] {
  const sessions = [...logs.sessions]
    .filter((s) => s.status === "completed")
    .sort((a, b) => globalSeq(a) - globalSeq(b));

  const bestWeight = new Map<string, number>();
  const bestE1rm = new Map<string, number>();
  const events: PREvent[] = [];

  for (const session of sessions) {
    for (const ex of session.exercises) {
      let bestWeightSet: LoggedSet | null = null;
      let bestE1rmSet: LoggedSet | null = null;
      let bestE1rmVal = -Infinity;

      for (const set of ex.sets) {
        if (!isSetLogged(set) || set.weightKg === null || set.reps === null || set.rir === null) continue;
        if (!bestWeightSet || set.weightKg > (bestWeightSet.weightKg as number)) bestWeightSet = set;
        const e1rm = estimatedE1RM(set.weightKg, set.reps, rirToNumber(set.rir));
        if (e1rm > bestE1rmVal) {
          bestE1rmVal = e1rm;
          bestE1rmSet = set;
        }
      }

      const base = {
        exercise: ex.exercise,
        cycle: session.cycle ?? 0,
        dayName: session.dayName,
        weekNumber: session.weekNumber,
        sessionId: session.id,
        date: session.completedAt ?? session.startedAt,
      };

      const priorWeight = bestWeight.get(ex.exercise) ?? null;
      if (bestWeightSet && bestWeightSet.weightKg !== null && (priorWeight === null || bestWeightSet.weightKg > priorWeight)) {
        events.push({
          ...base,
          kind: "weight",
          weightKg: bestWeightSet.weightKg,
          reps: bestWeightSet.reps ?? 0,
          rir: bestWeightSet.rir ?? "-",
          e1rm: estimatedE1RM(bestWeightSet.weightKg, bestWeightSet.reps ?? 0, rirToNumber(bestWeightSet.rir ?? "0")),
          previousBest: priorWeight,
        });
        bestWeight.set(ex.exercise, bestWeightSet.weightKg);
      }

      const priorE1rm = bestE1rm.get(ex.exercise) ?? null;
      if (bestE1rmSet && (priorE1rm === null || bestE1rmVal > priorE1rm)) {
        events.push({
          ...base,
          kind: "e1rm",
          weightKg: bestE1rmSet.weightKg as number,
          reps: bestE1rmSet.reps ?? 0,
          rir: bestE1rmSet.rir ?? "-",
          e1rm: bestE1rmVal,
          previousBest: priorE1rm,
        });
        bestE1rm.set(ex.exercise, bestE1rmVal);
      }
    }
  }

  return events;
}

export interface GroupedExerciseRecord {
  exercise: string;
  weightKg: number;
  reps: number;
  rir: string;
  date: string;
  isThisWeek: boolean;
  previousWeightKg: number | null;
}

/**
 * PR de peso actual de cada ejercicio con al menos un registro, agrupado por
 * tipo de día (igual criterio que la lista del historial). Los logrados en
 * la semana/ciclo actual quedan marcados para destacarlos con el peso
 * anterior que superaron.
 */
export function getAllCurrentRecordsByDay(
  logs: LogsData,
  program: Program,
  currentWeekNumber: number,
  cycle: number
): { day: string; records: GroupedExerciseRecord[] }[] {
  const currentByExercise = new Map<string, PREvent>();
  for (const e of getPersonalRecordEvents(logs)) {
    if (e.kind === "weight") currentByExercise.set(e.exercise, e);
  }

  const dayOf = buildExerciseDayMap(program, logs.sessions);
  const byDay = new Map<string, GroupedExerciseRecord[]>();

  for (const [exercise, e] of currentByExercise) {
    const day = dayOf.get(exercise) ?? e.dayName;
    const isThisWeek = e.weekNumber === currentWeekNumber && e.cycle === cycle;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push({
      exercise,
      weightKg: e.weightKg,
      reps: e.reps,
      rir: e.rir,
      date: e.date,
      isThisWeek,
      previousWeightKg: isThisWeek ? e.previousBest : null,
    });
  }

  for (const list of byDay.values()) {
    list.sort((a, b) => {
      if (a.isThisWeek !== b.isThisWeek) return a.isThisWeek ? -1 : 1;
      return a.exercise.localeCompare(b.exercise, "es");
    });
  }

  return DAY_ORDER.filter((d) => byDay.has(d)).map((day) => ({ day, records: byDay.get(day)! }));
}
