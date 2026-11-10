import { useApp } from "../context/AppContext";
import { MiniTrendChart } from "../components/MiniTrendChart";
import { Pill } from "../components/habits/Pill";
import { IconDroplet, IconMoon, IconScale, IconWalking } from "../components/icons";
import type { Metric } from "../types/habits";

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
}: {
  icon: React.ReactNode;
  name: string;
  value: string;
  unit: string;
  pill: React.ReactNode;
  points: { date: string; value: number }[];
  sparkColor: string;
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
    </div>
  );
}

export function HabitsMetricsScreen() {
  const { logs, settings } = useApp();
  const metrics = logs.metrics;

  if (metrics.length === 0) {
    return (
      <p className="pt-10 text-center text-sm text-faint">
        Todavía no hay métricas cargadas. Se completan desde Lifestyle por ahora.
      </p>
    );
  }

  const weightPoints = last7(metrics, "weightKg");
  const sleepPoints = last7(metrics, "sleepH");
  const stepsPoints = last7(metrics, "steps");
  const waterPoints = last7(metrics, "waterMl");

  const weightVar = variationPct(weightPoints);
  const lastSteps = stepsPoints[stepsPoints.length - 1]?.value ?? null;
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
            ) : (
              <span className="text-xs text-faint">Sin hábito vinculado</span>
            )
          }
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
          pill={<span className="text-xs text-faint">Sin hábito vinculado</span>}
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
        />
      )}
    </div>
  );
}
