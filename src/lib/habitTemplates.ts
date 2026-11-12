import type { Habit, HabitCategory, HabitColor, HabitFrequency, HabitLinkedSource, HabitTimeOfDay, HabitType } from "../types/habits";
import { localDateKey } from "./time";

export interface HabitTemplate {
  name: string;
  icon: string;
  color: HabitColor;
  type: HabitType;
  unit: string | null;
  goal: number | null;
  aggregation: "sum" | "last" | null;
  quickSteps: number[];
  frequency: HabitFrequency;
  category: HabitCategory;
  timeOfDay: HabitTimeOfDay;
  caption: string;
  linked?: HabitLinkedSource;
}

export const HABIT_TEMPLATES: HabitTemplate[] = [
  {
    name: "Entrenar",
    icon: "dumbbell",
    color: "naranja",
    type: "yesno",
    unit: null,
    goal: 1,
    aggregation: null,
    quickSteps: [],
    frequency: { kind: "weekly", n: 4 },
    category: "Entrenamiento",
    timeOfDay: "Mañana",
    caption: "4 veces por semana · Auto",
    linked: "workout",
  },
  {
    name: "Leer",
    icon: "book",
    color: "turquesa",
    type: "time",
    unit: "min",
    goal: 20,
    aggregation: null,
    quickSteps: [],
    frequency: { kind: "weekly", n: 4 },
    category: "Mente",
    timeOfDay: "Tarde",
    caption: "20 min",
  },
  {
    name: "Meditar",
    icon: "wind",
    color: "violeta",
    type: "yesno",
    unit: null,
    goal: 1,
    aggregation: null,
    quickSteps: [],
    frequency: { kind: "daily" },
    category: "Mente",
    timeOfDay: "Mañana",
    caption: "10 min",
  },
  {
    name: "Estirar",
    icon: "stretch",
    color: "rosa",
    type: "yesno",
    unit: null,
    goal: 1,
    aggregation: null,
    quickSteps: [],
    frequency: { kind: "daily" },
    category: "Entrenamiento",
    timeOfDay: "Tarde",
    caption: "5 min",
  },
  {
    name: "% de grasa corporal",
    icon: "scale",
    color: "pizarra",
    type: "tracking",
    unit: "%",
    goal: null,
    aggregation: "last",
    quickSteps: [],
    frequency: { kind: "daily" },
    category: "Métricas",
    timeOfDay: "Todo el día",
    caption: "Seguimiento, sin racha",
  },
  {
    name: "Masa muscular",
    icon: "scale",
    color: "pizarra",
    type: "tracking",
    unit: "kg",
    goal: null,
    aggregation: "last",
    quickSteps: [],
    frequency: { kind: "daily" },
    category: "Métricas",
    timeOfDay: "Todo el día",
    caption: "Seguimiento, sin racha",
  },
];

export const HABIT_CATEGORIES: HabitCategory[] = ["Salud", "Entrenamiento", "Mente", "Productividad", "Métricas", "Otros"];
export const HABIT_TIMES_OF_DAY: HabitTimeOfDay[] = ["Mañana", "Tarde", "Noche", "Todo el día"];
export const HABIT_TYPE_LABELS: Record<HabitType, string> = {
  yesno: "Sí / No",
  quantity: "Cantidad",
  time: "Tiempo",
  avoid: "A evitar",
  tracking: "Seguimiento",
};

export function emptyDraft(): Omit<Habit, "id" | "createdAt" | "updatedAt" | "archivedAt"> {
  const t = HABIT_TEMPLATES[0];
  return {
    name: t.name,
    icon: t.icon,
    color: t.color,
    type: t.type,
    unit: t.unit,
    goal: t.goal,
    aggregation: t.aggregation,
    quickSteps: t.quickSteps,
    frequency: t.frequency,
    category: t.category,
    timeOfDay: t.timeOfDay,
    startDate: localDateKey(new Date()),
    why: null,
    linked: null,
    metricKind: null,
    secondaryField: null,
  };
}
