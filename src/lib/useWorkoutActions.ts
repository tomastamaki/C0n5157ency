import { useApp } from "../context/AppContext";
import { getLiteralWorkingSets } from "./program";
import { getPreferredExercise } from "./history";
import { newId } from "./id";
import type { WorkoutSession } from "../types/logs";
import type { FlatProgramDay } from "../types/program";

/** Segundos acumulados de una sesión hasta este momento (corriendo o en pausa). */
export function currentElapsedSec(session: WorkoutSession): number {
  if (!session.runningSince) return session.pausedElapsedSec;
  const extra = (Date.now() - new Date(session.runningSince).getTime()) / 1000;
  return session.pausedElapsedSec + extra;
}

/**
 * Todas las mutaciones sobre una sesión de entrenamiento, centralizadas para
 * que tanto el dashboard (empezar/saltear) como la pantalla de entrenamiento
 * activo (actualizar series/pausar/reanudar/terminar) compartan la misma
 * lógica sin depender de en qué pestaña esté montado cada uno.
 */
export function useWorkoutActions() {
  const { logs, upsertSession } = useApp();

  function startWorkout(day: FlatProgramDay): WorkoutSession {
    const now = new Date().toISOString();
    const session: WorkoutSession = {
      id: newId(),
      programIndex: day.index,
      blockName: day.blockName,
      weekLabel: day.weekLabel,
      weekNumber: day.weekNumber,
      dayName: day.day.name,
      status: "in_progress",
      startedAt: now,
      completedAt: null,
      durationSec: null,
      runningSince: now,
      pausedElapsedSec: 0,
      updatedAt: now,
      exercises: day.day.exerciseGroups.map((g) => {
        const preferred = getPreferredExercise(logs, g.exercise, day.index);
        const chosen = preferred ?? g.exercise;
        return {
          exercise: chosen,
          originalExercise: chosen === g.exercise ? null : g.exercise,
          supersetGroup: g.supersetGroup,
          sets: getLiteralWorkingSets(g).map((_, i) => ({
            setIndex: i,
            weightKg: null,
            reps: null,
            rir: null,
            confirmed: false,
          })),
        };
      }),
    };
    upsertSession(session);
    return session;
  }

  function skipDay(day: FlatProgramDay) {
    const now = new Date().toISOString();
    upsertSession({
      id: newId(),
      programIndex: day.index,
      blockName: day.blockName,
      weekLabel: day.weekLabel,
      weekNumber: day.weekNumber,
      dayName: day.day.name,
      status: "skipped",
      startedAt: now,
      completedAt: now,
      durationSec: null,
      runningSince: null,
      pausedElapsedSec: 0,
      updatedAt: now,
      exercises: [],
    });
  }

  function updateDraft(draft: WorkoutSession, updater: (session: WorkoutSession) => WorkoutSession) {
    upsertSession(updater(draft));
  }

  function pauseWorkout(draft: WorkoutSession) {
    if (!draft.runningSince) return;
    const now = new Date().toISOString();
    upsertSession({
      ...draft,
      pausedElapsedSec: currentElapsedSec(draft),
      runningSince: null,
      updatedAt: now,
    });
  }

  function resumeWorkout(draft: WorkoutSession) {
    const now = new Date().toISOString();
    upsertSession({ ...draft, runningSince: now, updatedAt: now });
  }

  function finishWorkout(draft: WorkoutSession): WorkoutSession {
    const now = new Date().toISOString();
    const durationSec = Math.max(0, Math.round(currentElapsedSec(draft)));
    const finished: WorkoutSession = {
      ...draft,
      status: "completed",
      completedAt: now,
      durationSec,
      runningSince: null,
      pausedElapsedSec: durationSec,
      updatedAt: now,
    };
    upsertSession(finished);
    return finished;
  }

  return { startWorkout, skipDay, updateDraft, pauseWorkout, resumeWorkout, finishWorkout };
}
