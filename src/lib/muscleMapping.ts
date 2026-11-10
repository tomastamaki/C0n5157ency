import type { Program } from "../types/program";

export const MUSCLE_GROUPS = [
  "Pecho",
  "Espalda",
  "Hombros",
  "Bíceps",
  "Tríceps",
  "Cuádriceps",
  "Isquiotibiales",
  "Glúteos",
  "Gemelos",
  "Abdomen",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Bucket para un ejercicio sin mapeo (y sin ejercicio original del que heredar uno). No rompe nada, solo no se puede agrupar por músculo. */
export const OTHER_MUSCLE_GROUP = "Otros";

/** Peso de cada serie para un músculo secundario, relativo a 1 para el primario. Único lugar donde ajustarlo. */
export const SECONDARY_MUSCLE_WEIGHT = 0.5;

export interface ExerciseMuscles {
  primary: MuscleGroup;
  secondary: MuscleGroup[];
}

/**
 * Mapeo único ejercicio -> músculos (primario + secundarios). Única fuente
 * de verdad: la usan el resumen semanal, el algoritmo de
 * recuperación y los chips de músculo de la card del día. Un ejercicio
 * nuevo que no esté acá cae en "Otros" (ver `getExerciseMuscles`); Ajustes
 * avisa cuáles faltan completar.
 */
export const EXERCISE_MUSCLES: Record<string, ExerciseMuscles> = {
  "Machine Chest Press": { primary: "Pecho", secondary: ["Tríceps", "Hombros"] },
  "Machine Lat Pullover": { primary: "Espalda", secondary: ["Tríceps"] },
  "Pec Deck": { primary: "Pecho", secondary: [] },
  "Chest-Supported T-Bar Row": { primary: "Espalda", secondary: ["Bíceps", "Hombros"] },
  "Incline DB Y-Raise": { primary: "Hombros", secondary: ["Espalda"] },
  "EZ-Bar Cheat Curl": { primary: "Bíceps", secondary: [] },
  "EZ-Bar Skull Crusher": { primary: "Tríceps", secondary: [] },
  "Seated Leg Curl": { primary: "Isquiotibiales", secondary: [] },
  "Hack Squat": { primary: "Cuádriceps", secondary: ["Glúteos"] },
  "Leg Extension": { primary: "Cuádriceps", secondary: [] },
  "DB Walking Lunge": { primary: "Cuádriceps", secondary: ["Glúteos"] },
  "Standing Calf Raise": { primary: "Gemelos", secondary: [] },
  "Glute Kickback": { primary: "Glúteos", secondary: [] },
  "Machine Shoulder Press": { primary: "Hombros", secondary: ["Tríceps", "Pecho"] },
  "DB Bench Press": { primary: "Pecho", secondary: ["Tríceps", "Hombros"] },
  "Single-Leg Leg Extension": { primary: "Cuádriceps", secondary: [] },
  "Machine Lateral Raise": { primary: "Hombros", secondary: [] },
  "Cable Flye": { primary: "Pecho", secondary: [] },
  "Triceps Pressdown": { primary: "Tríceps", secondary: [] },
  "Pull-Up (Wide Grip)": { primary: "Espalda", secondary: ["Bíceps"] },
  "Stiff-Leg Deadlift": { primary: "Isquiotibiales", secondary: ["Glúteos", "Espalda"] },
  "Close-Grip Lat Pulldown": { primary: "Espalda", secondary: ["Bíceps"] },
  "Chest-Supported Machine Row": { primary: "Espalda", secondary: ["Bíceps", "Hombros"] },
  "1-Arm Reverse Pec Deck": { primary: "Hombros", secondary: [] },
  "Preacher Hammer Curl": { primary: "Bíceps", secondary: [] },
  "Cable Crunch": { primary: "Abdomen", secondary: [] },
};

/**
 * Mapeo de un ejercicio efectivamente hecho: si no tiene uno propio, hereda
 * el del ejercicio original que sustituye (salvo que el sustituto ya tenga
 * uno propio, que siempre gana). Null ("Otros") si ninguno de los dos está mapeado.
 */
export function getExerciseMuscles(exercise: string, originalExercise: string | null): ExerciseMuscles | null {
  if (EXERCISE_MUSCLES[exercise]) return EXERCISE_MUSCLES[exercise];
  if (originalExercise && EXERCISE_MUSCLES[originalExercise]) return EXERCISE_MUSCLES[originalExercise];
  return null;
}

export interface MuscleContribution {
  muscle: MuscleGroup | typeof OTHER_MUSCLE_GROUP;
  weight: number;
}

/** Cuánto aporta una serie de este ejercicio a cada músculo: 1 al primario, SECONDARY_MUSCLE_WEIGHT a cada secundario. */
export function getMuscleContributions(exercise: string, originalExercise: string | null): MuscleContribution[] {
  const mapping = getExerciseMuscles(exercise, originalExercise);
  if (!mapping) return [{ muscle: OTHER_MUSCLE_GROUP, weight: 1 }];
  return [
    { muscle: mapping.primary, weight: 1 },
    ...mapping.secondary.map((m) => ({ muscle: m, weight: SECONDARY_MUSCLE_WEIGHT })),
  ];
}

/** Nombres de ejercicio del programa (prescriptos y sus sustituciones) sin mapeo propio ni heredable, para avisar en Ajustes. */
export function getUnmappedExerciseNames(program: Program): string[] {
  const unmapped = new Set<string>();
  for (const block of program.blocks) {
    for (const week of block.weeks) {
      for (const day of week.days) {
        for (const group of day.exerciseGroups) {
          if (!EXERCISE_MUSCLES[group.exercise]) unmapped.add(group.exercise);
          for (const sub of group.substitutions) {
            if (!EXERCISE_MUSCLES[sub.name] && !EXERCISE_MUSCLES[group.exercise]) unmapped.add(sub.name);
          }
        }
      }
    }
  }
  return [...unmapped].sort((a, b) => a.localeCompare(b, "es"));
}
