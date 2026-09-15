export type RIRValue = "0" | "1" | "2" | "3+";

export interface LoggedSet {
  /** Índice dentro de los "working sets" de ese ejercicio, en el orden del programa. */
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  rir: RIRValue | null;
}

export interface LoggedExercise {
  exercise: string;
  supersetGroup: string | null;
  sets: LoggedSet[];
}

export interface WorkoutSession {
  id: string;
  /** Posición (0-based) en la secuencia aplanada de los 48 días del programa. */
  programIndex: number;
  blockName: string;
  weekLabel: string;
  weekNumber: number;
  dayName: string;
  status: "in_progress" | "completed" | "skipped";
  startedAt: string;
  completedAt: string | null;
  /** Se actualiza en cada cambio; se usa para resolver conflictos al sincronizar. */
  updatedAt: string;
  exercises: LoggedExercise[];
}

export interface LogsData {
  version: 1;
  sessions: WorkoutSession[];
}

export const EMPTY_LOGS: LogsData = { version: 1, sessions: [] };

export function isSetLogged(set: LoggedSet): boolean {
  return set.weightKg !== null && set.reps !== null && set.rir !== null;
}
