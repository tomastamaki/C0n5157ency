import type { LogsData, WorkoutSession } from "../types/logs";
import { isSetLogged } from "../types/logs";
import type { Program } from "../types/program";
import { getExerciseProgression, getPctImprovement } from "./history";

/** Racha de días consecutivos completados, mirando hacia atrás desde el más reciente. Se corta en el primer salteado. */
export function getCurrentStreak(logs: LogsData): number {
  const sessions = [...logs.sessions]
    .filter((s) => s.status !== "in_progress")
    .sort((a, b) => b.programIndex - a.programIndex);
  let streak = 0;
  for (const s of sessions) {
    if (s.status === "completed") streak++;
    else break;
  }
  return streak;
}

/** Cantidad de veces que se superó un récord personal (por ejercicio) durante el mes calendario actual. */
export function getPRsThisMonth(logs: LogsData): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const sessions = [...logs.sessions]
    .filter((s) => s.status === "completed")
    .sort((a, b) => a.programIndex - b.programIndex);

  const bestByExercise = new Map<string, number>();
  let count = 0;

  for (const session of sessions) {
    const date = new Date(session.completedAt ?? session.startedAt);
    const inMonth = date.getFullYear() === year && date.getMonth() === month;
    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        if (!isSetLogged(set) || set.weightKg === null) continue;
        const prev = bestByExercise.get(ex.exercise) ?? -Infinity;
        if (set.weightKg > prev) {
          bestByExercise.set(ex.exercise, set.weightKg);
          if (inMonth) count++;
        }
      }
    }
  }
  return count;
}

export interface AttentionFlag {
  exercise: string;
  kind: "regression" | "stalled" | "harder_rir";
  detail: string;
}

/**
 * Señales calculadas puramente sobre lo ya registrado (sin re-derivar el plan
 * del programa, que cambia semana a semana): bajó de peso respecto a la vez
 * anterior, se repitió el mismo peso 3 veces seguidas, o llegó a RIR 0 cuando
 * antes le sobraban reps.
 */
export function getAttentionFlags(logs: LogsData, limit = 3): AttentionFlag[] {
  const byExercise = new Map<string, { weightKg: number; rir: string }[]>();
  const completed = [...logs.sessions]
    .filter((s) => s.status === "completed")
    .sort((a, b) => a.programIndex - b.programIndex);

  for (const session of completed) {
    for (const ex of session.exercises) {
      const set = ex.sets.find((s) => s.setIndex === 0);
      if (!set || !isSetLogged(set) || set.weightKg === null || set.rir === null) continue;
      if (!byExercise.has(ex.exercise)) byExercise.set(ex.exercise, []);
      byExercise.get(ex.exercise)!.push({ weightKg: set.weightKg, rir: set.rir });
    }
  }

  const flags: AttentionFlag[] = [];

  for (const [exercise, points] of byExercise) {
    if (points.length < 2) continue;
    const last = points[points.length - 1];
    const prev = points[points.length - 2];

    if (last.weightKg < prev.weightKg) {
      flags.push({ exercise, kind: "regression", detail: `bajó de ${prev.weightKg}kg a ${last.weightKg}kg` });
      continue;
    }

    if (points.length >= 3) {
      const last3 = points.slice(-3);
      if (last3.every((p) => p.weightKg === last3[0].weightKg)) {
        flags.push({
          exercise,
          kind: "stalled",
          detail: `mismo peso (${last.weightKg}kg) en las últimas 3 sesiones`,
        });
        continue;
      }
    }

    if (last.rir === "0" && (prev.rir === "2" || prev.rir === "3+")) {
      flags.push({ exercise, kind: "harder_rir", detail: `RIR 0 esta vez vs. RIR ${prev.rir} la anterior` });
    }
  }

  return flags.slice(0, limit);
}

export interface HighlightExercise {
  exercise: string;
  pct: number;
}

/** El ejercicio con mayor % de mejora histórico (primer registro vs. más reciente). */
export function getHighlightExercise(logs: LogsData): HighlightExercise | null {
  const names = new Set<string>();
  for (const s of logs.sessions) {
    if (s.status !== "completed") continue;
    for (const ex of s.exercises) names.add(ex.exercise);
  }

  let best: HighlightExercise | null = null;
  for (const name of names) {
    const pct = getPctImprovement(getExerciseProgression(logs, name, 0));
    if (pct !== null && pct > 0 && (!best || pct > best.pct)) {
      best = { exercise: name, pct };
    }
  }
  return best;
}

export function getLastCompletedSession(logs: LogsData): WorkoutSession | null {
  const completed = [...logs.sessions]
    .filter((s) => s.status === "completed")
    .sort((a, b) => b.programIndex - a.programIndex);
  return completed[0] ?? null;
}

/** Cuántos sets de una sesión superaron el récord previo a esa sesión (por ejercicio). */
export function countPRsInSession(logs: LogsData, session: WorkoutSession): number {
  let count = 0;
  for (const ex of session.exercises) {
    const priorBest = logs.sessions
      .filter((s) => s.status === "completed" && s.programIndex < session.programIndex)
      .flatMap((s) => s.exercises.filter((e) => e.exercise === ex.exercise))
      .flatMap((e) => e.sets)
      .filter((s) => isSetLogged(s) && s.weightKg !== null)
      .reduce((max, s) => Math.max(max, s.weightKg as number), -Infinity);

    for (const set of ex.sets) {
      if (isSetLogged(set) && set.weightKg !== null && set.weightKg > priorBest) count++;
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

const MUSCLE_CHIPS: Record<string, string[]> = {
  Upper: ["Pecho", "Espalda", "Hombros", "Brazos"],
  Lower: ["Cuádriceps", "Isquios", "Glúteos", "Pantorrillas"],
  Push: ["Pecho", "Hombros", "Tríceps"],
  Pull: ["Espalda", "Bíceps"],
};

export function getMuscleChips(dayName: string): string[] {
  return MUSCLE_CHIPS[dayName] ?? [];
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buen día";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}
