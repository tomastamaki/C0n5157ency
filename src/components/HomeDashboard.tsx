import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import type { WeekDayStatus } from "../lib/schedule";
import type { FlatProgramDay } from "../types/program";
import {
  countPRsInSession,
  getAttentionFlags,
  getCurrentStreak,
  getGreeting,
  getHighlightExercise,
  getLastCompletedSession,
  getMuscleChips,
  getPRsThisMonth,
  getWeeksUntilDeload,
} from "../lib/insights";
import { formatDate, formatDuration } from "../lib/time";
import { IconFlame, IconTrophy } from "./icons";

interface Props {
  weekDays: WeekDayStatus[];
  onStart: (flatDay: FlatProgramDay) => void;
  onSkip: (flatDay: FlatProgramDay) => void;
  onNavigateHistory: () => void;
}

export function HomeDashboard({ weekDays, onStart, onSkip, onNavigateHistory }: Props) {
  const { logs, program } = useApp();

  const pendingDays = weekDays.filter((d) => !d.session);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = pendingDays[Math.min(selectedIdx, pendingDays.length - 1)];

  const streak = useMemo(() => getCurrentStreak(logs), [logs]);
  const prsThisMonth = useMemo(() => getPRsThisMonth(logs), [logs]);
  const attention = useMemo(() => getAttentionFlags(logs), [logs]);
  const highlight = useMemo(() => getHighlightExercise(logs), [logs]);
  const lastSession = useMemo(() => getLastCompletedSession(logs), [logs]);
  const lastSessionPRs = useMemo(
    () => (lastSession ? countPRsInSession(logs, lastSession) : 0),
    [logs, lastSession]
  );

  const weekCompleted = weekDays.filter((d) => d.session?.status === "completed").length;
  const weekTotal = weekDays.length;
  const weekPct = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

  const currentWeekNumber = weekDays[0]?.flatDay.weekNumber ?? 1;
  const weeksUntilDeload = getWeeksUntilDeload(program, currentWeekNumber);

  if (!selected) return null;

  const chips = getMuscleChips(selected.flatDay.day.name);

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">{getGreeting()}</h1>
        {streak > 0 && (
          <div className="flex items-center gap-1 text-sm font-semibold text-accent">
            <IconFlame className="h-[18px] w-[18px]" />
            <span className="font-mono">{streak}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border border-border bg-surface p-3 shadow-elevated-sm">
          <p className="font-mono text-2xl font-bold text-ink">{weekPct}%</p>
          <p className="text-xs text-muted">
            {weekCompleted} de {weekTotal} esta semana
          </p>
        </div>
        <div className="rounded-card border border-border bg-surface p-3 shadow-elevated-sm">
          <p className="flex items-center gap-1 font-mono text-2xl font-bold text-accent">
            <IconTrophy className="h-5 w-5" />
            {prsThisMonth}
          </p>
          <p className="text-xs text-muted">PRs este mes</p>
        </div>
      </div>

      <div className="rounded-card border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5 shadow-elevated">
        <p className="text-sm text-muted">
          {selected.flatDay.blockName} · Semana {selected.flatDay.weekNumber} de {selected.flatDay.totalWeeks}
        </p>
        <h2 className="mt-1 text-2xl font-bold text-ink">{selected.flatDay.day.name}</h2>
        {chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="rounded-pill bg-surface2 px-2 py-0.5 text-xs text-muted">
                {c}
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => onStart(selected.flatDay)}
          className="mt-4 w-full rounded-pill bg-primary py-3 text-base font-semibold text-white shadow-elevated-sm active:scale-[0.98]"
        >
          Empezar entrenamiento
        </button>
        <button
          type="button"
          onClick={() => onSkip(selected.flatDay)}
          className="mt-2 w-full text-sm text-faint underline"
        >
          Saltear este día
        </button>

        {weekDays.length > 1 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-xs text-muted">Días de esta semana · elegí cuál hacer</p>
            <div className="flex flex-wrap gap-2">
              {weekDays.map((d, i) => {
                const pendingIdx = pendingDays.indexOf(d);
                const isDone = Boolean(d.session);
                const isSelected = !isDone && selected.flatDay.index === d.flatDay.index;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isDone}
                    onClick={() => pendingIdx >= 0 && setSelectedIdx(pendingIdx)}
                    className={`rounded-pill px-3 py-1.5 text-sm font-medium ${
                      isDone
                        ? "bg-success/10 text-success"
                        : isSelected
                          ? "bg-primary text-white"
                          : "bg-surface2 text-muted"
                    }`}
                  >
                    {d.flatDay.day.name}
                    {isDone && " ✓"}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {attention.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">Necesita atención</p>
          {attention.map((flag, i) => (
            <div key={i} className="rounded-block border-l-[3px] border-l-warning bg-surface p-3 shadow-elevated-sm">
              <p className="text-sm font-medium text-ink">{flag.exercise}</p>
              <p className="text-xs text-muted">{flag.detail}</p>
            </div>
          ))}
        </div>
      )}

      {highlight && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">Destacado</p>
          <div className="rounded-block border-l-[3px] border-l-success bg-surface p-3 shadow-elevated-sm">
            <p className="text-sm font-medium text-ink">{highlight.exercise}</p>
            <p className="font-mono text-xs text-success">
              +{highlight.pct.toFixed(0)}% desde tu primer registro
            </p>
          </div>
        </div>
      )}

      {weeksUntilDeload !== null && weeksUntilDeload > 0 && (
        <p className="text-center text-xs text-faint">
          {weeksUntilDeload === 1
            ? "La próxima semana es de deload"
            : `${weeksUntilDeload} semanas para tu próximo deload`}
        </p>
      )}

      {lastSession && (
        <button
          type="button"
          onClick={onNavigateHistory}
          className="w-full rounded-card border border-border bg-surface p-4 text-left shadow-elevated-sm"
        >
          <p className="text-sm font-semibold text-ink">Último entrenamiento</p>
          <p className="mt-1 font-mono text-xs text-muted">
            {lastSession.dayName} · {formatDate(lastSession.completedAt ?? lastSession.startedAt)}
            {lastSession.durationSec !== null && ` · ${formatDuration(lastSession.durationSec)}`}
            {lastSessionPRs > 0 && ` · ${lastSessionPRs} PR${lastSessionPRs > 1 ? "s" : ""}`}
          </p>
          <p className="mt-1 text-xs text-primary">Ver en Historial →</p>
        </button>
      )}
    </div>
  );
}
