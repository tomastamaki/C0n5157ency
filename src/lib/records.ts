import type { LogsData } from "../types/logs";
import { isSetLogged } from "../types/logs";

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
