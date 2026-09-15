export const DEFAULT_INCREMENT_KG = 2.5;

// Aislamiento con mancuernas/cables/máquina chica: los saltos de peso son finos.
const SMALL_ISOLATION_KEYWORDS = [
  "curl",
  "triceps",
  "tríceps",
  "lateral",
  "kickback",
  "flye",
  "fly",
  "extension",
  "extensión",
  "raise",
  "elevación",
  "y-raise",
  "calf",
  "pec deck",
  "crunch",
];

// Compuestos grandes con barra/máquina de placas: los saltos de peso son más grandes.
const BIG_COMPOUND_KEYWORDS = [
  "squat",
  "sentadilla",
  "deadlift",
  "peso muerto",
  "press",
  "row",
  "remo",
  "pulldown",
  "pull-up",
  "chin-up",
  "hack squat",
  "rdl",
  "bench",
  "t-bar",
];

function matchesAny(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

/**
 * Incremento de peso "de fábrica" según el nombre del ejercicio. Es solo un
 * punto de partida: el usuario puede ajustarlo por ejercicio en Ajustes, y
 * ese ajuste manual siempre tiene prioridad sobre esta inferencia.
 */
export function guessIncrementKg(exerciseName: string): number {
  if (matchesAny(exerciseName, BIG_COMPOUND_KEYWORDS)) return 5;
  if (matchesAny(exerciseName, SMALL_ISOLATION_KEYWORDS)) return 2.5;
  return DEFAULT_INCREMENT_KG;
}

export function getIncrementKg(
  overrides: Record<string, number>,
  exerciseName: string
): number {
  return overrides[exerciseName] ?? guessIncrementKg(exerciseName);
}
