import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { getAllExerciseNames, getExerciseProgression } from "../lib/history";
import { isSetLogged } from "../types/logs";
import { formatDate } from "../lib/time";
import { ProgressChart } from "../components/ProgressChart";

function OverviewTab() {
  const { logs, program, flatDays } = useApp();

  const completed = logs.sessions.filter((s) => s.status === "completed");
  const skipped = logs.sessions.filter((s) => s.status === "skipped");
  const finished = completed.length + skipped.length;

  const daysPerWeek = program.blocks[0]?.weeks[0]?.days.length ?? 4;
  const nextDeload = program.blocks
    .flatMap((b) => b.weeks)
    .find(
      (w) => w.label.toLowerCase().includes("deload") && (w.weekNumber - 1) * daysPerWeek >= finished
    );

  const sessionsSorted = [...logs.sessions]
    .filter((s) => s.status !== "in_progress")
    .sort((a, b) => b.programIndex - a.programIndex);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">{finished}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">de {flatDays.length} días</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{completed.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">completados</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{skipped.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">salteados</p>
        </div>
      </div>

      {nextDeload && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Próxima semana de deload: <span className="font-medium">Semana {nextDeload.weekNumber}</span>
        </p>
      )}

      <div className="space-y-2">
        {sessionsSorted.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Todavía no registraste entrenamientos.</p>
        )}
        {sessionsSorted.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">
                {s.dayName} · Semana {s.weekNumber}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatDate(s.completedAt ?? s.startedAt)}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                s.status === "completed"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              }`}
            >
              {s.status === "completed" ? "completado" : "salteado"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExerciseTab() {
  const { program, logs } = useApp();
  const exercises = useMemo(() => getAllExerciseNames(program), [program]);
  const [selected, setSelected] = useState(exercises[0] ?? "");

  const progression = useMemo(
    () => getExerciseProgression(logs, selected, 0),
    [logs, selected]
  );

  const pastSessions = logs.sessions
    .filter((s) => s.status === "completed" && s.exercises.some((e) => e.exercise === selected))
    .sort((a, b) => b.programIndex - a.programIndex);

  return (
    <div className="space-y-4">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        {exercises.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          Progresión (serie principal)
        </p>
        <ProgressChart points={progression} />
      </div>

      <div className="space-y-2">
        {pastSessions.map((s) => {
          const ex = s.exercises.find((e) => e.exercise === selected)!;
          return (
            <div
              key={s.id}
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="font-medium text-slate-700 dark:text-slate-200">
                Semana {s.weekNumber} · {formatDate(s.completedAt ?? s.startedAt)}
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                {ex.sets
                  .filter(isSetLogged)
                  .map((set) => `${set.weightKg}kg×${set.reps} (RIR ${set.rir})`)
                  .join(" · ") || "sin registros"}
              </p>
            </div>
          );
        })}
        {pastSessions.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Todavía no hay sesiones registradas para este ejercicio.
          </p>
        )}
      </div>
    </div>
  );
}

export function HistoryScreen() {
  const [tab, setTab] = useState<"overview" | "exercise">("overview");

  return (
    <div className="space-y-4 pb-24">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("overview")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "overview"
              ? "bg-accent-600 text-white"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => setTab("exercise")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "exercise"
              ? "bg-accent-600 text-white"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          Por ejercicio
        </button>
      </div>

      {tab === "overview" ? <OverviewTab /> : <ExerciseTab />}
    </div>
  );
}
