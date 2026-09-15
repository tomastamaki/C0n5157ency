import { useState } from "react";
import { useApp } from "../context/AppContext";
import { getCurrentFlatDay, getNextProgramIndex } from "../lib/schedule";
import { getLiteralWorkingSets } from "../lib/program";
import { newId } from "../lib/id";
import { ExerciseCard } from "../components/ExerciseCard";
import { SyncIndicator } from "../components/SyncIndicator";
import { isSetLogged, type WorkoutSession } from "../types/logs";
import type { FlatProgramDay } from "../types/program";

function StartCard({
  flatDay,
  onStart,
  onSkip,
}: {
  flatDay: FlatProgramDay;
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {flatDay.blockName} · Semana {flatDay.weekNumber} de {flatDay.totalWeeks} · {flatDay.weekLabel}
      </p>
      <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">{flatDay.day.name}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {flatDay.day.exerciseGroups.length} ejercicios
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-6 w-full rounded-xl bg-accent-600 py-3 text-base font-semibold text-white active:scale-[0.98]"
      >
        Empezar entrenamiento de hoy
      </button>
      <button
        type="button"
        onClick={onSkip}
        className="mt-3 text-sm text-slate-400 underline"
      >
        Saltear este día
      </button>
    </div>
  );
}

function ProgramCompleteView() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">¡Programa completo!</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Completaste las 12 semanas de Min-Max Phase 2. Revisá tu progreso en Historial.
      </p>
    </div>
  );
}

export function TodayScreen() {
  const { flatDays, logs, upsertSession } = useApp();
  const [showSummary, setShowSummary] = useState(false);
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);

  const nextIndex = getNextProgramIndex(logs);
  const flatDay = getCurrentFlatDay(flatDays, logs);
  const draft = flatDay
    ? logs.sessions.find((s) => s.programIndex === nextIndex && s.status === "in_progress") ?? null
    : null;

  function startWorkout(day: FlatProgramDay) {
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
      updatedAt: now,
      exercises: day.day.exerciseGroups.map((g) => ({
        exercise: g.exercise,
        supersetGroup: g.supersetGroup,
        sets: getLiteralWorkingSets(g).map((_, i) => ({
          setIndex: i,
          weightKg: null,
          reps: null,
          rir: null,
        })),
      })),
    };
    upsertSession(session);
    setActiveGroupIdx(0);
  }

  function skipDay(day: FlatProgramDay) {
    if (!window.confirm(`¿Marcar "${day.day.name}" (semana ${day.weekNumber}) como salteado?`)) return;
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
      updatedAt: now,
      exercises: [],
    });
  }

  function updateDraft(updater: (session: WorkoutSession) => WorkoutSession) {
    if (!draft) return;
    upsertSession(updater(draft));
  }

  if (!flatDay) return <ProgramCompleteView />;

  if (!draft) {
    return (
      <div className="space-y-4">
        <StartCard flatDay={flatDay} onStart={() => startWorkout(flatDay)} onSkip={() => skipDay(flatDay)} />
      </div>
    );
  }

  const allDone = draft.exercises.every((ex) => ex.sets.every(isSetLogged));

  if (showSummary || draft.status === "completed") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-900/20">
          <h2 className="text-xl font-bold text-emerald-800 dark:text-emerald-200">
            ¡Entrenamiento completado!
          </h2>
          <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
            {draft.dayName} · Semana {draft.weekNumber}
          </p>
        </div>
        <div className="space-y-2">
          {draft.exercises.map((ex, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="font-medium text-slate-800 dark:text-slate-100">{ex.exercise}</p>
              <p className="text-slate-500 dark:text-slate-400">
                {ex.sets
                  .filter(isSetLogged)
                  .map((s) => `${s.weightKg}kg×${s.reps} (RIR ${s.rir})`)
                  .join(" · ") || "sin registros"}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {draft.blockName} · Semana {draft.weekNumber} de {flatDay.totalWeeks} · {draft.weekLabel}
          </p>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{draft.dayName}</h2>
        </div>
        <SyncIndicator />
      </div>

      <div className="space-y-3">
        {flatDay.day.exerciseGroups.map((group, i) => (
          <ExerciseCard
            key={i}
            group={group}
            groupIndexInDay={i}
            programIndex={flatDay.index}
            active={i === activeGroupIdx}
            onActivate={() => setActiveGroupIdx(i)}
            session={draft}
            onUpdateSession={updateDraft}
          />
        ))}
      </div>

      {allDone && (
        <button
          type="button"
          onClick={() => {
            updateDraft((prev) => ({
              ...prev,
              status: "completed",
              completedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }));
            setShowSummary(true);
          }}
          className="w-full rounded-xl bg-accent-600 py-3 text-base font-semibold text-white active:scale-[0.98]"
        >
          Terminar entrenamiento
        </button>
      )}
    </div>
  );
}
