import type { LogsData, LoggedSet, WorkoutSession } from "../types/logs";
import { isSetLogged, rirToNumber } from "../types/logs";
import type { FlatProgramDay } from "../types/program";
import { getLiteralWorkingSets } from "./program";
import { estimatedE1RM } from "./e1rm";
import { globalSeq } from "./cycle";
import { parseRepRange, repRangeDistance, isWithinRepTolerance } from "./repRange";
import { SUMMARY_CONFIG } from "./summaryConfig";

export type ReferenceTier = "same-day" | "other-day" | "approx";

export interface ExerciseReference {
  set: LoggedSet;
  sessionId: string;
  dayName: string;
  weekNumber: number;
  /** Prescripción histórica reconstruida para esa serie, o null si no se pudo determinar. */
  prescribedReps: string | null;
  tier: ReferenceTier;
  e1rm: number;
}

interface Candidate {
  set: LoggedSet;
  session: WorkoutSession;
  prescribedReps: string | null;
  e1rm: number;
}

/**
 * Reconstruye qué rango de reps estaba prescripto para una serie puntual del
 * historial: la posición del grupo de ejercicio dentro del día del programa
 * en el momento de esa sesión, sin importar si el ejercicio efectivamente
 * hecho fue un sustituto (la prescripción es siempre la del slot original).
 */
function getHistoricalPrescribedReps(
  flatDays: FlatProgramDay[],
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number
): string | null {
  const flatDay = flatDays[session.programIndex];
  const group = flatDay?.day.exerciseGroups[exerciseIndex];
  if (!group) return null;
  const literal = getLiteralWorkingSets(group);
  return literal[setIndex]?.reps ?? null;
}

function pickBestInGroup(candidates: Candidate[]): Candidate {
  let best = candidates[0];
  for (const c of candidates.slice(1)) {
    const cWeight = c.set.weightKg as number;
    const bestWeight = best.set.weightKg as number;
    if (cWeight > bestWeight || (cWeight === bestWeight && c.e1rm > best.e1rm)) best = c;
  }
  return best;
}

function toReference(candidate: Candidate, tier: ReferenceTier): ExerciseReference {
  return {
    set: candidate.set,
    sessionId: candidate.session.id,
    dayName: candidate.session.dayName,
    weekNumber: candidate.session.weekNumber,
    prescribedReps: candidate.prescribedReps,
    tier,
    e1rm: candidate.e1rm,
  };
}

/**
 * Encuentra, en orden de recencia, hasta `limit` referencias históricas para
 * una serie de la sesión actual — usando el rango de reps prescripto (no la
 * posición ni el día) como clave, para no mezclar prescripciones distintas
 * de un mismo nombre de ejercicio en rutinas diferentes (ej. "DB Bench
 * Press" sustituto de Upper con 4-6 reps vs. prescripto en Push con 10/20).
 *
 * Prioridad: 1) misma rutina (mismo `dayName`) con la misma prescripción
 * exacta, 2) otra rutina con la misma prescripción exacta, 3) el rango más
 * cercano dentro de la tolerancia configurada (referencia aproximada).
 * Dentro de cada sesión candidata, si hay más de una serie que matchea, se
 * toma la mejor (mayor peso y, si empatan, mayor e1RM).
 */
export function findExerciseReferences(
  logs: LogsData,
  flatDays: FlatProgramDay[],
  exerciseName: string,
  currentDayName: string,
  targetReps: string,
  beforeGlobalSeq: number,
  limit: number,
  tolerance: number = SUMMARY_CONFIG.repRangeTolerance
): ExerciseReference[] {
  const targetRange = parseRepRange(targetReps);

  const sessions = logs.sessions
    .filter((s) => s.status === "completed" && globalSeq(s) < beforeGlobalSeq)
    .sort((a, b) => globalSeq(b) - globalSeq(a));

  const sameDayGroups: Candidate[][] = [];
  const sameRepsGroups: Candidate[][] = [];
  // Para la referencia aproximada ordenamos por distancia de rango primero, recencia después.
  const approxFlat: Candidate[] = [];

  for (const session of sessions) {
    const sameDayCands: Candidate[] = [];
    const sameRepsCands: Candidate[] = [];

    session.exercises.forEach((ex, exIndex) => {
      if (ex.exercise !== exerciseName) return;
      ex.sets.forEach((set) => {
        if (!isSetLogged(set) || set.weightKg === null || set.reps === null || set.rir === null) return;
        const prescribedReps = getHistoricalPrescribedReps(flatDays, session, exIndex, set.setIndex);
        const e1rm = estimatedE1RM(set.weightKg, set.reps, rirToNumber(set.rir));
        const candidate: Candidate = { set, session, prescribedReps, e1rm };

        if (prescribedReps === targetReps) {
          sameRepsCands.push(candidate);
          if (session.dayName === currentDayName) sameDayCands.push(candidate);
        } else if (isWithinRepTolerance(set.reps, targetRange, tolerance)) {
          approxFlat.push(candidate);
        }
      });
    });

    if (sameDayCands.length > 0) sameDayGroups.push(sameDayCands);
    if (sameRepsCands.length > 0) sameRepsGroups.push(sameRepsCands);
  }

  function fromGroups(groups: Candidate[][], tier: ReferenceTier): ExerciseReference[] {
    return groups.slice(0, limit).map((g) => toReference(pickBestInGroup(g), tier));
  }

  const sameDay = fromGroups(sameDayGroups, "same-day");
  if (sameDay.length > 0) return sameDay;

  const sameReps = fromGroups(sameRepsGroups, "other-day");
  if (sameReps.length > 0) return sameReps;

  if (approxFlat.length === 0) return [];
  const bySession = new Map<string, Candidate[]>();
  for (const c of approxFlat) {
    if (!bySession.has(c.session.id)) bySession.set(c.session.id, []);
    bySession.get(c.session.id)!.push(c);
  }
  const approxGroups = [...bySession.values()].sort((a, b) => {
    const da = Math.min(...a.map((c) => repRangeDistance(c.set.reps as number, targetRange)));
    const db = Math.min(...b.map((c) => repRangeDistance(c.set.reps as number, targetRange)));
    if (da !== db) return da - db;
    return globalSeq(b[0].session) - globalSeq(a[0].session);
  });
  return fromGroups(approxGroups, "approx");
}

export function findExerciseReference(
  logs: LogsData,
  flatDays: FlatProgramDay[],
  exerciseName: string,
  currentDayName: string,
  targetReps: string,
  beforeGlobalSeq: number,
  tolerance: number = SUMMARY_CONFIG.repRangeTolerance
): ExerciseReference | null {
  return (
    findExerciseReferences(logs, flatDays, exerciseName, currentDayName, targetReps, beforeGlobalSeq, 1, tolerance)[0] ??
    null
  );
}
