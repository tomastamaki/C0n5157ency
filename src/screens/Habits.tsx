import { useState } from "react";
import { HabitsTodayScreen } from "./HabitsToday";

type SubTab = "hoy" | "progreso" | "metricas";

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "progreso", label: "Progreso" },
  { id: "metricas", label: "Métricas" },
];

interface Props {
  onCreateHabit: () => void;
}

export function HabitsScreen({ onCreateHabit }: Props) {
  const [sub, setSub] = useState<SubTab>("hoy");

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-block border border-border bg-surface p-1">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSub(t.id)}
            className={`flex-1 rounded-[9px] py-2 text-sm font-semibold ${
              sub === t.id ? "bg-primary text-white" : "text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === "hoy" && <HabitsTodayScreen onCreateHabit={onCreateHabit} />}
      {sub === "progreso" && (
        <p className="pt-10 text-center text-sm text-faint">Progreso llega en una fase más adelante.</p>
      )}
      {sub === "metricas" && (
        <p className="pt-10 text-center text-sm text-faint">Métricas llega en una fase más adelante.</p>
      )}
    </div>
  );
}
