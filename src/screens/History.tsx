import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { getExerciseNamesByDay, getExerciseProgression } from "../lib/history";
import { getCurrentFlatDay } from "../lib/schedule";
import { getLiteralWorkingSets } from "../lib/program";
import { patchLoggedSet, clearLoggedSet } from "../lib/sessionEdit";
import { isSetLogged } from "../types/logs";
import { formatDate, formatDuration } from "../lib/time";
import { ProgressChart } from "../components/ProgressChart";
import { TrainingCalendar } from "../components/TrainingCalendar";
import { ActiveWorkoutBanner } from "../components/ActiveWorkoutBanner";
import { RIRSelector } from "../components/RIRSelector";
import { NumericInput } from "../components/NumericInput";
import { IconChevronLeft, IconPencil, IconRotateCcw, IconTrash } from "../components/icons";
import type { LoggedSet, RIRValue, WorkoutSession } from "../types/logs";

function StatTile({ value, label, tone }: { value: number; label: string; tone?: "success" | "warning" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-ink";
  return (
    <div className="rounded-card border border-border bg-surface p-3 text-center shadow-elevated-sm">
      <p className={`font-mono text-2xl font-bold ${toneClass}`}>{value}</p>
      <p className="text-xs text-faint">{label}</p>
    </div>
  );
}

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
        <StatTile value={finished} label={`de ${flatDays.length} días`} />
        <StatTile value={completed.length} label="completados" tone="success" />
        <StatTile value={skipped.length} label="salteados" tone="warning" />
      </div>

      {nextDeload && (
        <p className="text-sm text-muted">
          Próxima semana de deload: <span className="font-mono font-medium text-ink">Semana {nextDeload.weekNumber}</span>
        </p>
      )}

      <div className="space-y-2">
        {sessionsSorted.length === 0 && (
          <p className="text-sm text-muted">Todavía no registraste entrenamientos.</p>
        )}
        {sessionsSorted.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelectSession(s.id)}
            className={`flex w-full items-center justify-between rounded-block border border-l-[3px] border-border bg-surface px-4 py-3 text-left ${
              s.status === "completed" ? "border-l-success" : "border-l-warning"
            }`}
          >
            <div>
              <p className="font-medium text-ink">
                {s.dayName} · Semana {s.weekNumber}
              </p>
              <p className="font-mono text-xs text-muted">
                {formatDate(s.completedAt ?? s.startedAt)}
                {s.durationSec !== null && ` · ${formatDuration(s.durationSec)}`}
              </p>
            </div>
            <span
              className={`rounded-pill px-2 py-0.5 text-xs font-medium ${
                s.status === "completed" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
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
  const exercisesByDay = useMemo(() => getExerciseNamesByDay(program), [program]);
  const [selected, setSelected] = useState(exercisesByDay[0]?.exercises[0] ?? "");

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
        className="w-full rounded-pill border border-border bg-surface2 px-3 py-2 text-sm text-ink"
      >
        {exercisesByDay.map(({ day, exercises }) => (
          <optgroup key={day} label={day}>
            {exercises.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
        <p className="mb-2 text-sm font-medium text-ink">Progresión (serie principal)</p>
        <ProgressChart points={progression} />
      </div>

      <div className="space-y-2">
        {pastSessions.map((s) => {
          const ex = s.exercises.find((e) => e.exercise === selected)!;
          return (
            <div key={s.id} className="rounded-block border border-border bg-surface p-3 text-sm">
              <p className="font-medium text-ink">
                Semana {s.weekNumber} · {formatDate(s.completedAt ?? s.startedAt)}
              </p>
              <p className="font-mono text-muted">
                {ex.sets
                  .filter(isSetLogged)
                  .map((set) => `${set.weightKg}kg×${set.reps} (RIR ${set.rir})`)
                  .join(" · ") || "sin registros"}
              </p>
            </div>
          );
        })}
        {pastSessions.length === 0 && (
          <p className="text-sm text-muted">Todavía no hay sesiones registradas para este ejercicio.</p>
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

function EditableSetRow({
  session,
  exerciseIdx,
  set,
  index,
}: {
  session: WorkoutSession;
  exerciseIdx: number;
  set: LoggedSet;
  index: number;
}) {
  const { upsertSession } = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ weightKg: number | null; reps: number | null; rir: RIRValue | null }>({
    weightKg: set.weightKg,
    reps: set.reps,
    rir: set.rir,
  });

  function startEdit() {
    setDraft({ weightKg: set.weightKg, reps: set.reps, rir: set.rir });
    setEditing(true);
  }

  function save() {
    upsertSession(
      patchLoggedSet(session, exerciseIdx, set.setIndex, {
        weightKg: draft.weightKg,
        reps: draft.reps,
        rir: draft.rir,
        confirmed: draft.weightKg !== null && draft.reps !== null && draft.rir !== null,
      })
    );
    setEditing(false);
  }

  function remove() {
    if (!window.confirm("¿Eliminar esta serie? Se borran el peso, las reps y el RIR registrados.")) return;
    upsertSession(clearLoggedSet(session, exerciseIdx, set.setIndex));
  }

  function redo() {
    if (!window.confirm("¿Volver a hacer esta serie? Se borra lo cargado para completarla de nuevo ahora.")) {
      return;
    }
    upsertSession(clearLoggedSet(session, exerciseIdx, set.setIndex));
    setDraft({ weightKg: null, reps: null, rir: null });
    setEditing(true);
  }

  if (editing) {
    return (
      <li className="rounded-block border border-primary/40 bg-surface2 p-2">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <NumericInput
            value={draft.weightKg}
            onChange={(weightKg) => setDraft((d) => ({ ...d, weightKg }))}
            allowDecimal
            className="h-10 w-full rounded-pill border border-border bg-surface px-2 font-mono text-sm text-ink"
          />
          <NumericInput
            value={draft.reps}
            onChange={(reps) => setDraft((d) => ({ ...d, reps }))}
            allowDecimal={false}
            className="h-10 w-full rounded-pill border border-border bg-surface px-2 font-mono text-sm text-ink"
          />
        </div>
        <RIRSelector value={draft.rir} onChange={(rir) => setDraft((d) => ({ ...d, rir }))} />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-pill bg-primary py-1.5 text-xs font-semibold text-white"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex-1 rounded-pill bg-surface py-1.5 text-xs font-semibold text-muted"
          >
            Cancelar
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 py-0.5">
      <span>
        Serie {index + 1}: {set.weightKg ?? "—"}kg × {set.reps ?? "—"} (RIR {set.rir ?? "—"})
        {isSetLogged(set) ? "" : " · sin confirmar"}
      </span>
      <span className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={startEdit}
          aria-label="Editar serie"
          className="rounded-pill p-1 text-faint hover:bg-surface2"
        >
          <IconPencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={redo}
          aria-label="Rehacer serie"
          className="rounded-pill p-1 text-faint hover:bg-surface2"
        >
          <IconRotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={remove}
          aria-label="Eliminar serie"
          className="rounded-pill p-1 text-faint hover:bg-surface2"
        >
          <IconTrash className="h-3.5 w-3.5" />
        </button>
      </span>
    </li>
  );
}

function SessionDetailView({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const { logs } = useApp();
  const session = logs.sessions.find((s) => s.id === sessionId);

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      aria-label="Volver"
      className="flex h-[34px] w-[34px] items-center justify-center rounded-pill border border-border bg-surface2 text-ink transition-transform hover:bg-border/60 active:scale-95 active:bg-border"
    >
      <IconChevronLeft className="h-[18px] w-[18px]" />
    </button>
  );

  if (!session) {
    return (
      <div className="space-y-4 pb-24">
        {backButton}
        <p className="text-sm text-muted">No se encontró esta sesión.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {backButton}

      <div>
        <h2 className="text-xl font-bold text-ink">
          {session.dayName} · Semana {session.weekNumber}
        </h2>
        <p className="font-mono text-sm text-muted">
          {formatDate(session.completedAt ?? session.startedAt)} ·{" "}
          {session.status === "completed" ? "Completado" : session.status === "skipped" ? "Salteado" : "En curso"}
          {session.durationSec !== null && ` · ${formatDuration(session.durationSec)}`}
        </p>
      </div>

      <div className="space-y-2">
        {session.exercises.map((ex, i) => (
          <div key={i} className="rounded-block border border-border bg-surface p-3 text-sm">
            <p className="font-medium text-ink">
              {ex.exercise}
              {ex.originalExercise && (
                <span className="ml-2 text-xs font-normal text-warning">sustituyó a {ex.originalExercise}</span>
              )}
            </p>
            <ul className="mt-1 space-y-0.5 font-mono text-muted">
              {ex.sets.map((s, j) => (
                <EditableSetRow key={s.setIndex} session={session} exerciseIdx={i} set={s} index={j} />
              ))}
            </ul>
          </div>
        ))}
        {session.exercises.length === 0 && (
          <p className="text-sm text-muted">Día salteado, sin ejercicios registrados.</p>
        )}
      </div>
    </div>
  );
}

function UpcomingTab() {
  const { flatDays, logs, program, settings } = useApp();
  const currentDay = getCurrentFlatDay(flatDays, logs, settings.programCycle);
  const currentWeekNumber = currentDay?.weekNumber ?? flatDays[flatDays.length - 1]?.weekNumber;
  const nextWeekNumber = (currentWeekNumber ?? 0) + 1;
  const nextWeek = program.blocks.flatMap((b) => b.weeks).find((w) => w.weekNumber === nextWeekNumber);

  if (!nextWeek) {
    return <p className="text-sm text-muted">No hay más semanas programadas después de esta.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-sm text-muted">
        Semana {nextWeek.weekNumber} · {nextWeek.label}
      </p>
      {nextWeek.days.map((day) => (
        <div key={day.name} className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
          <h3 className="mb-2 font-semibold text-ink">{day.name}</h3>
          <ul className="space-y-1 text-sm text-muted">
            {day.exerciseGroups.map((g, i) => {
              const literal = getLiteralWorkingSets(g);
              return (
                <li key={i}>
                  {g.exercise} —{" "}
                  <span className="font-mono">
                    {literal.length} serie{literal.length !== 1 ? "s" : ""}
                    {literal[0] ? ` · ${literal[0].reps} reps` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

interface HistoryScreenProps {
  activeDraft: WorkoutSession | null;
  onResumeWorkout: () => void;
}

export function HistoryScreen({ activeDraft, onResumeWorkout }: HistoryScreenProps) {
  const [tab, setTab] = useState<"overview" | "exercise" | "calendar" | "upcoming">("overview");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  if (selectedSessionId) {
    return <SessionDetailView sessionId={selectedSessionId} onBack={() => setSelectedSessionId(null)} />;
  }

  return (
    <div className="space-y-4 pb-24">
      {activeDraft && <ActiveWorkoutBanner draft={activeDraft} onResume={onResumeWorkout} />}

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
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
            className={`shrink-0 rounded-pill px-3 py-1.5 text-sm font-medium transition-opacity active:opacity-70 ${
              tab === t.id ? "bg-primary text-white" : "bg-surface2 text-faint"
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
