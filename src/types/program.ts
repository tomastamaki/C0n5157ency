export interface WarmupSet {
  type: "warmup";
  count: string;
}

export interface WorkingSet {
  type: "working";
  reps: string;
  targetRIR: string[];
}

export type SetPrescription = WarmupSet | WorkingSet;

export interface ExerciseGroup {
  exercise: string;
  videoUrl: string | null;
  supersetGroup: string | null;
  intensityTechnique: string | null;
  notes: string | null;
  substitutions: string[];
  rest: string | null;
  sets: SetPrescription[];
}

export interface ProgramDay {
  name: string;
  exerciseGroups: ExerciseGroup[];
}

export interface ProgramWeek {
  label: string;
  weekNumber: number;
  days: ProgramDay[];
}

export interface ProgramBlock {
  name: string;
  weeks: ProgramWeek[];
}

export interface Program {
  blocks: ProgramBlock[];
}

/** Un día del programa "aplanado" con su posición absoluta dentro de las 12 semanas. */
export interface FlatProgramDay {
  index: number;
  blockIndex: number;
  weekIndex: number;
  dayIndex: number;
  blockName: string;
  weekLabel: string;
  weekNumber: number;
  totalWeeks: number;
  day: ProgramDay;
}
