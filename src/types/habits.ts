export type HabitType = "yesno" | "quantity" | "time" | "avoid" | "tracking";
export type HabitCategory = "Salud" | "Entrenamiento" | "Mente" | "Productividad" | "Métricas" | "Otros";
export type HabitTimeOfDay = "Mañana" | "Tarde" | "Noche" | "Todo el día";
export type HabitColor = "azul" | "naranja" | "verde" | "ambar" | "violeta" | "turquesa" | "rosa" | "pizarra";
/** "workout" es la única fuente de vinculación manual que queda (Entrenar); pasos/agua/sueño pasaron a ser hábitos nativos (ver `Habit.metricKind`), no algo a lo que otro hábito se "vincula". */
export type HabitLinkedSource = "workout";
/** Qué métrica nativa representa este hábito (los 4 de la categoría "Métricas", HABI7 v2 Fase 6): única fuente de verdad, estable aunque se renombre o archive el hábito. `null` en cualquier otro hábito. */
export type HabitMetricKind = "weight" | "sleep" | "steps" | "water";

/**
 * Campo numérico secundario y opcional de un hábito (ej. "Calidad" de sueño,
 * 0-100, junto a las horas). Genérico en el modelo pero usado solo por el
 * hábito nativo "Sueño" por ahora (HABI7 v2 Fase 6).
 */
export interface HabitSecondaryField {
  key: string;
  label: string;
  unit: string | null;
  min: number;
  max: number;
  quickValues: number[];
  defaultValue: number | null;
}

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
  /** null = sin objetivo (habitual en "tracking"; un objetivo opcional sigue siendo válido ahí, ej. meta de peso). */
  goal: number | null;
  quickSteps: number[];
  /**
   * Cómo se combinan los registros (`HabitLog`) de un mismo día en el valor
   * del día para hábitos de cantidad/tracking: "sum" = se suman (agua),
   * "last" = vale el más reciente (peso, sueño, pasos). `null` para
   * sí/no, tiempo y a evitar, que no tienen `HabitLog`.
   */
  aggregation: "sum" | "last" | null;
  frequency: HabitFrequency;
  category: HabitCategory;
  timeOfDay: HabitTimeOfDay;
  /** YYYY-MM-DD: no genera ocurrencias ni fallos antes de esta fecha. */
  startDate: string;
  why: string | null;
  /** ISO: si está seteado, el hábito está archivado. Se conserva todo su historial de entradas. */
  archivedAt: string | null;
  linked: { source: HabitLinkedSource } | null;
  /** Marca los 4 hábitos nativos de "Métricas" (Peso/Sueño/Pasos/Agua). `null` en cualquier otro hábito. */
  metricKind: HabitMetricKind | null;
  /** Campo numérico secundario opcional (ej. calidad de sueño). `null` salvo en el hábito nativo "Sueño". */
  secondaryField: HabitSecondaryField | null;
  createdAt: string;
  updatedAt: string;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  /** YYYY-MM-DD. La ausencia de entrada para una fecha significa "sin registro". */
  date: string;
  /**
   * "partial" es cantidad/tiempo cargado hoy pero todavía por debajo de la
   * meta: existe para no perder el progreso parcial al recargar, pero para
   * el motor de rachas (`habitStreaks.ts`) cuenta igual que "sin registro"
   * (no es ni hecho ni salteado) hasta que llegue a "done".
   */
  status: "done" | "skip" | "partial";
  /** Solo para hábitos de cantidad/tiempo; null en sí/no y a evitar. */
  value: number | null;
  source: "auto" | "manual";
  updatedAt: string;
}

/**
 * Un registro individual de un hábito de cantidad/tracking (ej. "+250 ml" o
 * una carga de peso), con hora propia. Puede haber varios por día: el valor
 * del día se recalcula a partir de todos los `HabitLog` de esa fecha según
 * `Habit.aggregation` ("sum" o "last"), y ESE agregado es el que termina en
 * el `HabitEntry` del día (que no cambia de forma). Editable y borrable
 * individualmente, a diferencia del `HabitEntry`.
 */
export interface HabitLog {
  id: string;
  habitId: string;
  /** YYYY-MM-DD local. */
  date: string;
  /** `null` si este registro solo cargó el valor secundario (ver `secondaryValue`) — ej. una noche con calidad pero sin horas. */
  value: number | null;
  /** Valor del campo secundario del hábito (ver `Habit.secondaryField`), si este registro lo cargó. `null` en cualquier hábito sin campo secundario. */
  secondaryValue: number | null;
  source: "auto" | "manual";
  createdAt: string;
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
