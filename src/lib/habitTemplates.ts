import type { Habit, HabitCategory, HabitColor, HabitFrequency, HabitTimeOfDay, HabitType } from "../types/habits";
import { localDateKey } from "./time";

export interface HabitTemplate {
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
  caption: string;
}

export const HABIT_TEMPLATES: HabitTemplate[] = [
  {
    name: "Tomar agua",
    icon: "drop",
    color: "azul",
    type: "quantity",
    unit: "ml",
    goal: 2500,
    quickSteps: [250, 500],
    frequency: { kind: "daily" },
    category: "Salud",
    timeOfDay: "Todo el día",
    caption: "2,5 L",
  },
  {
    name: "Dormir",
    icon: "moon",
    color: "violeta",
    type: "time",
    unit: "min",
    goal: 420,
    quickSteps: [],
    frequency: { kind: "daily" },
    category: "Salud",
    timeOfDay: "Noche",
    caption: "7 h",
  },
  {
    name: "Entrenar",
    icon: "dumbbell",
    color: "naranja",
    type: "yesno",
    unit: null,
    goal: 1,
    quickSteps: [],
    frequency: { kind: "weekly", n: 4 },
    category: "Entrenamiento",
    timeOfDay: "Mañana",
    caption: "4 veces por semana",
  },
  {
    name: "Leer",
    icon: "book",
    color: "turquesa",
    type: "time",
    unit: "min",
    goal: 20,
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
    quickSteps: [],
    frequency: { kind: "daily" },
    category: "Entrenamiento",
    timeOfDay: "Tarde",
    caption: "5 min",
  },
];

export const HABIT_CATEGORIES: HabitCategory[] = ["Salud", "Entrenamiento", "Mente", "Productividad", "Otros"];
export const HABIT_TIMES_OF_DAY: HabitTimeOfDay[] = ["Mañana", "Tarde", "Noche", "Todo el día"];
export const HABIT_TYPE_LABELS: Record<HabitType, string> = {
  yesno: "Sí / No",
  quantity: "Cantidad",
  time: "Tiempo",
  avoid: "A evitar",
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
    quickSteps: t.quickSteps,
    frequency: t.frequency,
    category: t.category,
    timeOfDay: t.timeOfDay,
    startDate: localDateKey(new Date()),
    why: null,
    linked: null,
  };
}
