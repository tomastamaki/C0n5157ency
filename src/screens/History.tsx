import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { getAllExerciseNames, getExerciseProgression } from "../lib/history";
import { getCurrentFlatDay } from "../lib/schedule";
import { getLiteralWorkingSets } from "../lib/program";
import { isSetLogged } from "../types/logs";
import { formatDate, formatDuration } from "../lib/time";
import { ProgressChart } from "../components/ProgressChart";
import { TrainingCalendar } from "../components/TrainingCalendar";

function OverviewTab({ onSelectSession }: { onSelectSession: (id: string) => void }) {
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
          <button
            key={s.id}
            type="button"
            onClick={() => onSelectSession(s.id)}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">
                {s.dayName} · Semana {s.weekNumber}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatDate(s.completedAt ?? s.startedAt)}
                {s.durationSec !== null && ` · ${formatDuration(s.durationSec)}`}
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
          </button>
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

function CalendarTab({ onSelectSession }: { onSelectSession: (id: string) => void }) {
  const { logs } = useApp();
  const sessions = logs.sessions.filter((s) => s.status !== "in_progress");
  return <TrainingCalendar sessions={sessions} onSelectSession={onSelectSession} />;
}

function SessionDetailView({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const { logs } = useApp();
  const session = logs.sessions.find((s) => s.id === sessionId);

  if (!session) {
    return (
      <div className="space-y-4 pb-24">
        <button type="button" onClick={onBack} className="text-sm font-medium text-accent-600 dark:text-accent-400">
          ← Volver
        </button>
        <p className="text-sm text-slate-500 dark:text-slate-400">No se encontró esta sesión.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <button type="button" onClick={onBack} className="text-sm font-medium text-accent-600 dark:text-accent-400">
        ← Volver
      </button>

      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
          {session.dayName} · Semana {session.weekNumber}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {formatDate(session.completedAt ?? session.startedAt)} ·{" "}
          {session.status === "completed" ? "Completado" : session.status === "skipped" ? "Salteado" : "En curso"}
          {session.durationSec !== null && ` · ${formatDuration(session.durationSec)}`}
        </p>
      </div>

      <div className="space-y-2">
        {session.exercises.map((ex, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="font-medium text-slate-800 dark:text-slate-100">
              {ex.exercise}
              {ex.originalExercise && (
                <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">
                  sustituyó a {ex.originalExercise}
                </span>
              )}
            </p>
            <ul className="mt-1 space-y-0.5 text-slate-500 dark:text-slate-400">
              {ex.sets.map((s, j) => (
                <li key={j}>
                  Serie {j + 1}: {s.weightKg ?? "—"}kg × {s.reps ?? "—"} (RIR {s.rir ?? "—"})
                  {isSetLogged(s) ? "" : " · sin confirmar"}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {session.exercises.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Día salteado, sin ejercicios registrados.
          </p>
        )}
      </div>
    </div>
  );
}

function UpcomingTab() {
  const { flatDays, logs, program } = useApp();
  const currentDay = getCurrentFlatDay(flatDays, logs);
  const currentWeekNumber = currentDay?.weekNumber ?? flatDays[flatDays.length - 1]?.weekNumber;
  const nextWeekNumber = (currentWeekNumber ?? 0) + 1;
  const nextWeek = program.blocks.flatMap((b) => b.weeks).find((w) => w.weekNumber === nextWeekNumber);

  if (!nextWeek) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No hay más semanas programadas después de esta.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Semana {nextWeek.weekNumber} · {nextWeek.label}
      </p>
      {nextWeek.days.map((day) => (
        <div
          key={day.name}
          className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="mb-2 font-semibold text-slate-800 dark:text-slate-100">{day.name}</h3>
          <ul className="space-y-1 text-sm text-slate-500 dark:text-slate-400">
            {day.exerciseGroups.map((g, i) => {
              const literal = getLiteralWorkingSets(g);
              return (
                <li key={i}>
                  {g.exercise} — {literal.length} serie{literal.length !== 1 ? "s" : ""}
                  {literal[0] ? ` · ${literal[0].reps} reps` : ""}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function HistoryScreen() {
  const [tab, setTab] = useState<"overview" | "exercise" | "calendar" | "upcoming">("overview");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  if (selectedSessionId) {
    return <SessionDetailView sessionId={selectedSessionId} onBack={() => setSelectedSessionId(null)} />;
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex gap-2 overflow-x-auto">
        {(
          [
            { id: "overview", label: "General" },
            { id: "exercise", label: "Por ejercicio" },
            { id: "calendar", label: "Calendario" },
            { id: "upcoming", label: "Próxima semana" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? "bg-accent-600 text-white"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab onSelectSession={setSelectedSessionId} />}
      {tab === "exercise" && <ExerciseTab />}
      {tab === "calendar" && <CalendarTab onSelectSession={setSelectedSessionId} />}
      {tab === "upcoming" && <UpcomingTab />}
    </div>
  );
}
