/**
 * Catálogo único de técnicas de intensidad (columna D del Excel del
 * programa, `ExerciseGroup.intensityTechnique`) y sus constantes editables.
 * Cada técnica se identifica por `kind` y se reconoce en el texto libre del
 * programa buscando `match` (minúsculas, sin acentos) — ver
 * `lib/techniques.ts`. Agregar una técnica nueva es agregar una entrada acá.
 */

export type TechniqueKind = "drop-sets" | "partials" | "myo-reps" | "static-hold";

export interface TechniqueCatalogEntry {
  kind: TechniqueKind;
  /** Substring (en minúsculas) a buscar en `group.intensityTechnique` para reconocer esta técnica. */
  match: string;
  label: string;
  description: string;
}

export const TECHNIQUE_CATALOG: TechniqueCatalogEntry[] = [
  {
    kind: "drop-sets",
    match: "drop set",
    label: "Drop Sets",
    description:
      "Al fallar la serie principal, bajá el peso y seguí sin descanso. Dos bajadas sugeridas a partir del peso de la serie principal.",
  },
  {
    kind: "partials",
    match: "partial",
    label: "Lengthened Partials",
    description:
      "Al fallar la serie principal, seguí haciendo repeticiones parciales en la posición de mayor estiramiento del músculo.",
  },
  {
    kind: "myo-reps",
    match: "myo-rep",
    label: "Myo-Reps",
    description:
      "Al fallar la serie principal, descansá unos segundos y agregá mini-series cortas, hasta que una te dé menos de 2 reps.",
  },
  {
    kind: "static-hold",
    match: "static hold",
    label: "Weighted Static Hold",
    description: "Al fallar la serie principal, sostené el peso en la posición de mayor contracción el mayor tiempo posible.",
  },
];

export const TECHNIQUE_CONFIG = {
  dropSets: {
    /** % del peso de la serie principal para cada bajada, en orden. */
    weightPcts: [0.75, 0.56],
  },
  myoReps: {
    restSeconds: 5,
    /** Una mini-serie con menos reps que esto se considera la última (el músculo ya no da más). */
    stopBelowReps: 2,
  },
  staticHold: {
    seconds: 30,
  },
};
