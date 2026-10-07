import type { ExerciseNoteEntry, LogsData, WorkoutSession } from "../types/logs";
import { globalSeq } from "./cycle";

/** Todas las entradas de notas de un ejercicio (cualquier sesión/semana), de la más reciente a la más vieja. */
export function getNoteHistory(logs: LogsData, exerciseName: string): ExerciseNoteEntry[] {
  return logs.exerciseNoteEntries
    .filter((e) => e.exercise === exerciseName)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** La nota vigente de un ejercicio: la entrada más reciente, o null si nunca se cargó una. */
export function getCurrentNote(logs: LogsData, exerciseName: string): ExerciseNoteEntry | null {
  return getNoteHistory(logs, exerciseName)[0] ?? null;
}

/** La entrada de notas asociada puntualmente a una sesión (para mostrarla en su detalle). */
export function getNoteForSession(logs: LogsData, sessionId: string, exerciseName: string): ExerciseNoteEntry | null {
  return logs.exerciseNoteEntries.find((e) => e.sessionId === sessionId && e.exercise === exerciseName) ?? null;
}

/**
 * Migración de notas viejas (guardadas por sesión en `LoggedExercise.notes`)
 * al nuevo historial por ejercicio. Es un no-op una vez migrado: solo corre
 * si todavía no hay ninguna entrada en `exerciseNoteEntries`, así que es
 * seguro llamarla en cada carga sin duplicar nada ni pisar ediciones
 * posteriores hechas ya con el sistema nuevo.
 */
export function migrateLegacySessionNotes(logs: LogsData): LogsData {
  if (logs.exerciseNoteEntries.length > 0) return logs;

  const entries: ExerciseNoteEntry[] = [];
  const bySeq = [...logs.sessions].sort((a, b) => globalSeq(a) - globalSeq(b));

  for (const session of bySeq) {
    for (const ex of session.exercises) {
      if (!ex.notes || !ex.notes.trim()) continue;
      const when = session.completedAt ?? session.startedAt;
      entries.push({
        id: `${session.id}-${ex.exercise}`,
        exercise: ex.exercise,
        text: ex.notes,
        date: when,
        weekNumber: session.weekNumber,
        sessionId: session.id,
        createdAt: when,
        updatedAt: session.updatedAt,
      });
    }
  }

  if (entries.length === 0) return logs;
  return { ...logs, exerciseNoteEntries: entries };
}

/** Id estable para la nota de un ejercicio dentro de una sesión: guardar de nuevo en la misma sesión actualiza la misma entrada. */
export function noteEntryId(session: Pick<WorkoutSession, "id">, exerciseName: string): string {
  return `${session.id}-${exerciseName}`;
}
