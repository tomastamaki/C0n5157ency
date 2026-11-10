import { localDateKey } from "../../lib/time";
import { buildHeroMessage, buildHeroRing, buildTodayItems } from "../../lib/habitsToday";
import { computeGlobalStreak } from "../../lib/habitStreaks";
import type { LogsData } from "../../types/logs";
import { Ring } from "./Ring";
import { Pill } from "./Pill";
import { IconFlame, IconHabits } from "../icons";

interface Props {
  logs: LogsData;
  onNavigate: () => void;
}

/** Tarjeta resumen de "Hábitos de hoy" para la pantalla de Inicio. */
export function HabitsTodayCard({ logs, onNavigate }: Props) {
  const today = localDateKey(new Date());
  const items = buildTodayItems(logs.habits, logs.habitEntries, today);
  const hero = buildHeroRing(items);
  const [title, subtitle] = buildHeroMessage(items, hero);
  const globalStreak = computeGlobalStreak(logs.habits, logs.habitEntries, today);

  const hasHabits = logs.habits.some((h) => !h.archivedAt);

  return (
    <button
      type="button"
      onClick={onNavigate}
      className="w-full rounded-card border border-border bg-surface p-4 text-left shadow-elevated-sm"
    >
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <IconHabits className="h-4 w-4 text-primary" />
          Hábitos de hoy
        </p>
        <span className="text-xs text-primary">{hasHabits ? "Ver todos →" : "Crear →"}</span>
      </div>

      {hasHabits ? (
        <div className="mt-3 flex items-center gap-3">
          <Ring
            size={54}
            strokeWidth={6}
            pct={hero.total ? hero.done / hero.total : 0}
            color={hero.total && hero.done === hero.total ? "rgb(var(--success))" : "rgb(var(--primary))"}
            centerLabel={
              <span className="font-mono text-xs font-extrabold text-ink">
                {hero.done}/{hero.total}
              </span>
            }
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{title}</p>
            <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">Todavía no tenés hábitos. Empezá con uno solo.</p>
      )}

      {globalStreak.streak > 0 && (
        <div className="mt-3">
          <Pill tone="acc" icon={<IconFlame className="h-3 w-3" />}>
            {globalStreak.streak} días seguidos
          </Pill>
        </div>
      )}
    </button>
  );
}
