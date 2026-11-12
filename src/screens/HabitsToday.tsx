import { useMemo, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { localDateKey } from "../lib/time";
import { buildHeroMessage, buildHeroRing, buildTodayItems, buildWeekStrip, type TodayItem } from "../lib/habitsToday";
import { computeGlobalStreak, computeHabitStreak, detectMilestone } from "../lib/habitStreaks";
import { completeTimeGoal, skipToday, toggleDone, unskip } from "../lib/habitActions";
import { addLog, lastLogForDate, removeLog } from "../lib/habitLogs";
import { Ring } from "../components/habits/Ring";
import { WeekStrip } from "../components/habits/WeekStrip";
import { Chip } from "../components/habits/Chip";
import { HabitCard, type HabitCardProps } from "../components/habits/HabitCard";
import { HabitTile } from "../components/habits/HabitTile";
import { HabitsTodayMetricsStrip } from "../components/habits/HabitsTodayMetricsStrip";
import { SwipeToSkip } from "../components/habits/SwipeToSkip";
import { UndoToast } from "../components/habits/UndoToast";
import { MilestoneModal } from "../components/habits/MilestoneModal";
import { IconButton, Fab } from "../components/habits/IconButton";
import { EmptyState } from "../components/EmptyState";
import { IconFlame, IconGrid, IconHabits, IconPlus } from "../components/icons";
import { HABIT_CATEGORIES } from "../lib/habitTemplates";
import { HABIT_COLORS } from "../components/habits/habitVisuals";
import type { Habit, HabitEntry } from "../types/habits";

const GROUPS: Habit["timeOfDay"][] = ["Mañana", "Tarde", "Noche", "Todo el día"];

interface UndoState {
  message: string;
  restore: () => void;
}

interface MilestoneState {
  habitName: string;
  milestone: number;
  color: string;
  habitId: string;
}

interface Props {
  onCreateHabit: () => void;
  onOpenDetail: (habitId: string) => void;
  onEdit: (habitId: string) => void;
}

export function HabitsTodayScreen({ onCreateHabit, onOpenDetail, onEdit }: Props) {
  const { logs, upsertHabitEntry, removeHabitEntry, upsertHabitLog, removeHabitLog } = useApp();
  const [category, setCategory] = useState<"Todos" | Habit["timeOfDay"] | string>("Todos");
  const [grid, setGrid] = useState(false);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [milestone, setMilestone] = useState<MilestoneState | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = localDateKey(new Date());
  const items = useMemo(() => buildTodayItems(logs.habits, logs.habitEntries, today), [logs.habits, logs.habitEntries, today]);
  const hero = buildHeroRing(items);
  const weekDays = useMemo(() => buildWeekStrip(logs.habits, logs.habitEntries, today), [logs.habits, logs.habitEntries, today]);
  const globalStreak = useMemo(() => computeGlobalStreak(logs.habits, logs.habitEntries, today), [logs.habits, logs.habitEntries, today]);

  function showUndo(message: string, previous: HabitEntry | null, entryId: string) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({
      message,
      restore: () => {
        if (previous) upsertHabitEntry(previous);
        else removeHabitEntry(entryId);
        setUndo(null);
      },
    });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  }

  function applyResult(habit: Habit, result: { next: HabitEntry | null; previous: HabitEntry | null }, message: string) {
    const before = computeHabitStreak(habit, logs.habitEntries, today).streak;
    if (result.next) upsertHabitEntry(result.next);
    else if (result.previous) removeHabitEntry(result.previous.id);
    const entryId = result.next?.id ?? result.previous?.id ?? "";
    showUndo(message, result.previous, entryId);

    if (result.next?.status === "done") {
      const nextEntries = [...logs.habitEntries.filter((e) => e.id !== result.next!.id), result.next];
      const after = computeHabitStreak(habit, nextEntries, today).streak;
      const reached = detectMilestone(before, after);
      if (reached) setMilestone({ habitName: habit.name, milestone: reached, color: HABIT_COLORS[habit.color], habitId: habit.id });
    }
  }

  function handleToggle(item: TodayItem) {
    applyResult(item.habit, toggleDone(item.habit, logs.habitEntries, today), `${item.habit.name} listo. Vamos toro`);
  }

  function handleAdd(item: TodayItem, amount: number) {
    const { habit } = item;
    const before = computeHabitStreak(habit, logs.habitEntries, today).streak;
    const result = addLog(habit, logs.habitLogs, logs.habitEntries, today, amount);
    upsertHabitLog(result.log);
    if (result.entry) upsertHabitEntry(result.entry);
    else if (result.previousEntry) removeHabitEntry(result.previousEntry.id);

    const message = `+${amount} ${habit.unit ?? ""}`.trim();
    const logId = result.log.id;
    const previousEntry = result.previousEntry;
    const previousEntryId = result.entry?.id ?? previousEntry?.id ?? "";
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({
      message,
      restore: () => {
        removeHabitLog(logId);
        if (previousEntry) upsertHabitEntry(previousEntry);
        else if (previousEntryId) removeHabitEntry(previousEntryId);
        setUndo(null);
      },
    });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);

    if (result.entry?.status === "done") {
      const nextEntries = [...logs.habitEntries.filter((e) => e.id !== result.entry!.id), result.entry];
      const after = computeHabitStreak(habit, nextEntries, today).streak;
      const reached = detectMilestone(before, after);
      if (reached) setMilestone({ habitName: habit.name, milestone: reached, color: HABIT_COLORS[habit.color], habitId: habit.id });
    }
  }

  /**
   * "Deshacer el último registro": saca el log más reciente de hoy y
   * recalcula el entry del día. Es una acción en sí misma, así que reemplaza
   * el aviso flotante (si había uno de un registro anterior, ya no aplica) y
   * ofrece su propio "Deshacer" para volver a agregar ese mismo registro.
   */
  function handleUndoLast(item: TodayItem) {
    const { habit } = item;
    const last = lastLogForDate(habit, logs.habitLogs, today);
    if (!last) return;
    const result = removeLog(habit, logs.habitLogs, logs.habitEntries, last.id);
    if (!result) return;
    removeHabitLog(last.id);
    if (result.entry) upsertHabitEntry(result.entry);
    else if (result.previousEntry) removeHabitEntry(result.previousEntry.id);

    const message = `Último registro deshecho (+${last.value} ${habit.unit ?? ""})`.trim();
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({
      message,
      restore: () => {
        upsertHabitLog(last);
        if (result.previousEntry) upsertHabitEntry(result.previousEntry);
        else if (result.entry) removeHabitEntry(result.entry.id);
        setUndo(null);
      },
    });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  }

  function handleStart(item: TodayItem) {
    applyResult(item.habit, completeTimeGoal(item.habit, logs.habitEntries, today), `${item.habit.name} listo. Vamos toro`);
  }

  function handleSkip(item: TodayItem) {
    applyResult(item.habit, skipToday(item.habit, logs.habitEntries, today), `${item.habit.name} salteado. Tu racha sigue`);
  }

  function handleUnskip(item: TodayItem) {
    applyResult(item.habit, unskip(item.habit, logs.habitEntries, today), "Deshecho");
  }

  function toCardProps(item: TodayItem): HabitCardProps {
    const { habit } = item;
    const common = {
      id: habit.id,
      name: habit.name,
      icon: habit.icon,
      color: habit.color,
      status: item.status,
      streak: item.streak,
      streakUnit: item.streakUnit,
      subtitle: "",
      heat: item.heat,
      auto: habit.linked !== null,
      recovery: item.recovery.show,
      weekly: item.weekly ?? undefined,
      onUnskip: () => handleUnskip(item),
      onOpenDetail: () => onOpenDetail(habit.id),
      onEdit: () => onEdit(habit.id),
    };
    if (habit.type === "quantity") {
      return {
        ...common,
        kind: "quantity",
        current: item.entry?.value ?? 0,
        goal: habit.goal ?? 0,
        unit: habit.unit ?? "",
        quickAmounts: habit.quickSteps,
        onAdd: (n) => handleAdd(item, n),
        onAddExact: (n) => handleAdd(item, n),
        onUndoLast: () => handleUndoLast(item),
        hasLogsToday: lastLogForDate(habit, logs.habitLogs, today) !== null,
        subtitle: `Meta: ${habit.goal ?? 0} ${habit.unit ?? ""}`.trim(),
      };
    }
    if (habit.type === "time") {
      return {
        ...common,
        kind: "time",
        goalMinutes: habit.goal ?? 0,
        onStart: () => handleStart(item),
      };
    }
    if (habit.type === "avoid") {
      return { ...common, kind: "avoid", onToggle: () => handleToggle(item), subtitle: "A evitar · todos los días" };
    }
    return { ...common, kind: "yesno", onToggle: () => handleToggle(item) };
  }

  const filtered = items.filter((i) => category === "Todos" || i.habit.category === category);
  const groups = GROUPS.map((g) => ({ g, list: filtered.filter((i) => i.habit.timeOfDay === g) })).filter((x) => x.list.length > 0);

  const doneCount = hero.done;
  const total = hero.total;
  const heroMsg = buildHeroMessage(items, hero);

  if (logs.habits.filter((h) => !h.archivedAt).length === 0) {
    return (
      <div className="space-y-4 pb-24">
        <EmptyState icon={<IconHabits className="h-8 w-8" />} title="Todavía no tenés hábitos" hint="Creá el primero para empezar a construir tu racha." />
        <button type="button" onClick={onCreateHabit} className="w-full rounded-pill bg-primary py-3 text-sm font-semibold text-white">
          Crear mi primer hábito
        </button>
      </div>
    );
  }

  return (
    <div className="relative space-y-3.5 pb-28">
      <div className="flex items-center justify-end">
        <IconButton aria-label="Cambiar vista" onClick={() => setGrid((g) => !g)}>
          <IconGrid className="h-[18px] w-[18px]" />
        </IconButton>
      </div>

      <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
        <Ring
          size={92}
          strokeWidth={9}
          pct={total ? doneCount / total : 0}
          color={total && doneCount === total ? "rgb(var(--success))" : "rgb(var(--primary))"}
          centerLabel={
            <span className="font-mono text-xl font-extrabold text-ink">
              {doneCount}/{total}
            </span>
          }
        />
        <div>
          <div className="text-lg font-extrabold tracking-tight text-ink">{heroMsg[0]}</div>
          <div className="mt-1 text-[13px] leading-snug text-muted">{heroMsg[1]}</div>
          {globalStreak.streak > 0 && (
            <div className="mt-2.5">
              <HeroFlamePill streak={globalStreak.streak} />
            </div>
          )}
        </div>
      </div>

      <HabitsTodayMetricsStrip
        habits={logs.habits.filter((h) => !h.archivedAt && h.type === "tracking" && h.metricKind !== null)}
        habitLogs={logs.habitLogs}
        onOpenDetail={onOpenDetail}
      />

      <WeekStrip
        days={weekDays.map((d) => ({ letter: d.letter, dayNumber: d.dayNumber, done: d.done, total: d.total, isToday: d.isToday }))}
      />

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <Chip label="Todos" active={category === "Todos"} onClick={() => setCategory("Todos")} />
        {HABIT_CATEGORIES.map((c) => (
          <Chip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
        ))}
      </div>

      {grid ? (
        <div className="grid grid-cols-2 gap-2.5">
          {filtered.map((item) => {
            const { habit } = item;
            const goal = habit.goal ?? 0;
            const quantityCaption = habit.type === "quantity" ? `${item.entry?.value ?? 0} / ${goal} ${habit.unit ?? ""}`.trim() : null;
            const weeklyCaption = item.weekly ? `${item.weekly.done}/${item.weekly.n} esta semana` : null;
            const caption =
              item.status === "skip"
                ? "Salteado"
                : item.status === "done"
                  ? "Listo"
                  : (quantityCaption ?? weeklyCaption ?? "Pendiente");
            function tap() {
              if (habit.type === "quantity") handleAdd(item, habit.quickSteps[0] ?? goal);
              else if (habit.type === "time") handleStart(item);
              else handleToggle(item);
            }
            return (
              <HabitTile
                key={habit.id}
                name={habit.name}
                icon={habit.icon}
                color={habit.color}
                status={item.status}
                streak={item.streak}
                streakUnit={item.streakUnit}
                caption={caption}
                progressPct={habit.type === "quantity" && goal > 0 ? ((item.entry?.value ?? 0) / goal) * 100 : undefined}
                onClick={tap}
            />
            );
          })}
        </div>
      ) : (
        groups.map(({ g, list }) => (
          <div key={g}>
            <div className="flex items-center justify-between px-1 pt-1 text-xs font-bold uppercase tracking-wide text-muted">
              <span>{g}</span>
              <span>
                {list.filter((i) => i.status === "done").length}/{list.filter((i) => i.status !== "skip").length}
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-2.5">
              {list.map((item) =>
                item.status === "pending" ? (
                  <SwipeToSkip key={item.habit.id} onSkip={() => handleSkip(item)}>
                    <HabitCard {...toCardProps(item)} />
                  </SwipeToSkip>
                ) : (
                  <HabitCard key={item.habit.id} {...toCardProps(item)} />
                )
              )}
            </div>
          </div>
        ))
      )}

      <p className="pt-1 text-center text-[11.5px] text-faint">Tocá para completar · deslizá para saltear</p>

      <Fab aria-label="Nuevo hábito" onClick={onCreateHabit} className="fixed bottom-24 right-6 z-20 md:absolute md:bottom-4">
        <IconPlus className="h-6 w-6" strokeWidth={2.4} />
      </Fab>

      {undo && (
        <div className="fixed inset-x-4 bottom-24 z-30 mx-auto max-w-md md:absolute md:bottom-4">
          <UndoToast message={undo.message} onUndo={undo.restore} />
        </div>
      )}

      {milestone && (
        <MilestoneModal
          habitName={milestone.habitName}
          milestone={milestone.milestone}
          color={milestone.color}
          onContinue={() => setMilestone(null)}
          onViewDetail={() => {
            const id = milestone.habitId;
            setMilestone(null);
            onOpenDetail(id);
          }}
        />
      )}
    </div>
  );
}

function HeroFlamePill({ streak }: { streak: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-accent">
      <IconFlame className="h-3 w-3" />
      {streak} días seguidos
    </span>
  );
}
