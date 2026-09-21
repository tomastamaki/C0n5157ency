import { useState } from "react";
import { useApp } from "../context/AppContext";
import { TrendChart } from "../components/TrendChart";
import { NumericInput } from "../components/NumericInput";
import { IconTrash } from "../components/icons";
import { newId } from "../lib/id";
import { formatDateOnly } from "../lib/time";
import type { BodyWeightEntry, SleepEntry } from "../types/logs";

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
      <h2 className="mb-3 font-semibold text-ink">Peso corporal</h2>

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

      {listDesc.length > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-border pt-3">
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
      )}
    </section>
  );
}

function SleepForm() {
  const { logs, upsertSleepEntry, removeSleepEntry } = useApp();
  const [date, setDate] = useState(todayKey());
  const [score, setScore] = useState<number | null>(null);
  const [deepSleepHours, setDeepSleepHours] = useState<number | null>(null);
  const [awakeMinutes, setAwakeMinutes] = useState<number | null>(null);

  const listDesc = [...logs.sleepEntries].sort((a, b) => b.date.localeCompare(a.date));

  function save() {
    if (score === null) return;
    const now = new Date().toISOString();
    upsertSleepEntry({ id: newId(), date, score, deepSleepHours, awakeMinutes, createdAt: now, updatedAt: now });
    setScore(null);
    setDeepSleepHours(null);
    setAwakeMinutes(null);
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
      <h2 className="mb-3 font-semibold text-ink">Calidad de sueño</h2>

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
            <span className="mb-1 block text-xs text-faint">Profundo (hs)</span>
            <NumericInput
              value={deepSleepHours}
              onChange={setDeepSleepHours}
              allowDecimal
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

      {listDesc.length > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-border pt-3">
          {listDesc.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm">
              <span className="font-mono text-muted">
                {formatDateOnly(e.date)} · {e.score}/100
                {e.deepSleepHours !== null && ` · ${e.deepSleepHours}h profundo`}
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
      )}
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
      <h2 className="mb-3 font-semibold text-ink">Peso corporal</h2>
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

      {entries.length === 0 && <p className="mt-3 text-xs text-muted">Todavía no hay registros.</p>}
    </section>
  );
}

function SleepTrends({ entries }: { entries: SleepEntry[] }) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const scorePoints = sorted.map((e) => ({ date: e.date, value: e.score }));
  const deepPoints = sorted
    .filter((e) => e.deepSleepHours !== null)
    .map((e) => ({ date: e.date, value: e.deepSleepHours! }));
  const awakePoints = sorted
    .filter((e) => e.awakeMinutes !== null)
    .map((e) => ({ date: e.date, value: e.awakeMinutes! }));
  const refKey = todayKey();

  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
      <h2 className="mb-3 font-semibold text-ink">Calidad de sueño</h2>
      <TrendChart points={scorePoints} colorClassName="text-primary" />

      {deepPoints.length > 1 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-muted">Sueño profundo (hs)</p>
          <TrendChart points={deepPoints} unit="h" colorClassName="text-success" />
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
            unit="h"
            entries={entries}
            dateOf={(e) => e.date}
            valueOf={(e) => e.deepSleepHours}
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

      {entries.length === 0 && <p className="mt-3 text-xs text-muted">Todavía no hay registros.</p>}
    </section>
  );
}

type SubTab = "cargar" | "tendencias";

export function PerformanceScreen() {
  const { logs } = useApp();
  const [subTab, setSubTab] = useState<SubTab>("cargar");

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-bold text-ink">Rendimiento</h1>
        <p className="text-xs text-muted">
          Todo acá es opcional — nunca hace falta para poder entrenar. La calidad de sueño se usa
          también como dato opcional del algoritmo de recomendación.
        </p>
      </div>

      <div className="flex gap-2">
        {(
          [
            { id: "cargar", label: "Cargar" },
            { id: "tendencias", label: "Tendencias" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`rounded-pill px-3 py-1.5 text-sm font-medium ${
              subTab === t.id ? "bg-primary text-white" : "bg-surface2 text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "cargar" ? (
        <>
          <BodyWeightForm />
          <SleepForm />
        </>
      ) : (
        <>
          <BodyWeightTrends entries={logs.bodyWeightEntries} />
          <SleepTrends entries={logs.sleepEntries} />
        </>
      )}
    </div>
  );
}
