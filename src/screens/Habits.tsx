import { useState } from "react";
import { useApp } from "../context/AppContext";
import { HabitsTodayScreen } from "./HabitsToday";
import { HabitsProgressScreen } from "./HabitsProgress";
import { HabitsMetricsScreen } from "./HabitsMetrics";
import { HabitDetailScreen } from "./HabitDetail";
import { CreateHabitScreen } from "./CreateHabit";
import { ArchivedHabitsScreen } from "./ArchivedHabits";
import { IconButton } from "../components/habits/IconButton";
import { IconArchive } from "../components/icons";

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
  const { logs } = useApp();
  const [sub, setSub] = useState<SubTab>("hoy");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  if (editingId) {
    const habit = logs.habits.find((h) => h.id === editingId);
    if (habit) {
      return <CreateHabitScreen editing={habit} onDone={() => setEditingId(null)} onCancel={() => setEditingId(null)} />;
    }
    setEditingId(null);
  }

  if (showArchived) {
    return <ArchivedHabitsScreen onBack={() => setShowArchived(false)} />;
  }

  if (detailId) {
    const habit = logs.habits.find((h) => h.id === detailId);
    if (habit) {
      return (
        <HabitDetailScreen
          habit={habit}
          onBack={() => setDetailId(null)}
          onEdit={() => setEditingId(habit.id)}
        />
      );
    }
    setDetailId(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex flex-1 gap-1 rounded-block border border-border bg-surface p-1">
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
        <IconButton aria-label="Archivados" onClick={() => setShowArchived(true)}>
          <IconArchive className="h-[18px] w-[18px]" />
        </IconButton>
      </div>

      {sub === "hoy" && <HabitsTodayScreen onCreateHabit={onCreateHabit} onOpenDetail={setDetailId} />}
      {sub === "progreso" && <HabitsProgressScreen onOpenDetail={setDetailId} />}
      {sub === "metricas" && <HabitsMetricsScreen />}
    </div>
  );
}
