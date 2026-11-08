export type HabitType = "yesno" | "quantity" | "time" | "avoid";
export type HabitCategory = "Salud" | "Entrenamiento" | "Mente" | "Productividad" | "Otros";
export type HabitTimeOfDay = "Mañana" | "Tarde" | "Noche" | "Todo el día";
export type HabitColor = "azul" | "naranja" | "verde" | "ambar" | "violeta" | "turquesa" | "rosa" | "pizarra";
export type HabitLinkedSource = "steps" | "water" | "sleep" | "workout";

/**
 * `days` usa 0=lunes..6=domingo (mismo criterio que el resto de la app, ver
 * `TrainingCalendar.tsx`: `(date.getDay() + 6) % 7`), para que coincida con
 * la tira semanal "L M X J V S D" y el mapa de calor (lunes arriba).
 */
export type HabitFrequency =
  | { kind: "daily" }
  | { kind: "weekly"; n: number }
  | { kind: "days"; days: number[] }
  | { kind: "every"; n: number };

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: HabitColor;
  type: HabitType;
  unit: string | null;
  goal: number;
  quickSteps: number[];
  frequency: HabitFrequency;
  category: HabitCategory;
  timeOfDay: HabitTimeOfDay;
  /** YYYY-MM-DD: no genera ocurrencias ni fallos antes de esta fecha. */
  startDate: string;
  why: string | null;
  /** ISO: si está seteado, el hábito está archivado. Se conserva todo su historial de entradas. */
  archivedAt: string | null;
  linked: { source: HabitLinkedSource } | null;
  createdAt: string;
  updatedAt: string;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  /** YYYY-MM-DD. La ausencia de entrada para una fecha significa "sin registro". */
  date: string;
  status: "done" | "skip";
  /** Solo para hábitos de cantidad/tiempo; null en sí/no y a evitar. */
  value: number | null;
  source: "auto" | "manual";
  updatedAt: string;
}

/** Un registro por día (id = date). Reemplaza a bodyWeightEntries/sleepEntries/stepsEntries/waterEntries como fuente de verdad hacia adelante. */
export interface Metric {
  id: string;
  date: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  /** Horas de sueño. Campo nuevo: el historial migrado desde SleepEntry no lo tiene (queda null). */
  sleepH: number | null;
  /** Puntaje de calidad de sueño 1-100 (el dato histórico, se conserva como secundario). */
  sleepScore: number | null;
  deepSleepMinutes: number | null;
  awakeMinutes: number | null;
  steps: number | null;
  waterMl: number | null;
  updatedAt: string;
}
