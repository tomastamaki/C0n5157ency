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
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          Semana {currentWeekNumber} de {totalWeeks}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          {completedThisWeek} de {daysPerWeek} esta semana
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-accent-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
