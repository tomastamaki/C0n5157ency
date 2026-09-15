import { useMemo, useState } from "react";
import type { WorkoutSession } from "../types/logs";
import { localDateKey } from "../lib/time";

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

interface Props {
  sessions: WorkoutSession[];
  onSelectSession: (id: string) => void;
}

export function TrainingCalendar({ sessions, onSelectSession }: Props) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const byDate = useMemo(() => {
    const map = new Map<string, WorkoutSession>();
    for (const s of sessions) {
      map.set(localDateKey(s.completedAt ?? s.startedAt), s);
    }
    return map;
  }, [sessions]);

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthCursor(new Date(year, month - 1, 1))}
          className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <p className="font-medium capitalize text-slate-700 dark:text-slate-200">
          {monthCursor.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
        </p>
        <button
          type="button"
          onClick={() => setMonthCursor(new Date(year, month + 1, 1))}
          className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const session = byDate.get(localDateKey(date));
          const isToday = localDateKey(date) === localDateKey(new Date());
          return (
            <button
              key={i}
              type="button"
              disabled={!session}
              onClick={() => session && onSelectSession(session.id)}
              className={`flex aspect-square items-center justify-center rounded-lg text-xs font-medium ${
                session
                  ? session.status === "completed"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  : isToday
                    ? "border border-accent-300 text-slate-500 dark:border-accent-700 dark:text-slate-400"
                    : "text-slate-400 dark:text-slate-600"
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> completado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> salteado
        </span>
      </div>
    </div>
  );
}
