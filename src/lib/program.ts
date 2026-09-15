import type { ExerciseGroup } from "../types/program";

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
