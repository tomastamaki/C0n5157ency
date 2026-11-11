import type { Habit, HabitEntry } from "../types/habits";
import {
  addDays,
  computeHabitStreak,
  computeRecovery,
  entryMapFor,
  isScheduledDate,
  mondayOf,
  weeklyProgress,
  type RecoveryInfo,
} from "./habitStreaks";
import type { HeatCellState } from "../components/habits/habitVisuals";

export interface TodayItem {
  habit: Habit;
  entry: HabitEntry | null;
  status: "pending" | "done" | "skip";
  streak: number;
  streakUnit?: string;
  heat: HeatCellState[];
  recovery: RecoveryInfo;
  weekly: { done: number; n: number } | null;
}

function latestEntryFor(habit: Habit, allEntries: HabitEntry[], date: string): HabitEntry | null {
  return entryMapFor(habit.id, allEntries).get(date) ?? null;
}

function statusOf(entry: HabitEntry | null): "pending" | "done" | "skip" {
  if (entry?.status === "done") return "done";
  if (entry?.status === "skip") return "skip";
  return "pending";
}

/** Mini fila de los últimos `days` días calendario (no solo los programados), igual que en habi7-diseno.html. */
export function heatCellsFor(habit: Habit, allEntries: HabitEntry[], asOf: string, days = 14): HeatCellState[] {
  const entries = entryMapFor(habit.id, allEntries);
  const out: HeatCellState[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(asOf, -i);
    const e = entries.get(d);
    if (e?.status === "done") out.push("done");
    else if (e?.status === "skip") out.push("skip");
    else if (d === asOf) out.push("pending");
    else out.push("none");
  }
  return out;
}

/** Hábitos relevantes hoy: programados hoy, o de meta semanal (siempre visibles hasta cumplir la semana). */
export function isRelevantToday(habit: Habit, asOf: string): boolean {
  if (habit.archivedAt) return false;
  // "tracking" es solo registro y tendencia: sin racha ni cumplimiento, nunca aparece en Hoy.
  if (habit.type === "tracking") return false;
  if (habit.frequency.kind === "weekly") return habit.startDate <= asOf;
  return isScheduledDate(habit, asOf);
}

export function buildTodayItems(habits: Habit[], allEntries: HabitEntry[], asOf: string): TodayItem[] {
  return habits
    .filter((h) => isRelevantToday(h, asOf))
    .map((habit) => {
      const entry = latestEntryFor(habit, allEntries, asOf);
      const { streak } = computeHabitStreak(habit, allEntries, asOf);
      const weekly = weeklyProgress(habit, allEntries, asOf);
      return {
        habit,
        entry,
        status: statusOf(entry),
        streak,
        streakUnit: habit.frequency.kind === "weekly" ? "sem." : "días",
        heat: heatCellsFor(habit, allEntries, asOf),
        recovery: computeRecovery(habit, allEntries, asOf),
        weekly,
      };
    });
}

export interface HeroRing {
  done: number;
  total: number;
}

/** Anillo del día: de los hábitos relevantes hoy que no están salteados, cuántos ya están hechos. */
export function buildHeroRing(items: TodayItem[]): HeroRing {
  const counted = items.filter((i) => i.status !== "skip");
  const done = counted.filter((i) => i.status === "done").length;
  return { done, total: counted.length };
}

/** Título + bajada del encabezado de "Hoy", según cuánto queda y si hay hábitos o no. */
export function buildHeroMessage(items: TodayItem[], hero: HeroRing): [string, string] {
  const left = hero.total - hero.done;
  if (items.length === 0) return ["Todavía no tenés hábitos", "Empezá con uno solo. Lo difícil es arrancar."];
  if (hero.total === 0) return ["Por hoy, ya está", "Lo de hoy quedó salteado. Mañana es otro día."];
  if (left === 0) return ["¡Día completo!", "Vamos toro. Hoy cerraste todo."];
  if (hero.done === 0) return ["Arrancá con lo fácil", "Un solo toque y ya estás en marcha."];
  return ["Vamos toro", `Te faltan ${left} para cerrar el día.`];
}

const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

export interface WeekStripDayData {
  letter: string;
  dayNumber: number;
  date: string;
  done: number;
  total: number;
  isToday: boolean;
}

/**
 * Tira de la semana en curso (lunes a domingo). Para días futuros no hay
 * nada que contar todavía: quedan en 0/0 (anillo vacío, sin pintar un
 * incumplimiento que todavía no pasó).
 */
export function buildWeekStrip(habits: Habit[], allEntries: HabitEntry[], asOf: string): WeekStripDayData[] {
  const monday = mondayOf(asOf);
  const active = habits.filter((h) => !h.archivedAt && h.frequency.kind !== "weekly");
  const out: WeekStripDayData[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const dayNumber = Number(date.slice(8, 10));
    if (date > asOf) {
      out.push({ letter: DAY_LETTERS[i], dayNumber, date, done: 0, total: 0, isToday: false });
      continue;
    }
    const scheduled = active.filter((h) => isScheduledDate(h, date));
    const done = scheduled.filter((h) => entryMapFor(h.id, allEntries).get(date)?.status === "done").length;
    out.push({ letter: DAY_LETTERS[i], dayNumber, date, done, total: scheduled.length, isToday: date === asOf });
  }
  return out;
}
