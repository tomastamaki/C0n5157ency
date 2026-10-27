import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import { getAllCurrentRecordsByDay } from "../lib/records";
import { formatDate } from "../lib/time";
import { IconChevronLeft, IconTrophy } from "./icons";
import { EmptyState } from "./EmptyState";

interface Props {
  currentWeekNumber: number;
  cycle: number;
  onBack: () => void;
}

/** PR actual (peso máximo) de todos los ejercicios con registro, agrupado por tipo de día. Los logrados en la semana/ciclo actual quedan destacados con el peso anterior que superaron. */
export function PRDetailView({ currentWeekNumber, cycle, onBack }: Props) {
  const { logs, program } = useApp();
  const byDay = useMemo(
    () => getAllCurrentRecordsByDay(logs, program, currentWeekNumber, cycle),
    [logs, program, currentWeekNumber, cycle]
  );
  const hasAny = byDay.some((g) => g.records.length > 0);

  return (
    <div className="space-y-4 pb-24">
      <button
        type="button"
        onClick={onBack}
        aria-label="Volver"
        className="flex h-[34px] w-[34px] items-center justify-center rounded-pill border border-border bg-surface2 text-ink transition-transform hover:bg-border/60 active:scale-95"
      >
        <IconChevronLeft className="h-[18px] w-[18px]" />
      </button>
      <h2 className="text-xl font-bold text-ink">PRs por ejercicio</h2>
      {!hasAny ? (
        <EmptyState
          icon={<IconTrophy className="h-8 w-8" />}
          title="Todavía no hay récords"
          hint="Cuando completes series con peso, el récord de cada ejercicio va a aparecer acá."
        />
      ) : (
        <div className="space-y-5">
          {byDay.map(({ day, records }) => (
            <div key={day} className="space-y-2">
              <p className="text-sm font-semibold text-ink">{day}</p>
              {records.map((r) => (
                <div
                  key={r.exercise}
                  className={`rounded-block border p-3 shadow-elevated-sm ${
                    r.isThisWeek ? "border-accent/40 bg-accent/5" : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {r.isThisWeek && <IconTrophy className="h-3.5 w-3.5 shrink-0 text-accent" />}
                    <p className="font-medium text-ink">{r.exercise}</p>
                  </div>
                  <p className="font-mono text-sm text-success">
                    {r.weightKg}kg × {r.reps}
                    {r.isThisWeek &&
                      (r.previousWeightKg !== null ? (
                        <span className="text-muted"> (superó {r.previousWeightKg}kg)</span>
                      ) : (
                        <span className="text-muted"> (primer registro)</span>
                      ))}
                  </p>
                  <p className="text-xs text-faint">{formatDate(r.date)}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
