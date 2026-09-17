import type { ExerciseGroup, Program } from "../types/program";

export interface LiteralWorkingSet {
  reps: string;
  targetRIR: string;
}

/**
 * Cada entrada "working" del program.json puede representar más de una serie
 * literal: `targetRIR` trae un valor de RIR por cada serie real de esa
 * prescripción (ej. reps "4-6" con targetRIR ["1","2"] son 2 series). Esta
 * función aplana todo el ejercicio a la lista real de series que hay que
 * loguear, en orden.
 */
export function getLiteralWorkingSets(group: ExerciseGroup): LiteralWorkingSet[] {
  const literal: LiteralWorkingSet[] = [];
  for (const set of group.sets) {
    if (set.type !== "working") continue;
    if (set.targetRIR.length === 0) {
      literal.push({ reps: set.reps, targetRIR: "-" });
    } else {
      for (const rir of set.targetRIR) {
        literal.push({ reps: set.reps, targetRIR: rir });
      }
    }
  }
  return literal;
}

export interface ExerciseInfo {
  videoUrl: string | null;
  notes: string | null;
}

/**
 * Video/notas de técnica por nombre de ejercicio, buscando en todo el programa.
 * Sirve para mostrar el video correcto de un sustituto: si ese nombre aparece
 * en algún otro día como ejercicio prescripto, reusamos su video y notas.
 */
export function buildExerciseInfoIndex(program: Program): Record<string, ExerciseInfo> {
  const index: Record<string, ExerciseInfo> = {};
  for (const block of program.blocks) {
    for (const week of block.weeks) {
      for (const day of week.days) {
        for (const group of day.exerciseGroups) {
          if (!index[group.exercise] && (group.videoUrl || group.notes)) {
            index[group.exercise] = { videoUrl: group.videoUrl, notes: group.notes };
          }
        }
      }
    }
  }
  return index;
}
