import { useState } from "react";
import { useApp } from "../context/AppContext";
import { HabitCard, type HabitCardProps } from "../components/habits/HabitCard";
import { Chip } from "../components/habits/Chip";
import { ColorSwatchPicker } from "../components/habits/ColorSwatchPicker";
import { IconPicker } from "../components/habits/IconPicker";
import { DayOfWeekPicker } from "../components/habits/DayOfWeekPicker";
import { Stepper } from "../components/habits/Stepper";
import { SegmentedControl } from "../components/habits/SegmentedControl";
import { FormField, TextAreaField, TextField } from "../components/habits/FormField";
import { IconButton } from "../components/habits/IconButton";
import { IconArrowLeft } from "../components/icons";
import { habitIconFor, HABIT_COLORS } from "../components/habits/habitVisuals";
import { HABIT_CATEGORIES, HABIT_TEMPLATES, HABIT_TIMES_OF_DAY, HABIT_TYPE_LABELS, emptyDraft } from "../lib/habitTemplates";
import { newHabit } from "../lib/habitActions";
import type { Habit, HabitFrequency, HabitType } from "../types/habits";

type Draft = Omit<Habit, "id" | "createdAt" | "updatedAt" | "archivedAt">;

const FREQ_LABELS: { kind: HabitFrequency["kind"]; label: string }[] = [
  { kind: "daily", label: "Todos los días" },
  { kind: "weekly", label: "N veces por semana" },
  { kind: "days", label: "Días específicos" },
  { kind: "every", label: "Cada N días" },
];

function quickStepsFor(unit: string | null): number[] {
  if (unit === "ml") return [250, 500];
  return [];
}

function buildPreviewProps(draft: Draft): HabitCardProps {
  const common = {
    id: "preview",
    name: draft.name || "Tu hábito",
    icon: draft.icon,
    color: draft.color,
    status: "pending" as const,
    streak: 0,
    heat: Array(14).fill("none") as HabitCardProps["heat"],
  };
  if (draft.type === "quantity") {
    return {
      ...common,
      kind: "quantity",
      subtitle: `Meta: ${draft.goal} ${draft.unit ?? ""}`.trim(),
      current: 0,
      goal: draft.goal,
      unit: draft.unit ?? "",
      quickAmounts: quickStepsFor(draft.unit),
    };
  }
  if (draft.type === "time") {
    return {
      ...common,
      kind: "time",
      subtitle: "",
      goalMinutes: draft.goal,
      ...(draft.frequency.kind === "weekly" ? { weeklyDone: 0, weeklyTarget: draft.frequency.n } : {}),
    };
  }
  if (draft.type === "avoid") {
    return { ...common, kind: "avoid", subtitle: "A evitar" };
  }
  return { ...common, kind: "yesno", subtitle: "" };
}

interface Props {
  onDone: () => void;
  onCancel: () => void;
}

export function CreateHabitScreen({ onDone, onCancel }: Props) {
  const { upsertHabit } = useApp();
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  function applyTemplate(i: number) {
    const t = HABIT_TEMPLATES[i];
    patch({
      name: t.name,
      icon: t.icon,
      color: t.color,
      type: t.type,
      unit: t.unit,
      goal: t.goal,
      quickSteps: t.quickSteps,
      frequency: t.frequency,
      category: t.category,
      timeOfDay: t.timeOfDay,
    });
  }

  function setType(type: HabitType) {
    patch({
      type,
      unit: type === "quantity" ? (draft.unit ?? "ml") : type === "time" ? "min" : null,
      goal: type === "yesno" || type === "avoid" ? 1 : draft.goal,
    });
  }

  function setFrequencyKind(kind: HabitFrequency["kind"]) {
    if (kind === "daily") patch({ frequency: { kind: "daily" } });
    else if (kind === "weekly") patch({ frequency: { kind: "weekly", n: 4 } });
    else if (kind === "days") patch({ frequency: { kind: "days", days: [0, 2, 4] } });
    else patch({ frequency: { kind: "every", n: 2 } });
  }

  function toggleDay(day: number) {
    if (draft.frequency.kind !== "days") return;
    const days = draft.frequency.days.includes(day)
      ? draft.frequency.days.filter((d) => d !== day)
      : [...draft.frequency.days, day].sort();
    patch({ frequency: { kind: "days", days } });
  }

  function submit() {
    upsertHabit(newHabit({ ...draft, quickSteps: quickStepsFor(draft.unit) }));
    onDone();
  }

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <div className="mb-3 flex items-center gap-3">
        <IconButton aria-label="Volver" onClick={onCancel}>
          <IconArrowLeft className="h-[18px] w-[18px]" />
        </IconButton>
        <h1 className="text-lg font-bold text-ink">Nuevo hábito</h1>
      </div>

      <div className="space-y-5">
        <FormField label="Empezá con una plantilla" hint="o creá desde cero">
          <div className="flex gap-2.5 overflow-x-auto pb-1.5 no-scrollbar">
            {HABIT_TEMPLATES.map((t, i) => {
              const TplIcon = habitIconFor(t.icon);
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => applyTemplate(i)}
                  className={`flex w-[92px] shrink-0 flex-col gap-2 rounded-block border bg-surface p-2.5 text-left ${
                    draft.name === t.name ? "border-primary ring-2 ring-primary/30" : "border-border"
                  }`}
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-block text-habitink"
                    style={{ backgroundColor: HABIT_COLORS[t.color] }}
                  >
                    <TplIcon className="h-[18px] w-[18px]" />
                  </div>
                  <b className="text-[13px] text-ink">{t.name}</b>
                  <small className="-mt-1.5 text-[11px] text-muted">{t.caption}</small>
                </button>
              );
            })}
          </div>
        </FormField>

        <FormField label="Así se va a ver" hint="vista previa">
          <HabitCard {...buildPreviewProps(draft)} />
        </FormField>

        <FormField label="Nombre">
          <TextField value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Nombre del hábito" />
        </FormField>

        <FormField label="Tipo">
          <SegmentedControl
            options={(Object.keys(HABIT_TYPE_LABELS) as HabitType[]).map((v) => ({ value: v, label: HABIT_TYPE_LABELS[v] }))}
            value={draft.type}
            onChange={setType}
          />
        </FormField>

        {(draft.type === "quantity" || draft.type === "time") && (
          <div className="grid grid-cols-2 gap-2.5">
            <FormField label="Objetivo del día">
              <TextField
                type="number"
                value={draft.goal}
                onChange={(e) => patch({ goal: Number(e.target.value) || 0 })}
                className="font-mono font-bold"
              />
            </FormField>
            <FormField label="Unidad">
              <TextField value={draft.unit ?? ""} onChange={(e) => patch({ unit: e.target.value })} placeholder="ml, pasos, min…" />
            </FormField>
          </div>
        )}

        <FormField label="Frecuencia">
          <div className="flex flex-wrap gap-2">
            {FREQ_LABELS.map((f) => (
              <Chip key={f.kind} label={f.label} active={draft.frequency.kind === f.kind} onClick={() => setFrequencyKind(f.kind)} />
            ))}
          </div>
        </FormField>

        {draft.frequency.kind === "weekly" && (
          <FormField label="Veces por semana">
            <Stepper
              value={draft.frequency.n}
              min={1}
              max={7}
              onChange={(n) => patch({ frequency: { kind: "weekly", n } })}
            />
          </FormField>
        )}
        {draft.frequency.kind === "every" && (
          <FormField label="Cada cuántos días">
            <Stepper value={draft.frequency.n} min={2} max={30} onChange={(n) => patch({ frequency: { kind: "every", n } })} />
          </FormField>
        )}
        {draft.frequency.kind === "days" && (
          <FormField label="Días específicos">
            <DayOfWeekPicker selected={draft.frequency.days} onToggle={toggleDay} />
          </FormField>
        )}

        <FormField label="Categoría">
          <div className="flex flex-wrap gap-2">
            {HABIT_CATEGORIES.map((c) => (
              <Chip key={c} label={c} active={draft.category === c} onClick={() => patch({ category: c })} />
            ))}
          </div>
        </FormField>

        <FormField label="Color">
          <ColorSwatchPicker value={draft.color} onChange={(color) => patch({ color })} />
        </FormField>

        <FormField label="Ícono">
          <IconPicker value={draft.icon} onChange={(icon) => patch({ icon })} />
        </FormField>

        <FormField label="Momento del día">
          <SegmentedControl
            options={HABIT_TIMES_OF_DAY.map((v) => ({ value: v, label: v }))}
            value={draft.timeOfDay}
            onChange={(timeOfDay) => patch({ timeOfDay })}
          />
        </FormField>

        <FormField label="Fecha de inicio">
          <TextField type="date" value={draft.startDate} onChange={(e) => patch({ startDate: e.target.value })} />
        </FormField>

        <FormField label="Por qué lo hago" hint="opcional">
          <TextAreaField
            value={draft.why ?? ""}
            onChange={(e) => patch({ why: e.target.value || null })}
            placeholder="¿Por qué este hábito te importa?"
          />
        </FormField>
      </div>

      <button
        type="button"
        disabled={!draft.name.trim()}
        onClick={submit}
        className="mt-6 w-full rounded-pill bg-primary py-3 text-base font-semibold text-white disabled:opacity-40"
      >
        Crear hábito
      </button>
    </div>
  );
}
