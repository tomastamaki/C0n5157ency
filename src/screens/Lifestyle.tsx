import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { TrendChart } from "../components/TrendChart";
import { NumericInput } from "../components/NumericInput";
import { WaterBottle } from "../components/WaterBottle";
import {
  IconActivity,
  IconChevronLeft,
  IconDroplet,
  IconFootprint,
  IconMoon,
  IconScale,
  IconTrash,
} from "../components/icons";
import { EmptyState } from "../components/EmptyState";
import { newId } from "../lib/id";
import { formatDateOnly } from "../lib/time";
import { getMetricPreviews, type LifestyleMetricKey } from "../lib/lifestyleKpis";
import type { BodyWeightEntry, SleepEntry, StepsEntry, WaterEntry } from "../types/logs";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** Diferencia en días de calendario entre dos claves "YYYY-MM-DD" (ambas se parsean igual, así que el offset de timezone no afecta la resta). */
function daysBetween(dateKey: string, refKey: string): number {
  return (new Date(refKey).getTime() - new Date(dateKey).getTime()) / (24 * 60 * 60 * 1000);
}

function averageWithinDays<T>(
  entries: T[],
  dateOf: (e: T) => string,
  valueOf: (e: T) => number | null,
  days: number,
  refKey: string
): number | null {
  const values = entries
    .filter((e) => {
      const diff = daysBetween(dateOf(e), refKey);
      return diff >= 0 && diff < days;
    })
    .map(valueOf)
    .filter((v): v is number => v !== null);
  return average(values);
}

/** Fila de resumen: promedio de los últimos 7 y 30 días de una métrica. */
function AverageRow<T>({
  label,
  unit,
  decimals = 1,
  entries,
  dateOf,
  valueOf,
  refKey,
}: {
  label: string;
  unit: string;
  decimals?: number;
  entries: T[];
  dateOf: (e: T) => string;
  valueOf: (e: T) => number | null;
  refKey: string;
}) {
  const avg7 = averageWithinDays(entries, dateOf, valueOf, 7, refKey);
  const avg30 = averageWithinDays(entries, dateOf, valueOf, 30, refKey);
  if (avg7 === null && avg30 === null) return null;

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-ink">
        {avg7 !== null ? `${avg7.toFixed(decimals)}${unit}` : "—"} <span className="text-faint">7d</span>
        {"  ·  "}
        {avg30 !== null ? `${avg30.toFixed(decimals)}${unit}` : "—"} <span className="text-faint">30d</span>
      </span>
    </div>
  );
}

/** Suma los valores que comparten fecha, para graficar un total diario en vez de cada registro suelto. */
function sumByDate<T>(entries: T[], dateOf: (e: T) => string, valueOf: (e: T) => number): { date: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const e of entries) {
    const date = dateOf(e);
    totals.set(date, (totals.get(date) ?? 0) + valueOf(e));
  }
  return Array.from(totals.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function DailyTarget({
  label,
  unit,
  value,
  decimals = 0,
  onSave,
}: {
  label: string;
  unit: string;
  value: number;
  decimals?: number;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState<number | null>(value);
  return (
    <div className="flex items-center justify-between gap-2 rounded-block border border-border bg-surface2 px-3 py-2">
      <span className="text-xs text-faint">{label}</span>
      <div className="flex items-center gap-2">
        <NumericInput
          value={draft}
          onChange={setDraft}
          allowDecimal={decimals > 0}
          className="h-8 w-20 rounded-pill border border-border bg-surface px-2 text-right font-mono text-sm text-ink"
        />
        <span className="text-xs text-faint">{unit}</span>
        <button
          type="button"
          onClick={() => draft !== null && onSave(draft)}
          disabled={draft === null || draft === value}
          className="rounded-pill bg-primary px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function BodyWeightForm() {
  const { logs, upsertBodyWeightEntry, removeBodyWeightEntry } = useApp();
  const [date, setDate] = useState(todayKey());
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [bodyFatPct, setBodyFatPct] = useState<number | null>(null);
  const [muscleMassKg, setMuscleMassKg] = useState<number | null>(null);

  const listDesc = [...logs.bodyWeightEntries].sort((a, b) => b.date.localeCompare(a.date));

  function save() {
    if (weightKg === null) return;
    const now = new Date().toISOString();
    upsertBodyWeightEntry({ id: newId(), date, weightKg, bodyFatPct, muscleMassKg, createdAt: now, updatedAt: now });
    setWeightKg(null);
    setBodyFatPct(null);
    setMuscleMassKg(null);
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
      <div className="space-y-2">
        <label className="block">
          <span className="mb-1 block text-xs text-faint">Fecha</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-pill border border-border bg-surface2 px-3 py-2 text-sm text-ink"
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-faint">Peso (kg)</span>
            <NumericInput
              value={weightKg}
              onChange={setWeightKg}
              allowDecimal
              className="h-10 w-full rounded-pill border border-border bg-surface2 px-2 font-mono text-sm text-ink"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-faint">% grasa</span>
            <NumericInput
              value={bodyFatPct}
              onChange={setBodyFatPct}
              allowDecimal
              className="h-10 w-full rounded-pill border border-border bg-surface2 px-2 font-mono text-sm text-ink"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-faint">Músculo (kg)</span>
            <NumericInput
              value={muscleMassKg}
              onChange={setMuscleMassKg}
              allowDecimal
              className="h-10 w-full rounded-pill border border-border bg-surface2 px-2 font-mono text-sm text-ink"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={weightKg === null}
          className="w-full rounded-pill bg-primary py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Guardar registro
        </button>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        {listDesc.length > 0 ? (
          <div className="space-y-1.5">
            {listDesc.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span className="font-mono text-muted">
                  {formatDateOnly(e.date)} · {e.weightKg}kg
                  {e.bodyFatPct !== null && ` · ${e.bodyFatPct}%`}
                  {e.muscleMassKg !== null && ` · ${e.muscleMassKg}kg músc.`}
                </span>
                <button
                  type="button"
                  onClick={() => removeBodyWeightEntry(e.id)}
                  aria-label="Eliminar registro"
                  className="rounded-pill p-1 text-faint hover:bg-surface2"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<IconActivity className="h-8 w-8" />}
            title="Todavía no cargaste tu peso"
            hint="Los registros que agregues van a aparecer acá, y vas a poder verlos en tendencias."
          />
        )}
      </div>
    </section>
  );
}

function SleepForm() {
  const { logs, upsertSleepEntry, removeSleepEntry } = useApp();
  const [date, setDate] = useState(todayKey());
  const [score, setScore] = useState<number | null>(null);
  const [deepSleepMinutes, setDeepSleepMinutes] = useState<number | null>(null);
  const [awakeMinutes, setAwakeMinutes] = useState<number | null>(null);

  const listDesc = [...logs.sleepEntries].sort((a, b) => b.date.localeCompare(a.date));

  function save() {
    if (score === null) return;
    const now = new Date().toISOString();
    upsertSleepEntry({ id: newId(), date, score, deepSleepMinutes, awakeMinutes, createdAt: now, updatedAt: now });
    setScore(null);
    setDeepSleepMinutes(null);
    setAwakeMinutes(null);
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
      <div className="space-y-2">
        <label className="block">
          <span className="mb-1 block text-xs text-faint">Fecha (la noche anterior a este día)</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-pill border border-border bg-surface2 px-3 py-2 text-sm text-ink"
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-faint">Score (1-100)</span>
            <NumericInput
              value={score}
              onChange={setScore}
              allowDecimal={false}
              className="h-10 w-full rounded-pill border border-border bg-surface2 px-2 font-mono text-sm text-ink"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-faint">Profundo (min)</span>
            <NumericInput
              value={deepSleepMinutes}
              onChange={setDeepSleepMinutes}
              allowDecimal={false}
              className="h-10 w-full rounded-pill border border-border bg-surface2 px-2 font-mono text-sm text-ink"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-faint">Despierto (min)</span>
            <NumericInput
              value={awakeMinutes}
              onChange={setAwakeMinutes}
              allowDecimal={false}
              className="h-10 w-full rounded-pill border border-border bg-surface2 px-2 font-mono text-sm text-ink"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={score === null}
          className="w-full rounded-pill bg-primary py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Guardar registro
        </button>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        {listDesc.length > 0 ? (
          <div className="space-y-1.5">
            {listDesc.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span className="font-mono text-muted">
                  {formatDateOnly(e.date)} · {e.score}/100
                  {e.deepSleepMinutes !== null && ` · ${e.deepSleepMinutes}min profundo`}
                  {e.awakeMinutes !== null && ` · ${e.awakeMinutes}min despierto`}
                </span>
                <button
                  type="button"
                  onClick={() => removeSleepEntry(e.id)}
                  aria-label="Eliminar registro"
                  className="rounded-pill p-1 text-faint hover:bg-surface2"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<IconActivity className="h-8 w-8" />}
            title="Todavía no cargaste tu sueño"
            hint="Los registros que agregues van a aparecer acá, y vas a poder verlos en tendencias."
          />
        )}
      </div>
    </section>
  );
}

function StepsForm() {
  const { logs, settings, updateSettings, upsertStepsEntry, removeStepsEntry } = useApp();
  const [date, setDate] = useState(todayKey());
  const [steps, setSteps] = useState<number | null>(null);

  const listDesc = [...logs.stepsEntries].sort((a, b) => b.date.localeCompare(a.date));
  const today = todayKey();
  const todaySteps = logs.stepsEntries.filter((e) => e.date === today).reduce((sum, e) => sum + e.steps, 0);
  const target = settings.dailyStepsTarget;
  const pct = target > 0 ? Math.min(100, (todaySteps / target) * 100) : 0;

  function save() {
    if (steps === null) return;
    const now = new Date().toISOString();
    upsertStepsEntry({ id: newId(), date, steps, createdAt: now, updatedAt: now });
    setSteps(null);
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-muted">Hoy</span>
          <span className="font-mono font-semibold text-ink">
            {todaySteps.toLocaleString("es-AR")} / {target.toLocaleString("es-AR")} pasos
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-pill bg-surface2">
          <div className="h-full rounded-pill bg-primary transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <DailyTarget
        label="Meta diaria de pasos"
        unit="pasos"
        value={target}
        onSave={(value) => updateSettings({ dailyStepsTarget: Math.round(value) })}
      />

      <div className="mt-3 space-y-2">
        <label className="block">
          <span className="mb-1 block text-xs text-faint">Fecha</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-pill border border-border bg-surface2 px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-faint">Pasos</span>
          <NumericInput
            value={steps}
            onChange={setSteps}
            allowDecimal={false}
            className="h-10 w-full rounded-pill border border-border bg-surface2 px-2 font-mono text-sm text-ink"
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={steps === null}
          className="w-full rounded-pill bg-primary py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Guardar registro
        </button>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        {listDesc.length > 0 ? (
          <div className="space-y-1.5">
            {listDesc.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span className="font-mono text-muted">
                  {formatDateOnly(e.date)} · {e.steps.toLocaleString("es-AR")} pasos
                </span>
                <button
                  type="button"
                  onClick={() => removeStepsEntry(e.id)}
                  aria-label="Eliminar registro"
                  className="rounded-pill p-1 text-faint hover:bg-surface2"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<IconActivity className="h-8 w-8" />}
            title="Todavía no cargaste tus pasos"
            hint="Los registros que agregues van a aparecer acá, y vas a poder verlos en tendencias."
          />
        )}
      </div>
    </section>
  );
}

function WaterForm() {
  const { logs, settings, updateSettings, upsertWaterEntry, removeWaterEntry } = useApp();
  const [date, setDate] = useState(todayKey());
  const [liters, setLiters] = useState<number | null>(null);

  const listDesc = [...logs.waterEntries].sort((a, b) => b.date.localeCompare(a.date));
  const today = todayKey();
  const todayLiters = logs.waterEntries.filter((e) => e.date === today).reduce((sum, e) => sum + e.liters, 0);
  const target = settings.dailyWaterTargetLiters;
  const pct = target > 0 ? (todayLiters / target) * 100 : 0;

  function save() {
    if (liters === null) return;
    const now = new Date().toISOString();
    upsertWaterEntry({ id: newId(), date, liters, createdAt: now, updatedAt: now });
    setLiters(null);
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
      <WaterBottle pct={pct} />
      <p className="mt-1 text-center font-mono text-sm text-ink">
        {todayLiters.toFixed(1)}L / {target.toFixed(1)}L hoy
      </p>

      <div className="mt-3">
        <DailyTarget
          label="Meta diaria de agua"
          unit="L"
          value={target}
          decimals={1}
          onSave={(value) => updateSettings({ dailyWaterTargetLiters: value })}
        />
      </div>

      <div className="mt-3 space-y-2">
        <label className="block">
          <span className="mb-1 block text-xs text-faint">Fecha</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-pill border border-border bg-surface2 px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-faint">Agua tomada (L)</span>
          <NumericInput
            value={liters}
            onChange={setLiters}
            allowDecimal
            className="h-10 w-full rounded-pill border border-border bg-surface2 px-2 font-mono text-sm text-ink"
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={liters === null}
          className="w-full rounded-pill bg-primary py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Guardar registro
        </button>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        {listDesc.length > 0 ? (
          <div className="space-y-1.5">
            {listDesc.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span className="font-mono text-muted">
                  {formatDateOnly(e.date)} · {e.liters}L
                </span>
                <button
                  type="button"
                  onClick={() => removeWaterEntry(e.id)}
                  aria-label="Eliminar registro"
                  className="rounded-pill p-1 text-faint hover:bg-surface2"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<IconActivity className="h-8 w-8" />}
            title="Todavía no cargaste agua"
            hint="Los registros que agregues van a aparecer acá, y vas a poder verlos en tendencias."
          />
        )}
      </div>
    </section>
  );
}

function BodyWeightTrends({ entries }: { entries: BodyWeightEntry[] }) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const weightPoints = sorted.map((e) => ({ date: e.date, value: e.weightKg }));
  const fatPoints = sorted.filter((e) => e.bodyFatPct !== null).map((e) => ({ date: e.date, value: e.bodyFatPct! }));
  const musclePoints = sorted
    .filter((e) => e.muscleMassKg !== null)
    .map((e) => ({ date: e.date, value: e.muscleMassKg! }));
  const refKey = todayKey();

  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
      <TrendChart points={weightPoints} unit="kg" />

      {fatPoints.length > 1 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-muted">% de grasa corporal</p>
          <TrendChart points={fatPoints} unit="%" colorClassName="text-warning" />
        </div>
      )}
      {musclePoints.length > 1 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-muted">Masa muscular</p>
          <TrendChart points={musclePoints} unit="kg" colorClassName="text-success" />
        </div>
      )}

      {entries.length > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-border pt-3">
          <AverageRow
            label="Peso"
            unit="kg"
            entries={entries}
            dateOf={(e) => e.date}
            valueOf={(e) => e.weightKg}
            refKey={refKey}
          />
          <AverageRow
            label="% grasa"
            unit="%"
            entries={entries}
            dateOf={(e) => e.date}
            valueOf={(e) => e.bodyFatPct}
            refKey={refKey}
          />
          <AverageRow
            label="Músculo"
            unit="kg"
            entries={entries}
            dateOf={(e) => e.date}
            valueOf={(e) => e.muscleMassKg}
            refKey={refKey}
          />
        </div>
      )}
    </section>
  );
}

function SleepTrends({ entries }: { entries: SleepEntry[] }) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const scorePoints = sorted.map((e) => ({ date: e.date, value: e.score }));
  const deepPoints = sorted
    .filter((e) => e.deepSleepMinutes !== null)
    .map((e) => ({ date: e.date, value: e.deepSleepMinutes! }));
  const awakePoints = sorted
    .filter((e) => e.awakeMinutes !== null)
    .map((e) => ({ date: e.date, value: e.awakeMinutes! }));
  const refKey = todayKey();

  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
      <TrendChart points={scorePoints} colorClassName="text-primary" />

      {deepPoints.length > 1 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-muted">Sueño profundo (min)</p>
          <TrendChart points={deepPoints} unit="min" colorClassName="text-success" />
        </div>
      )}
      {awakePoints.length > 1 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-muted">Tiempo despierto (min)</p>
          <TrendChart points={awakePoints} unit="min" colorClassName="text-warning" />
        </div>
      )}

      {entries.length > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-border pt-3">
          <AverageRow
            label="Score"
            unit="/100"
            decimals={0}
            entries={entries}
            dateOf={(e) => e.date}
            valueOf={(e) => e.score}
            refKey={refKey}
          />
          <AverageRow
            label="Sueño profundo"
            unit="min"
            decimals={0}
            entries={entries}
            dateOf={(e) => e.date}
            valueOf={(e) => e.deepSleepMinutes}
            refKey={refKey}
          />
          <AverageRow
            label="Despierto"
            unit="min"
            decimals={0}
            entries={entries}
            dateOf={(e) => e.date}
            valueOf={(e) => e.awakeMinutes}
            refKey={refKey}
          />
        </div>
      )}
    </section>
  );
}

function StepsTrends({ entries }: { entries: StepsEntry[] }) {
  const points = sumByDate(entries, (e) => e.date, (e) => e.steps);
  const refKey = todayKey();

  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
      <TrendChart points={points} unit=" pasos" colorClassName="text-primary" />

      {entries.length > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-border pt-3">
          <AverageRow
            label="Pasos"
            unit=""
            decimals={0}
            entries={points}
            dateOf={(p) => p.date}
            valueOf={(p) => p.value}
            refKey={refKey}
          />
        </div>
      )}
    </section>
  );
}

function WaterTrends({ entries }: { entries: WaterEntry[] }) {
  const points = sumByDate(entries, (e) => e.date, (e) => e.liters);
  const refKey = todayKey();

  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
      <TrendChart points={points} unit="L" colorClassName="text-primary" />

      {entries.length > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-border pt-3">
          <AverageRow
            label="Agua"
            unit="L"
            entries={points}
            dateOf={(p) => p.date}
            valueOf={(p) => p.value}
            refKey={refKey}
          />
        </div>
      )}
    </section>
  );
}

type SubTab = "cargar" | "tendencias";

const METRICS: { key: LifestyleMetricKey; label: string; Icon: typeof IconScale }[] = [
  { key: "weight", label: "Peso corporal", Icon: IconScale },
  { key: "sleep", label: "Calidad de sueño", Icon: IconMoon },
  { key: "steps", label: "Pasos", Icon: IconFootprint },
  { key: "water", label: "Agua", Icon: IconDroplet },
];

function MetricGrid({ onSelect }: { onSelect: (metric: LifestyleMetricKey) => void }) {
  const { logs } = useApp();
  const previews = getMetricPreviews(logs);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {METRICS.map(({ key, label, Icon }) => {
        const preview = previews.find((p) => p.key === key)!;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className="rounded-card border border-border bg-surface p-4 text-left shadow-elevated-sm"
          >
            <Icon className="h-7 w-7 text-primary" />
            <p className="mt-2 font-medium text-ink">{label}</p>
            <p className={`mt-0.5 text-xs ${preview.hasData ? "text-muted" : "text-faint"}`}>{preview.preview}</p>
          </button>
        );
      })}
    </div>
  );
}

function MetricDetailScreen({
  metric,
  subTab,
  onSubTabChange,
  onBack,
}: {
  metric: LifestyleMetricKey;
  subTab: SubTab;
  onSubTabChange: (tab: SubTab) => void;
  onBack: () => void;
}) {
  const { logs } = useApp();
  const meta = METRICS.find((m) => m.key === metric)!;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-pill border border-border bg-surface2 text-ink transition-transform hover:bg-border/60 active:scale-95"
        >
          <IconChevronLeft className="h-[18px] w-[18px]" />
        </button>
        <h1 className="text-xl font-bold text-ink">{meta.label}</h1>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {(
          [
            { id: "cargar", label: "Cargar" },
            { id: "tendencias", label: "Tendencias" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSubTabChange(t.id)}
            className={`shrink-0 rounded-pill px-3 py-1.5 text-sm font-medium transition-opacity active:opacity-70 ${
              subTab === t.id ? "bg-primary text-white" : "bg-surface2 text-faint"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "cargar" ? (
        <>
          {metric === "weight" && <BodyWeightForm />}
          {metric === "sleep" && <SleepForm />}
          {metric === "steps" && <StepsForm />}
          {metric === "water" && <WaterForm />}
        </>
      ) : (
        <>
          {metric === "weight" && <BodyWeightTrends entries={logs.bodyWeightEntries} />}
          {metric === "sleep" && <SleepTrends entries={logs.sleepEntries} />}
          {metric === "steps" && <StepsTrends entries={logs.stepsEntries} />}
          {metric === "water" && <WaterTrends entries={logs.waterEntries} />}
        </>
      )}
    </div>
  );
}

interface Props {
  initialMetric?: LifestyleMetricKey | null;
  onInitialMetricConsumed?: () => void;
}

export function LifestyleScreen({ initialMetric, onInitialMetricConsumed }: Props) {
  const [selectedMetric, setSelectedMetric] = useState<LifestyleMetricKey | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("cargar");

  useEffect(() => {
    if (!initialMetric) return;
    setSelectedMetric(initialMetric);
    setSubTab("tendencias");
    onInitialMetricConsumed?.();
    // Solo queremos reaccionar cuando llega un nuevo valor desde Inicio, no en cada re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMetric]);

  if (selectedMetric) {
    return (
      <MetricDetailScreen
        metric={selectedMetric}
        subTab={subTab}
        onSubTabChange={setSubTab}
        onBack={() => setSelectedMetric(null)}
      />
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-bold text-ink">Lifestyle</h1>
        <p className="text-xs text-muted">
          Todo acá es opcional — nunca hace falta para poder entrenar. La calidad de sueño se usa
          también como dato opcional del algoritmo de recomendación.
        </p>
      </div>

      <MetricGrid
        onSelect={(metric) => {
          setSelectedMetric(metric);
          setSubTab("cargar");
        }}
      />
    </div>
  );
}
