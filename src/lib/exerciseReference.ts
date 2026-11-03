import type { LogsData, LoggedSet, WorkoutSession } from "../types/logs";
import { isSetLogged } from "../types/logs";
import type { FlatProgramDay } from "../types/program";
import { getLiteralWorkingSets } from "./program";
import { globalSeq } from "./cycle";
import { parseRepRange, repRangeDistance } from "./repRange";
import { SUMMARY_CONFIG } from "./summaryConfig";

export type ReferenceTier = "same-day" | "other-day" | "approx" | "none";

export interface SetReference {
  set: LoggedSet | null;
  sessionId: string | null;
  dayName: string | null;
  weekNumber: number | null;
  /** Prescripción histórica reconstruida para el set devuelto, o null si no se pudo determinar o no hay referencia. */
  prescribedReps: string | null;
  tier: ReferenceTier;
}

const NONE: SetReference = { set: null, sessionId: null, dayName: null, weekNumber: null, prescribedReps: null, tier: "none" };

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

interface LoggedWithPrescription {
  set: LoggedSet;
  prescribedReps: string | null;
}

/** Sets logueados de un ejercicio en una sesión, con su prescripción histórica reconstruida, en orden de setIndex. */
function loggedSetsWithPrescription(
  flatDays: FlatProgramDay[],
  session: WorkoutSession,
  exerciseIndex: number,
  exerciseName: string
): LoggedWithPrescription[] {
  const ex = session.exercises[exerciseIndex];
  if (!ex || ex.exercise !== exerciseName) return [];
  return ex.sets
    .filter((s) => isSetLogged(s) && s.weightKg !== null && s.reps !== null && s.rir !== null)
    .sort((a, b) => a.setIndex - b.setIndex)
    .map((set) => ({ set, prescribedReps: getHistoricalPrescribedReps(flatDays, session, exerciseIndex, set.setIndex) }));
}

/** Busca, hacia atrás desde `beforeGlobalSeq`, la sesión más reciente (y el índice del ejercicio en ella) con al menos un set logueado de este ejercicio, opcionalmente filtrando por tipo de día. */
function findSessionWithExercise(
  sessionsDesc: WorkoutSession[],
  exerciseName: string,
  dayFilter: string | null,
  skipIds: Set<string>
): { session: WorkoutSession; exerciseIndex: number } | null {
  for (const session of sessionsDesc) {
    if (skipIds.has(session.id)) continue;
    if (dayFilter !== null && session.dayName !== dayFilter) continue;
    const exerciseIndex = session.exercises.findIndex((e) => e.exercise === exerciseName);
    if (exerciseIndex === -1) continue;
    if (session.exercises[exerciseIndex].sets.some(isSetLogged)) return { session, exerciseIndex };
  }
  return null;
}

/**
 * Para cada serie actual (identificada por su rango de reps prescripto, en
 * orden), empareja con SU serie equivalente de una única sesión de
 * referencia — la más reciente con este ejercicio (misma variante
 * efectivamente hecha) en el mismo tipo de día; si no hay, la más reciente
 * en otro tipo de día (con tier "other-day"). Nunca mezcla datos de dos
 * sesiones distintas para el mismo ejercicio.
 *
 * Emparejamiento dentro de la sesión elegida: por posición dentro del mismo
 * grupo de prescripción (la 1ª serie de "4-6" con la 1ª de "4-6" de esa
 * sesión, la 2ª con la 2ª). Si hay más series ahora que en la referencia,
 * las serie extra reusan la última del grupo. Si un grupo de prescripción
 * actual no existe en la sesión de referencia, cae a la serie de rango más
 * cercano todavía no asignada a otra serie actual (tier "approx"). Un mismo
 * set de la sesión de referencia nunca se asigna a dos series actuales
 * distintas (salvo el caso de "series extra" explícitamente permitido).
 *
 * `limit` sesiones de referencia (de más a menos reciente, todas del mismo
 * tipo de día que la primera encontrada) para poder comparar "última" contra
 * "anterior a la última" (ej. sugerencia de peso).
 */
export function matchExerciseReferences(
  logs: LogsData,
  flatDays: FlatProgramDay[],
  exerciseName: string,
  currentDayName: string,
  currentLiteralReps: string[],
  beforeGlobalSeq: number,
  limit = 1,
  tolerance: number = SUMMARY_CONFIG.repRangeTolerance
): SetReference[][] {
  const sessionsDesc = logs.sessions
    .filter((s) => s.status === "completed" && globalSeq(s) < beforeGlobalSeq)
    .sort((a, b) => globalSeq(b) - globalSeq(a));

  const firstSameDay = findSessionWithExercise(sessionsDesc, exerciseName, currentDayName, new Set());
  const dayFilter = firstSameDay ? currentDayName : null;
  const tier: ReferenceTier = firstSameDay ? "same-day" : "other-day";

  const results: SetReference[][] = [];
  const skipIds = new Set<string>();
  let next = firstSameDay ?? findSessionWithExercise(sessionsDesc, exerciseName, dayFilter, skipIds);

  while (results.length < limit && next) {
    results.push(matchWithinSession(flatDays, next.session, next.exerciseIndex, exerciseName, currentLiteralReps, tier, tolerance));
    skipIds.add(next.session.id);
    next = findSessionWithExercise(sessionsDesc, exerciseName, dayFilter, skipIds);
  }

  while (results.length < limit) results.push(currentLiteralReps.map(() => NONE));
  return results;
}

function matchWithinSession(
  flatDays: FlatProgramDay[],
  session: WorkoutSession,
  exerciseIndex: number,
  exerciseName: string,
  currentLiteralReps: string[],
  tier: ReferenceTier,
  tolerance: number
): SetReference[] {
  const logged = loggedSetsWithPrescription(flatDays, session, exerciseIndex, exerciseName);

  const groups = new Map<string, LoggedWithPrescription[]>();
  const ungrouped: LoggedWithPrescription[] = [];
  for (const item of logged) {
    if (item.prescribedReps === null) {
      ungrouped.push(item);
      continue;
    }
    if (!groups.has(item.prescribedReps)) groups.set(item.prescribedReps, []);
    groups.get(item.prescribedReps)!.push(item);
  }

  const consumeIndex = new Map<string, number>();
  const used = new Set<LoggedSet>();

  function toRef(item: LoggedWithPrescription, refTier: ReferenceTier): SetReference {
    used.add(item.set);
    return {
      set: item.set,
      sessionId: session.id,
      dayName: session.dayName,
      weekNumber: session.weekNumber,
      prescribedReps: item.prescribedReps,
      tier: refTier,
    };
  }

  return currentLiteralReps.map((targetReps) => {
    const group = groups.get(targetReps);
    if (group && group.length > 0) {
      const idx = Math.min(consumeIndex.get(targetReps) ?? 0, group.length - 1);
      consumeIndex.set(targetReps, (consumeIndex.get(targetReps) ?? 0) + 1);
      return toRef(group[idx], tier);
    }

    // Rango no presente en la sesión de referencia: el más cercano entre los sets todavía no usados,
    // dentro de la tolerancia configurada (si ninguno califica, "sin datos" en vez de un aproximado engañoso).
    const targetRange = parseRepRange(targetReps);
    const candidates = logged
      .filter((item) => !used.has(item.set))
      .filter((item) => repRangeDistance(item.set.reps as number, targetRange) <= tolerance);
    if (candidates.length === 0) return NONE;
    candidates.sort(
      (a, b) => repRangeDistance(a.set.reps as number, targetRange) - repRangeDistance(b.set.reps as number, targetRange)
    );
    return toRef(candidates[0], "approx");
  });
}
