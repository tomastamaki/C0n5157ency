import type { Habit, HabitEntry } from "../types/habits";
import { HABITS_CONFIG } from "./habitsConfig";

/* ---------- utilidades de fecha (texto local AAAA-MM-DD, sin UTC) ---------- */

function parseLocalDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(d: string, n: number): string {
  const date = parseLocalDate(d);
  date.setDate(date.getDate() + n);
  return formatLocalDate(date);
}

function diffDays(a: string, b: string): number {
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86400000);
}

/** 0=lunes..6=domingo (mismo criterio que `TrainingCalendar.tsx`). */
export function dayOfWeek(d: string): number {
  return (parseLocalDate(d).getDay() + 6) % 7;
}

export function mondayOf(d: string): string {
  return addDays(d, -dayOfWeek(d));
}

/* ---------- ocurrencias programadas ---------- */

export function isScheduledDate(habit: Habit, date: string): boolean {
  if (date < habit.startDate) return false;
  switch (habit.frequency.kind) {
    case "daily":
      return true;
    case "days":
      return habit.frequency.days.includes(dayOfWeek(date));
    case "every": {
      const n = Math.max(1, habit.frequency.n);
      return diffDays(habit.startDate, date) % n === 0;
    }
    case "weekly":
      // Las semanales no tienen ocurrencias por día: se evalúan por semana (ver computeWeeklyStreak).
      return false;
  }
}

/** Fechas programadas desde `habit.startDate` hasta `asOf` (inclusive), en orden. Vacío para hábitos semanales. */
function scheduledDatesUpTo(habit: Habit, asOf: string): string[] {
  if (habit.frequency.kind === "weekly" || habit.startDate > asOf) return [];
  const out: string[] = [];
  for (let d = habit.startDate; d <= asOf; d = addDays(d, 1)) {
    if (isScheduledDate(habit, d)) out.push(d);
  }
  return out;
}

export function entryMapFor(habitId: string, allEntries: HabitEntry[]): Map<string, HabitEntry> {
  const map = new Map<string, HabitEntry>();
  for (const e of allEntries) {
    if (e.habitId !== habitId) continue;
    const existing = map.get(e.date);
    if (!existing || e.updatedAt >= existing.updatedAt) map.set(e.date, e);
  }
  return map;
}

/* ---------- reductor genérico de racha: "no se falla dos veces seguidas" ---------- */

type Occ = "done" | "skip" | "miss";

export interface StreakResult {
  streak: number;
  best: number;
}

/**
 * La racha cuenta solo ocurrencias hechas. Un fallo aislado no suma ni resta
 * (se tolera); dos fallos consecutivos (sin un salteado en el medio) la
 * cortan a 0. Un salteado no cuenta como hecho ni como fallo, y además
 * interrumpe la secuencia de fallos (un fallo después de un salteado vuelve
 * a ser "el primero", tolerado).
 */
function reduceStreak(seq: Occ[]): StreakResult {
  let streak = 0;
  let best = 0;
  let lastWasMiss = false;
  for (const occ of seq) {
    if (occ === "skip") {
      lastWasMiss = false;
      continue;
    }
    if (occ === "done") {
      streak += 1;
      if (streak > best) best = streak;
      lastWasMiss = false;
    } else {
      if (lastWasMiss) streak = 0;
      lastWasMiss = true;
    }
  }
  return { streak, best };
}

/** Clasifica las ocurrencias programadas hasta `asOf`; la de hoy, si no tiene registro todavía, no se incluye (no es un fallo hasta que termina el día). */
function classifyOccurrences(dates: string[], entries: Map<string, HabitEntry>, asOf: string): Occ[] {
  const out: Occ[] = [];
  for (const d of dates) {
    const e = entries.get(d);
    if (d === asOf && !e) continue;
    if (e?.status === "done") out.push("done");
    else if (e?.status === "skip") out.push("skip");
    else out.push("miss");
  }
  return out;
}

/* ---------- semanales: la ocurrencia es la semana completa (lunes a domingo) ---------- */

function weeksUpTo(habit: Habit, asOf: string): string[] {
  if (habit.frequency.kind !== "weekly") return [];
  const out: string[] = [];
  const lastMonday = mondayOf(asOf);
  for (let w = mondayOf(habit.startDate); w <= lastMonday; w = addDays(w, 7)) out.push(w);
  return out;
}

function countDoneInWeek(monday: string, sunday: string, entries: Map<string, HabitEntry>): number {
  let count = 0;
  for (const [date, e] of entries) {
    if (date >= monday && date <= sunday && e.status === "done") count++;
  }
  return count;
}

function weeklyOccurrences(habit: Habit, allEntries: HabitEntry[], asOf: string): Occ[] {
  if (habit.frequency.kind !== "weekly") return [];
  const n = Math.max(1, habit.frequency.n);
  const entries = entryMapFor(habit.id, allEntries);
  const out: Occ[] = [];
  for (const monday of weeksUpTo(habit, asOf)) {
    const sunday = addDays(monday, 6);
    const done = countDoneInWeek(monday, sunday, entries);
    const isCurrentWeek = asOf >= monday && asOf <= sunday;
    if (isCurrentWeek) {
      // La semana en curso incompleta nunca es una semana fallada: solo entra en la secuencia si ya cumplió.
      if (done >= n) out.push("done");
      continue;
    }
    out.push(done >= n ? "done" : "miss");
  }
  return out;
}

/* ---------- API pública por hábito ---------- */

export function computeHabitStreak(habit: Habit, allEntries: HabitEntry[], asOf: string): StreakResult {
  if (habit.frequency.kind === "weekly") return reduceStreak(weeklyOccurrences(habit, allEntries, asOf));
  const dates = scheduledDatesUpTo(habit, asOf);
  const entries = entryMapFor(habit.id, allEntries);
  return reduceStreak(classifyOccurrences(dates, entries, asOf));
}

export interface RecoveryInfo {
  show: boolean;
  lastMissedDate: string | null;
  /** Racha que se sostiene si se completa la ocurrencia de hoy (la racha actual, antes de la acción de hoy). */
  streakIfRecovered: number;
}

/**
 * Tarjeta de recuperación: aparece solo si la última ocurrencia programada
 * YA VENCIDA (nunca la de hoy) quedó sin registro (ni hecho ni salteado). No
 * aplica a hábitos de meta semanal (no tienen una "ocurrencia del día" que
 * mostrar como perdida).
 */
export function computeRecovery(habit: Habit, allEntries: HabitEntry[], asOf: string): RecoveryInfo {
  if (habit.frequency.kind === "weekly") return { show: false, lastMissedDate: null, streakIfRecovered: 0 };
  const pastDates = scheduledDatesUpTo(habit, asOf).filter((d) => d < asOf);
  const last = pastDates[pastDates.length - 1];
  if (last === undefined) return { show: false, lastMissedDate: null, streakIfRecovered: 0 };
  const entries = entryMapFor(habit.id, allEntries);
  if (entries.has(last)) return { show: false, lastMissedDate: null, streakIfRecovered: 0 };
  const { streak } = computeHabitStreak(habit, allEntries, asOf);
  return { show: true, lastMissedDate: last, streakIfRecovered: streak };
}

export interface WeeklyProgress {
  done: number;
  n: number;
  weekStart: string;
  /** Quedan menos días (incluido hoy) que los que hacen falta para llegar a `n`: ya no alcanza con el ritmo actual. */
  atRisk: boolean;
}

/** Progreso de la semana en curso para un hábito de meta semanal, o null si no aplica. */
export function weeklyProgress(habit: Habit, allEntries: HabitEntry[], asOf: string): WeeklyProgress | null {
  if (habit.frequency.kind !== "weekly") return null;
  const entries = entryMapFor(habit.id, allEntries);
  const monday = mondayOf(asOf);
  const sunday = addDays(monday, 6);
  const done = countDoneInWeek(monday, sunday, entries);
  const n = habit.frequency.n;
  const daysLeft = 7 - dayOfWeek(asOf); // incluye hoy: hoy mismo todavía se puede actuar
  const stillNeeded = Math.max(0, n - done);
  return { done, n, weekStart: monday, atRisk: stillNeeded > daysLeft };
}

/**
 * % de cumplimiento en una ventana de `windowDays` días: hechos / ocurrencias
 * programadas ya vencidas, excluyendo salteados (ni suman ni restan). `null`
 * si no hubo ninguna ocurrencia vencida en la ventana (p. ej. hábito recién
 * creado).
 */
export function compliancePct(habit: Habit, allEntries: HabitEntry[], windowDays: number, asOf: string): number | null {
  if (habit.frequency.kind === "weekly") return complianceWeekly(habit, allEntries, windowDays, asOf);
  const from = addDays(asOf, -(windowDays - 1));
  const start = habit.startDate > from ? habit.startDate : from;
  if (start > asOf) return null;
  const dates = scheduledDatesUpTo(habit, asOf).filter((d) => d >= start);
  const entries = entryMapFor(habit.id, allEntries);
  let done = 0;
  let elapsed = 0;
  for (const d of dates) {
    const e = entries.get(d);
    if (d === asOf && !e) continue;
    if (e?.status === "skip") continue;
    elapsed += 1;
    if (e?.status === "done") done += 1;
  }
  return elapsed === 0 ? null : done / elapsed;
}

function complianceWeekly(habit: Habit, allEntries: HabitEntry[], windowDays: number, asOf: string): number | null {
  if (habit.frequency.kind !== "weekly") return null;
  const n = Math.max(1, habit.frequency.n);
  const entries = entryMapFor(habit.id, allEntries);
  const from = addDays(asOf, -(windowDays - 1));
  let met = 0;
  let elapsed = 0;
  for (const monday of weeksUpTo(habit, asOf)) {
    const sunday = addDays(monday, 6);
    if (sunday < from) continue;
    const done = countDoneInWeek(monday, sunday, entries);
    const isCurrentWeek = asOf >= monday && asOf <= sunday;
    if (isCurrentWeek) {
      if (done >= n) {
        met += 1;
        elapsed += 1;
      }
      continue;
    }
    elapsed += 1;
    if (done >= n) met += 1;
  }
  return elapsed === 0 ? null : met / elapsed;
}

/**
 * Puntaje de constancia estilo Loop Habit Tracker: `s = s·m + v·(1-m)`, con
 * `m = 0,5^(Δdías/vidaMedia)` entre ocurrencias sucesivas no salteadas (lo de
 * hace `vidaMedia` días pesa la mitad). La primera ocurrencia evaluada fija
 * `s` directamente en su propio valor (no hay historial previo del cual
 * decaer). Los salteados no actualizan `s`. Devuelve un entero 0-100.
 */
export function consistencyScore(habit: Habit, allEntries: HabitEntry[], asOf: string, config = HABITS_CONFIG): number {
  if (habit.frequency.kind === "weekly") return consistencyScoreWeekly(habit, allEntries, asOf, config);
  const dates = scheduledDatesUpTo(habit, asOf);
  const entries = entryMapFor(habit.id, allEntries);
  let s = 0;
  let prevDate: string | null = null;
  for (const d of dates) {
    const e = entries.get(d);
    if (d === asOf && !e) continue;
    if (e?.status === "skip") continue;
    const v = e?.status === "done" ? 1 : 0;
    if (prevDate === null) {
      s = v;
    } else {
      const m = Math.pow(0.5, diffDays(prevDate, d) / config.consistencyHalfLifeDays);
      s = s * m + v * (1 - m);
    }
    prevDate = d;
  }
  return Math.round(s * 100);
}

function consistencyScoreWeekly(habit: Habit, allEntries: HabitEntry[], asOf: string, config = HABITS_CONFIG): number {
  if (habit.frequency.kind !== "weekly") return 0;
  const n = Math.max(1, habit.frequency.n);
  const entries = entryMapFor(habit.id, allEntries);
  let s = 0;
  let prevWeek: string | null = null;
  for (const monday of weeksUpTo(habit, asOf)) {
    const sunday = addDays(monday, 6);
    const isCurrentWeek = asOf >= monday && asOf <= sunday;
    const done = countDoneInWeek(monday, sunday, entries);
    if (isCurrentWeek && done < n) continue; // semana en curso sin cumplir todavía: no se evalúa
    const v = done >= n ? 1 : 0;
    if (prevWeek === null) {
      s = v;
    } else {
      const m = Math.pow(0.5, diffDays(prevWeek, monday) / 7 / config.consistencyHalfLifeDays);
      s = s * m + v * (1 - m);
    }
    prevWeek = monday;
  }
  return Math.round(s * 100);
}

/** 7, 30 o 100 si `streakAfter` cruza justo ese hito respecto de `streakBefore`; null si no se cruzó ninguno. */
export function detectMilestone(
  streakBefore: number,
  streakAfter: number,
  config = HABITS_CONFIG
): (typeof HABITS_CONFIG.milestones)[number] | null {
  for (const milestone of config.milestones) {
    if (streakBefore < milestone && streakAfter >= milestone) return milestone;
  }
  return null;
}

/**
 * Si un hábito vinculado (se marca solo) puede auto-marcarse para esta
 * fecha: sí si no hay entrada todavía, o si la que hay es automática; no si
 * el usuario la desmarcó a mano (entrada manual) — no se le vuelve a pisar.
 */
export function canAutoMark(existingEntry: HabitEntry | undefined): boolean {
  return !existingEntry || existingEntry.source === "auto";
}

/* ---------- racha global (encabezado de Hoy) ---------- */

function groupEntriesByHabit(allEntries: HabitEntry[]): Map<string, Map<string, HabitEntry>> {
  const out = new Map<string, Map<string, HabitEntry>>();
  for (const e of allEntries) {
    if (!out.has(e.habitId)) out.set(e.habitId, new Map());
    const m = out.get(e.habitId)!;
    const existing = m.get(e.date);
    if (!existing || e.updatedAt >= existing.updatedAt) m.set(e.date, e);
  }
  return out;
}

/**
 * Racha global: días seguidos con al menos `globalStreakPct` de los hábitos
 * programados ese día cumplidos, exigiendo un mínimo de
 * `globalStreakMinHabits` programados para que el día cuente (si hay menos,
 * ese día no se evalúa). Misma tolerancia de "no dos seguidas" que una racha
 * de hábito. Solo considera hábitos no archivados y de frecuencia diaria/por
 * días/cada N días (las metas semanales no tienen un día programado puntual,
 * así que no entran en el denominador diario).
 */
export function computeGlobalStreak(habits: Habit[], allEntries: HabitEntry[], asOf: string, config = HABITS_CONFIG): StreakResult {
  const active = habits.filter((h) => !h.archivedAt && h.frequency.kind !== "weekly");
  if (active.length === 0) return { streak: 0, best: 0 };
  const entriesByHabit = groupEntriesByHabit(allEntries);
  const earliestStart = active.reduce((min, h) => (h.startDate < min ? h.startDate : min), asOf);

  const seq: Occ[] = [];
  for (let d = earliestStart; d <= asOf; d = addDays(d, 1)) {
    const scheduledToday = active.filter((h) => isScheduledDate(h, d));
    if (scheduledToday.length < config.globalStreakMinHabits) continue;
    const doneCount = scheduledToday.filter((h) => entriesByHabit.get(h.id)?.get(d)?.status === "done").length;
    const ratio = doneCount / scheduledToday.length;
    if (d === asOf) {
      if (ratio >= config.globalStreakPct) seq.push("done");
      continue; // si hoy todavía no llega, no se evalúa (no es un fallo hasta que termine el día)
    }
    seq.push(ratio >= config.globalStreakPct ? "done" : "miss");
  }
  return reduceStreak(seq);
}
