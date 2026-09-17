import { useMemo, useState } from "react";
import type { WorkoutSession } from "../types/logs";
import { localDateKey } from "../lib/time";

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

const DAY_ABBREV: Record<string, string> = { Upper: "Up", Lower: "Lo", Push: "Ps", Pull: "Pl" };

function dayAbbrev(dayName: string): string {
  return DAY_ABBREV[dayName] ?? dayName.slice(0, 2);
}

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
    <div className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthCursor(new Date(year, month - 1, 1))}
          className="rounded-pill px-2 py-1 text-faint hover:bg-surface2"
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <p className="font-medium capitalize text-ink">
          {monthCursor.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
        </p>
        <button
          type="button"
          onClick={() => setMonthCursor(new Date(year, month + 1, 1))}
          className="rounded-pill px-2 py-1 text-faint hover:bg-surface2"
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-faint">
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
              title={session ? `${session.dayName} · ${session.status === "completed" ? "completado" : "salteado"}` : undefined}
              className={`flex aspect-square flex-col items-center justify-center rounded-pill font-mono text-xs font-medium leading-tight ${
                session
                  ? session.status === "completed"
                    ? "bg-success/15 text-success"
                    : "bg-warning/15 text-warning"
                  : isToday
                    ? "border border-primary/40 text-faint"
                    : "text-faint/60"
              }`}
            >
              <span>{date.getDate()}</span>
              {session && <span className="text-[9px] font-semibold opacity-80">{dayAbbrev(session.dayName)}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex gap-4 text-xs text-faint">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-success" /> completado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-warning" /> salteado
        </span>
      </div>
    </div>
  );
}
