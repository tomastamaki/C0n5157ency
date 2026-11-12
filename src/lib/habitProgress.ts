import type { Habit, HabitEntry } from "../types/habits";
import { addDays, consistencyScore, dayOfWeek, entryMapFor, isScheduledDate, mondayOf } from "./habitStreaks";
import { habitDayHeat, type HabitDayHeat } from "./habitHeat";

const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function weeksWindow(asOf: string, weeks: number): string[] {
  const lastMonday = mondayOf(asOf);
  const startMonday = addDays(lastMonday, -7 * (weeks - 1));
  const out: string[] = [];
  for (let col = 0; col < weeks; col++) out.push(addDays(startMonday, col * 7));
  return out;
}

/** Mapa de calor de UN hábito: 16 semanas, lunes arriba, columna por semana. Escala roja→verde (ver `habitDayHeat`). */
export function buildHabitHeatCells(habit: Habit, entries: HabitEntry[], asOf: string, weeks = 16): HabitDayHeat[] {
  const map = entryMapFor(habit.id, entries);
  const mondays = weeksWindow(asOf, weeks);
  const cells: HabitDayHeat[] = [];
  for (const monday of mondays) {
    for (let row = 0; row < 7; row++) cells.push(habitDayHeat(habit, map, addDays(monday, row), asOf));
  }
  return cells;
}

export interface GlobalDayHeat {
  /** null = gris neutro (sin hábitos programados ese día, o futuro) — nunca rojo por ausencia de datos. */
  pct: number | null;
  label: string;
}

function shortDate(d: string): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

/** Mapa de calor global: % de hábitos programados (no semanales, activos) cumplidos cada día. */
export function buildGlobalHeatCells(habits: Habit[], entries: HabitEntry[], asOf: string, weeks = 16): GlobalDayHeat[] {
  const active = habits.filter((h) => !h.archivedAt && h.frequency.kind !== "weekly" && h.type !== "tracking");
  const maps = new Map(active.map((h) => [h.id, entryMapFor(h.id, entries)]));
  const mondays = weeksWindow(asOf, weeks);
  const cells: GlobalDayHeat[] = [];
  for (const monday of mondays) {
    for (let row = 0; row < 7; row++) {
      const d = addDays(monday, row);
      const label = shortDate(d);
      if (d > asOf) {
        cells.push({ pct: null, label: `${label}: todavía no llega` });
        continue;
      }
      const scheduled = active.filter((h) => h.startDate <= d && isScheduledDate(h, d));
      if (scheduled.length === 0) {
        cells.push({ pct: null, label: `${label}: sin hábitos programados` });
        continue;
      }
      const done = scheduled.filter((h) => maps.get(h.id)!.get(d)?.status === "done").length;
      const pct = (done / scheduled.length) * 100;
      cells.push({ pct, label: `${label}: ${Math.round(pct)} % (${done}/${scheduled.length} hábitos)` });
    }
  }
  return cells;
}

/** Etiquetas de mes dispersas sobre el mapa de calor: una por columna, vacía salvo donde cambia el mes. */
export function monthLabelsForHeat(asOf: string, weeks = 16): string[] {
  const mondays = weeksWindow(asOf, weeks);
  const labels: string[] = [];
  let lastMonth = -1;
  for (const monday of mondays) {
    const month = Number(monday.slice(5, 7)) - 1;
    labels.push(month !== lastMonth ? MESES[month] : "");
    lastMonth = month;
  }
  return labels;
}

export interface WeekBar {
  label: string;
  value: number;
  isCurrent: boolean;
}

/** Cantidad de "hecho" por semana, últimas `count` semanas (sirve para cualquier frecuencia: el "hecho" es el mismo evento). */
export function weeklyDoneSeries(habit: Habit, entries: HabitEntry[], asOf: string, count = 8): WeekBar[] {
  const map = entryMapFor(habit.id, entries);
  const mondays = weeksWindow(asOf, count);
  const currentMonday = mondays[mondays.length - 1];
  return mondays.map((monday) => {
    let value = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      if (d > asOf || d < habit.startDate) continue;
      if (map.get(d)?.status === "done") value++;
    }
    const [dd, mm] = [monday.slice(8, 10), monday.slice(5, 7)];
    return { label: monday === currentMonday ? "Esta" : `${dd}/${mm}`, value, isCurrent: monday === currentMonday };
  });
}

/** % de cumplimiento calendario por mes (solo tiene sentido para hábitos no semanales), últimos `count` meses. */
export function monthlyCompliancePctSeries(habit: Habit, entries: HabitEntry[], asOf: string, count = 6): WeekBar[] {
  if (habit.frequency.kind === "weekly") return [];
  const map = entryMapFor(habit.id, entries);
  const [asOfYear, asOfMonth] = [Number(asOf.slice(0, 4)), Number(asOf.slice(5, 7))];
  const out: WeekBar[] = [];
  for (let i = count - 1; i >= 0; i--) {
    let y = asOfYear;
    let m = asOfMonth - i;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    const daysInMonth = new Date(y, m, 0).getDate();
    let done = 0;
    let elapsed = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (d < habit.startDate || d > asOf) continue;
      if (!isScheduledDate(habit, d)) continue;
      const e = map.get(d);
      if (e?.status === "skip") continue;
      elapsed++;
      if (e?.status === "done") done++;
    }
    const isCurrent = y === asOfYear && m === asOfMonth;
    out.push({ label: MESES[m - 1], value: elapsed === 0 ? 0 : Math.round((done / elapsed) * 100), isCurrent });
  }
  return out;
}

export type DayStatus = "done" | "skip" | "none" | "future";

export interface CalendarDay {
  day: number;
  date: string;
  status: DayStatus;
  /** Color/valor en la escala roja→verde (Fase 5), para pintar la celda igual que el resto de los mapas de calor. */
  heat: HabitDayHeat;
}

/** Grilla del mes (lunes a domingo, con huecos null antes del día 1), para el calendario editable de Detalle. */
export function buildMonthCalendar(habit: Habit, entries: HabitEntry[], year: number, month: number, asOf: string): (CalendarDay | null)[] {
  const map = entryMapFor(habit.id, entries);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const leadingBlanks = isoWeekday(firstDate);
  const cells: (CalendarDay | null)[] = Array(leadingBlanks).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const e = map.get(date);
    const outOfRange = date > asOf || date < habit.startDate;
    const status: DayStatus = outOfRange ? "future" : e?.status === "done" ? "done" : e?.status === "skip" ? "skip" : "none";
    cells.push({ day, date, status, heat: habitDayHeat(habit, map, date, asOf) });
  }
  return cells;
}

function isoWeekday(d: string): number {
  const date = new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return (date.getDay() + 6) % 7;
}

/* ---------- Progreso: ranking, mejores días, resumen semanal ---------- */

export interface HabitRank {
  habit: Habit;
  score: number;
}

/** Hábitos activos ordenados por puntaje de constancia, de mayor a menor. */
export function rankHabitsByConsistency(habits: Habit[], entries: HabitEntry[], asOf: string): HabitRank[] {
  return habits
    .filter((h) => !h.archivedAt && h.type !== "tracking")
    .map((habit) => ({ habit, score: consistencyScore(habit, entries, asOf) }))
    .sort((a, b) => b.score - a.score);
}

/** Promedio del puntaje de constancia de todos los hábitos activos a una fecha dada (para comparar "hoy" vs "hace 30 días"). "tracking" (ej. Peso) no tiene racha ni cumplimiento, no entra en el promedio. */
export function overallConsistency(habits: Habit[], entries: HabitEntry[], asOf: string): number | null {
  const active = habits.filter((h) => !h.archivedAt && h.type !== "tracking");
  if (active.length === 0) return null;
  const sum = active.reduce((acc, h) => acc + consistencyScore(h, entries, asOf), 0);
  return Math.round(sum / active.length);
}

export interface WeekdayStat {
  letter: string;
  pct: number;
}

/** % de cumplimiento promedio por día de la semana, sobre los últimos `windowDays` días (hábitos no semanales). */
export function bestWeekdays(habits: Habit[], entries: HabitEntry[], asOf: string, windowDays = 90): WeekdayStat[] {
  const active = habits.filter((h) => !h.archivedAt && h.frequency.kind !== "weekly" && h.type !== "tracking");
  const maps = new Map(active.map((h) => [h.id, entryMapFor(h.id, entries)]));
  const from = addDays(asOf, -(windowDays - 1));
  const buckets = DAY_LETTERS.map(() => ({ done: 0, elapsed: 0 }));
  for (const h of active) {
    const start = h.startDate > from ? h.startDate : from;
    for (let d = start; d <= asOf; d = addDays(d, 1)) {
      if (!isScheduledDate(h, d)) continue;
      const e = maps.get(h.id)!.get(d);
      if (d === asOf && !e) continue;
      if (e?.status === "skip") continue;
      const bucket = buckets[dayOfWeek(d)];
      bucket.elapsed++;
      if (e?.status === "done") bucket.done++;
    }
  }
  return DAY_LETTERS.map((letter, i) => ({
    letter,
    pct: buckets[i].elapsed === 0 ? 0 : Math.round((buckets[i].done / buckets[i].elapsed) * 100),
  }));
}

export interface WeekSummary {
  daysComplete: number;
  daysElapsed: number;
  habitsDone: number;
  habitsTotal: number;
  compliancePct: number | null;
  bestDayLetter: string | null;
  vsLastWeekPct: number | null;
}

function weekCompliance(habits: Habit[], entries: HabitEntry[], monday: string, asOf: string): { done: number; total: number; dayRatios: number[] } {
  const active = habits.filter((h) => !h.archivedAt && h.frequency.kind !== "weekly" && h.type !== "tracking");
  const maps = new Map(active.map((h) => [h.id, entryMapFor(h.id, entries)]));
  let done = 0;
  let total = 0;
  const dayRatios: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    if (d > asOf) {
      dayRatios.push(-1);
      continue;
    }
    const scheduled = active.filter((h) => h.startDate <= d && isScheduledDate(h, d));
    if (scheduled.length === 0) {
      dayRatios.push(-1);
      continue;
    }
    const dayDone = scheduled.filter((h) => maps.get(h.id)!.get(d)?.status === "done").length;
    done += dayDone;
    total += scheduled.length;
    dayRatios.push(dayDone / scheduled.length);
  }
  return { done, total, dayRatios };
}

/** Resumen de la semana en curso: días completos, hábitos hechos, % de cumplimiento, mejor día, y comparación vs. la semana pasada. */
export function buildWeekSummary(habits: Habit[], entries: HabitEntry[], asOf: string): WeekSummary {
  const monday = mondayOf(asOf);
  const { done, total, dayRatios } = weekCompliance(habits, entries, monday, asOf);
  const daysElapsed = dayRatios.filter((r) => r >= 0).length;
  const daysComplete = dayRatios.filter((r) => r === 1).length;
  let bestIdx = -1;
  let bestVal = -1;
  dayRatios.forEach((r, i) => {
    if (r > bestVal) {
      bestVal = r;
      bestIdx = i;
    }
  });

  const lastMonday = addDays(monday, -7);
  const lastSunday = addDays(monday, -1);
  const last = weekCompliance(habits, entries, lastMonday, lastSunday);

  const pctNow = total === 0 ? null : (done / total) * 100;
  const pctLast = last.total === 0 ? null : (last.done / last.total) * 100;

  return {
    daysComplete,
    daysElapsed,
    habitsDone: done,
    habitsTotal: total,
    compliancePct: pctNow,
    bestDayLetter: bestVal > 0 && bestIdx >= 0 ? DAY_LETTERS[bestIdx] : null,
    vsLastWeekPct: pctNow !== null && pctLast !== null ? Math.round(pctNow - pctLast) : null,
  };
}
