import { useApp } from "../context/AppContext";
import { MiniTrendChart } from "../components/MiniTrendChart";
import { Pill } from "../components/habits/Pill";
import { IconDroplet, IconLink, IconMoon, IconScale, IconWalking } from "../components/icons";
import type { Habit, HabitLinkedSource, Metric } from "../types/habits";

function linkedHabitFor(habits: Habit[], source: HabitLinkedSource): Habit | null {
  return habits.find((h) => !h.archivedAt && h.linked?.source === source) ?? null;
}

function LinkedRow({ habit, onOpen }: { habit: Habit | null; onOpen?: (id: string) => void }) {
  if (!habit) return <span className="text-xs text-faint">Sin hábito vinculado</span>;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(habit.id)}
      className="flex items-center gap-2 rounded-block bg-surface2 px-3 py-2 text-xs text-muted"
    >
      <IconLink className="h-3.5 w-3.5 shrink-0" />
      Hábito vinculado: <b className="text-ink">{habit.name}</b>
    </button>
  );
}

function last7(metrics: Metric[], field: keyof Metric): { date: string; value: number }[] {
  return metrics
    .filter((m) => m[field] !== null)
    .slice(-7)
    .map((m) => ({ date: m.date, value: m[field] as number }));
}

function variationPct(points: { value: number }[]): number | null {
  if (points.length < 2) return null;
  const first = points[0].value;
  const last = points[points.length - 1].value;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

function MetricCard({
  icon,
  name,
  value,
  unit,
  pill,
  points,
  sparkColor,
  linked,
}: {
  icon: React.ReactNode;
  name: string;
  value: string;
  unit: string;
  pill: React.ReactNode;
  points: { date: string; value: number }[];
  sparkColor: string;
  linked: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <b className="flex items-center gap-2 text-sm text-ink">
          {icon}
          {name}
        </b>
        <Pill tone="neu">7 días</Pill>
      </div>
      <p className="mt-2 font-mono text-[28px] font-extrabold leading-none text-ink">
        {value}
        <small className="ml-1 text-sm font-semibold text-muted">{unit}</small>
      </p>
      <div className="mt-2">{pill}</div>
      <div className="mt-2.5">{points.length >= 2 && <MiniTrendChart points={points} colorClassName={sparkColor} />}</div>
      <div className="mt-2.5">{linked}</div>
    </div>
  );
}

interface Props {
  onOpenDetail: (habitId: string) => void;
}

export function HabitsMetricsScreen({ onOpenDetail }: Props) {
  const { logs, settings } = useApp();
  const metrics = logs.metrics;
  const habits = logs.habits;

  const weightPoints = last7(metrics, "weightKg");
  const sleepPoints = last7(metrics, "sleepH");
  const stepsPoints = last7(metrics, "steps");
  const waterPoints = last7(metrics, "waterMl");

  const weightVar = variationPct(weightPoints);
  const lastSteps = stepsPoints[stepsPoints.length - 1]?.value ?? null;
  const hasAnyCard = weightPoints.length > 0 || sleepPoints.length > 0 || lastSteps !== null || waterPoints.length > 0;

  if (!hasAnyCard) {
    return (
      <div className="flex flex-col items-center gap-2 pt-10 text-center">
        <p className="text-sm font-medium text-ink">Todavía no hay métricas con datos</p>
        <p className="max-w-xs text-xs text-muted">
          Cargá peso, sueño, pasos o agua desde Lifestyle, o creá un hábito de cantidad (como "Agua" o "Pasos") y
          empezá a registrar — acá vas a ver su valor, cambio y tendencia de 7 días.
        </p>
      </div>
    );
  }
  const lastWaterL = waterPoints[waterPoints.length - 1] ? waterPoints[waterPoints.length - 1].value / 1000 : null;

  return (
    <div className="space-y-3 pb-24">
      {weightPoints.length > 0 && (
        <MetricCard
          icon={<IconScale className="h-[18px] w-[18px]" />}
          name="Peso corporal"
          value={weightPoints[weightPoints.length - 1].value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
          unit="kg"
          sparkColor="text-muted"
          points={weightPoints}
          pill={
            weightVar !== null ? (
              <Pill tone="neu">
                {weightVar >= 0 ? "+" : ""}
                {weightVar.toFixed(1)}% en {weightPoints.length} días
              </Pill>
            ) : null
          }
          linked={<span className="text-xs text-faint">El peso corporal no se puede vincular a un hábito</span>}
        />
      )}

      {sleepPoints.length > 0 && (
        <MetricCard
          icon={<IconMoon className="h-[18px] w-[18px]" />}
          name="Horas de sueño"
          value={sleepPoints[sleepPoints.length - 1].value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
          unit="h"
          sparkColor="text-[#9a8cf8]"
          points={sleepPoints}
          pill={null}
          linked={<LinkedRow habit={linkedHabitFor(habits, "sleep")} onOpen={onOpenDetail} />}
        />
      )}

      {lastSteps !== null && (
        <MetricCard
          icon={<IconWalking className="h-[18px] w-[18px]" />}
          name="Pasos"
          value={lastSteps.toLocaleString("es-AR")}
          unit={`/ ${settings.dailyStepsTarget.toLocaleString("es-AR")}`}
          sparkColor="text-success"
          points={stepsPoints}
          pill={
            <Pill tone="pri">
              <IconWalking className="h-3 w-3" />
              {Math.round((lastSteps / settings.dailyStepsTarget) * 100)}% de la meta
            </Pill>
          }
          linked={<LinkedRow habit={linkedHabitFor(habits, "steps")} onOpen={onOpenDetail} />}
        />
      )}

      {lastWaterL !== null && (
        <MetricCard
          icon={<IconDroplet className="h-[18px] w-[18px]" />}
          name="Agua"
          value={lastWaterL.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
          unit={`/ ${settings.dailyWaterTargetLiters.toLocaleString("es-AR")} L`}
          sparkColor="text-primary"
          points={waterPoints}
          pill={
            <Pill tone="pri">
              <IconDroplet className="h-3 w-3" />
              {Math.round((lastWaterL / settings.dailyWaterTargetLiters) * 100)}% de la meta
            </Pill>
          }
          linked={<LinkedRow habit={linkedHabitFor(habits, "water")} onOpen={onOpenDetail} />}
        />
      )}
    </div>
  );
}
