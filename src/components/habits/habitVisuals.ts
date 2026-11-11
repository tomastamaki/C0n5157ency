import type { ComponentType, SVGProps } from "react";
import type { HabitColor } from "../../types/habits";
import {
  IconArchive,
  IconBook,
  IconDroplet,
  IconDumbbell,
  IconHeart,
  IconMoon,
  IconPhoneOff,
  IconPill,
  IconStretch,
  IconWalking,
  IconWind,
  IconZap,
} from "../icons";

/** Los 8 colores de hábito son fijos y no cambian con el tema (ver habi7-diseno.html). */
export const HABIT_COLORS: Record<HabitColor, string> = {
  azul: "#3b82f6",
  naranja: "#ff7a45",
  verde: "#22c586",
  ambar: "#f0a83c",
  violeta: "#9a8cf8",
  turquesa: "#2dbfc9",
  rosa: "#f27aae",
  pizarra: "#8590a6",
};

export const HABIT_COLOR_ORDER: HabitColor[] = [
  "azul",
  "naranja",
  "verde",
  "ambar",
  "violeta",
  "turquesa",
  "rosa",
  "pizarra",
];

type HabitIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** Íconos disponibles para elegir al crear un hábito. */
export const HABIT_ICONS: Record<string, HabitIconComponent> = {
  drop: IconDroplet,
  walk: IconWalking,
  moon: IconMoon,
  dumbbell: IconDumbbell,
  book: IconBook,
  wind: IconWind,
  stretch: IconStretch,
  phoneoff: IconPhoneOff,
  pill: IconPill,
  heart: IconHeart,
  zap: IconZap,
  archive: IconArchive,
};

export const HABIT_ICON_ORDER = Object.keys(HABIT_ICONS);

export function habitIconFor(name: string): HabitIconComponent {
  return HABIT_ICONS[name] ?? IconDroplet;
}
