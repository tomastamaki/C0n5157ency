import { useState } from "react";
import { useApp } from "../context/AppContext";
import { TrendChart } from "../components/TrendChart";
import { NumericInput } from "../components/NumericInput";
import { IconTrash } from "../components/icons";
import { newId } from "../lib/id";
import { formatDateOnly } from "../lib/time";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function BodyWeightSection() {
  const { logs, upsertBodyWeightEntry, removeBodyWeightEntry } = useApp();
  const [date, setDate] = useState(todayKey());
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [bodyFatPct, setBodyFatPct] = useState<number | null>(null);
  const [muscleMassKg, setMuscleMassKg] = useState<number | null>(null);

  const sorted = [...logs.bodyWeightEntries].sort((a, b) => a.date.localeCompare(b.date));
  const weightPoints = sorted.map((e) => ({ date: e.date, value: e.weightKg }));
  const fatPoints = sorted.filter((e) => e.bodyFatPct !== null).map((e) => ({ date: e.date, value: e.bodyFatPct! }));
  const musclePoints = sorted
    .filter((e) => e.muscleMassKg !== null)
    .map((e) => ({ date: e.date, value: e.muscleMassKg! }));

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

      <div className="mt-4 space-y-2 border-t border-border pt-3">
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

function SleepSection() {
  const { logs, upsertSleepEntry, removeSleepEntry } = useApp();
  const [date, setDate] = useState(todayKey());
  const [score, setScore] = useState<number | null>(null);
  const [deepSleepHours, setDeepSleepHours] = useState<number | null>(null);
  const [awakeMinutes, setAwakeMinutes] = useState<number | null>(null);

  const sorted = [...logs.sleepEntries].sort((a, b) => a.date.localeCompare(b.date));
  const scorePoints = sorted.map((e) => ({ date: e.date, value: e.score }));
  const deepPoints = sorted
    .filter((e) => e.deepSleepHours !== null)
    .map((e) => ({ date: e.date, value: e.deepSleepHours! }));

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
      <TrendChart points={scorePoints} colorClassName="text-primary" />

      {deepPoints.length > 1 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-muted">Sueño profundo (hs)</p>
          <TrendChart points={deepPoints} unit="h" colorClassName="text-success" />
        </div>
      )}

      <div className="mt-4 space-y-2 border-t border-border pt-3">
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

export function PerformanceScreen() {
  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-bold text-ink">Rendimiento</h1>
        <p className="text-xs text-muted">
          Todo acá es opcional — nunca hace falta para poder entrenar. La calidad de sueño se usa
          también como dato opcional del algoritmo de recomendación.
        </p>
      </div>
      <BodyWeightSection />
      <SleepSection />
    </div>
  );
}
