import { useApp } from "../context/AppContext";
import { localDateKey } from "../lib/time";
import { computeHabitStreak } from "../lib/habitStreaks";
import { restoreHabit } from "../lib/habitActions";
import { formatDateOnly } from "../lib/time";
import { habitIconFor } from "../components/habits/habitVisuals";
import { IconButton } from "../components/habits/IconButton";
import { IconArrowLeft, IconInfo, IconRotateCcw } from "../components/icons";

interface Props {
  onBack: () => void;
}

export function ArchivedHabitsScreen({ onBack }: Props) {
  const { logs, upsertHabit } = useApp();
  const today = localDateKey(new Date());
  const archived = logs.habits.filter((h) => h.archivedAt);

  return (
    <div className="pb-24">
      <div className="mb-4 flex items-center gap-3">
        <IconButton aria-label="Volver" onClick={onBack}>
          <IconArrowLeft className="h-[18px] w-[18px]" />
        </IconButton>
        <h1 className="text-lg font-bold text-ink">Archivados</h1>
      </div>

      {archived.length === 0 ? (
        <p className="pt-10 text-center text-sm text-faint">Todavía no archivaste ningún hábito.</p>
      ) : (
        <div className="space-y-2.5">
          {archived.map((h) => {
            const Icon = habitIconFor(h.icon);
            const { best } = computeHabitStreak(h, logs.habitEntries, today);
            return (
              <div key={h.id} className="rounded-card border border-border bg-surface p-3.5 opacity-80">
                <div className="flex items-center gap-3">
                  <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-block bg-ghost text-muted">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[15px] font-bold text-ink">
                      {h.name}
                      <span className="rounded-pill bg-surface2 px-2 py-0.5 text-[11px] font-bold text-muted">archivado</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      Archivado el {formatDateOnly((h.archivedAt ?? "").slice(0, 10))} · mejor racha {best} días
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => upsertHabit(restoreHabit(h))}
                  className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-pill border border-border text-sm font-semibold text-ink"
                >
                  <IconRotateCcw className="h-4 w-4" />
                  Restaurar
                </button>
              </div>
            );
          })}
          <div className="flex items-start gap-2.5 rounded-block border border-border p-3 text-xs leading-relaxed text-muted">
            <IconInfo className="h-4 w-4 shrink-0" />
            Tu historial queda guardado. Si lo restaurás, vuelve con todo su mapa de calor.
          </div>
        </div>
      )}
    </div>
  );
}
