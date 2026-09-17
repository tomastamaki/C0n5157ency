import { useApp } from "../context/AppContext";
import { getCurrentFlatDay, getNextProgramIndex } from "../lib/schedule";

export function ProgramProgress() {
  const { logs, flatDays, program } = useApp();

  if (flatDays.length === 0) return null;

  const finishedDays = getNextProgramIndex(logs);
  const currentDay = getCurrentFlatDay(flatDays, logs);
  const lastDay = flatDays[flatDays.length - 1];
  const currentWeekNumber = currentDay?.weekNumber ?? lastDay.weekNumber;
  const totalWeeks = lastDay.totalWeeks;
  const daysPerWeek = program.blocks[0]?.weeks[0]?.days.length ?? 4;

  const completedThisWeek = logs.sessions.filter(
    (s) => s.status === "completed" && s.weekNumber === currentWeekNumber
  ).length;

  const pct = Math.min(100, Math.round((finishedDays / flatDays.length) * 100));

  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink">
          Semana <span className="font-mono">{currentWeekNumber}</span> de{" "}
          <span className="font-mono">{totalWeeks}</span>
        </span>
        <span className="font-mono text-faint">
          {completedThisWeek} de {daysPerWeek} esta semana
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-sky-300 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
