export type RIRValue = "0" | "1" | "2" | "3+";

export interface LoggedSet {
  /** Índice dentro de los "working sets" de ese ejercicio, en el orden del programa. */
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  rir: RIRValue | null;
  /** Confirmación explícita (botón ✓): la serie recién cuenta como registrada cuando esto es true. */
  confirmed: boolean;
}

export interface LoggedExercise {
  /** El ejercicio que realmente se hizo (puede ser un sustituto del prescripto). */
  exercise: string;
  /** El ejercicio prescripto originalmente por el programa, si se sustituyó por otro. */
  originalExercise: string | null;
  supersetGroup: string | null;
  sets: LoggedSet[];
}

export interface WorkoutSession {
  id: string;
  /**
   * Número de "vuelta" del programa a la que pertenece esta sesión (0 = la
   * primera). Reiniciar el programa desde Ajustes incrementa el ciclo actual
   * sin borrar las sesiones de ciclos anteriores, que quedan como referencia
   * en el historial pero dejan de contar para el progreso/racha actual.
   */
  cycle: number;
  /** Posición (0-based) en la secuencia aplanada de los 48 días del programa. */
  programIndex: number;
  blockName: string;
  weekLabel: string;
  weekNumber: number;
  dayName: string;
  status: "in_progress" | "completed" | "skipped";
  startedAt: string;
  completedAt: string | null;
  /** Duración total del entrenamiento en segundos, calculada al terminarlo. */
  durationSec: number | null;
  /** Marca desde la que corre el cronómetro; null si el entrenamiento está en pausa. */
  runningSince: string | null;
  /** Segundos acumulados hasta la última pausa (o hasta ahora, si no está corriendo). */
  pausedElapsedSec: number;
  /** Se actualiza en cada cambio; se usa para resolver conflictos al sincronizar. */
  updatedAt: string;
  exercises: LoggedExercise[];
  /** "¿Cómo te sentiste del 1 al 10?", preguntado en el resumen al terminar. Null hasta que se responde. */
  feeling: number | null;
}

/** Registro de peso corporal (pestaña Rendimiento). Independiente de las sesiones de entrenamiento. */
export interface BodyWeightEntry {
  id: string;
  /** Fecha del registro (YYYY-MM-DD), editable — no necesariamente "hoy". */
  date: string;
  weightKg: number;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Registro de calidad de sueño (pestaña Rendimiento). Asociado a la noche anterior a `date`. */
export interface SleepEntry {
  id: string;
  date: string;
  /** Score de sueño 1-100 (mismo concepto que la app Salud de Apple). */
  score: number;
  deepSleepHours: number | null;
  awakeMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LogsData {
  version: 1;
  sessions: WorkoutSession[];
  bodyWeightEntries: BodyWeightEntry[];
  sleepEntries: SleepEntry[];
}

export const EMPTY_LOGS: LogsData = { version: 1, sessions: [], bodyWeightEntries: [], sleepEntries: [] };

/** Peso, reps y RIR completos, sin importar si ya se confirmó con el botón ✓. */
export function isSetFilled(set: LoggedSet): boolean {
  return set.weightKg !== null && set.reps !== null && set.rir !== null;
}

/** Serie realmente "registrada": datos completos y confirmados con el botón ✓. */
export function isSetLogged(set: LoggedSet): boolean {
  return isSetFilled(set) && set.confirmed;
}

/** Representación numérica de RIR para promediar ("3+" se trata como 3.5). */
export function rirToNumber(rir: RIRValue): number {
  return rir === "3+" ? 3.5 : Number(rir);
}
