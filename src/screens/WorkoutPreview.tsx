import { useState } from "react";
import { useApp } from "../context/AppContext";
import { VideoEmbed } from "../components/VideoEmbed";
import { getLiteralWorkingSets } from "../lib/program";
import { IconChevronLeft } from "../components/icons";
import type { ExerciseGroup } from "../types/program";
import type { FlatProgramDay } from "../types/program";

function summarize(group: ExerciseGroup): string {
  const literal = getLiteralWorkingSets(group);
  if (literal.length === 0) return "";
  return `${literal.length} serie${literal.length > 1 ? "s" : ""} · ${literal[0].reps} reps`;
}

function PreviewExerciseCard({
  group,
  chosen,
  onChoose,
}: {
  group: ExerciseGroup;
  chosen: string;
  onChoose: (name: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const variants = [
    { name: group.exercise, videoUrl: group.videoUrl, isOriginal: true },
    ...group.substitutions.map((s) => ({ name: s.name, videoUrl: s.videoUrl, isOriginal: false })),
  ];
  const isSubstituted = chosen !== group.exercise;

  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
      <button type="button" onClick={() => setExpanded((e) => !e)} className="flex w-full items-start justify-between text-left">
        <div>
          <p className="font-semibold text-ink">
            {chosen}
            {isSubstituted && <span className="ml-2 text-xs font-normal text-warning">sustituto</span>}
          </p>
          <p className="text-xs text-muted">{summarize(group)}</p>
        </div>
        <span className="shrink-0 text-xs font-medium text-primary">{expanded ? "Ocultar" : "Ver variantes"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {variants.map((v) => {
            const isChosen = chosen === v.name;
            return (
              <div
                key={v.name}
                className={`rounded-block border p-3 ${isChosen ? "border-primary" : "border-border"}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-medium text-ink">
                    {v.name}
                    {v.isOriginal && <span className="ml-2 text-xs font-normal text-faint">(original)</span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => onChoose(v.isOriginal ? null : v.name)}
                    className={`shrink-0 rounded-pill px-3 py-1 text-xs font-semibold ${
                      isChosen ? "bg-primary text-white" : "bg-surface2 text-muted"
                    }`}
                  >
                    {isChosen ? "Elegida ✓" : "Elegir"}
                  </button>
                </div>
                <VideoEmbed url={v.videoUrl} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Props {
  flatDay: FlatProgramDay;
  onBack: () => void;
  onStart: () => void;
}

export function WorkoutPreviewScreen({ flatDay, onBack, onStart }: Props) {
  const { settings, updateSettings } = useApp();

  function choose(groupIdx: number, name: string | null) {
    const key = `${flatDay.index}-${groupIdx}`;
    const next = { ...settings.pendingSubstitutions };
    if (name === null) delete next[key];
    else next[key] = name;
    updateSettings({ pendingSubstitutions: next });
  }

  return (
    <div className="space-y-4 pb-24">
      <button
        type="button"
        onClick={onBack}
        aria-label="Volver"
        className="flex h-[34px] w-[34px] items-center justify-center rounded-pill border border-border bg-surface2 text-ink transition-transform hover:bg-border/60 active:scale-95"
      >
        <IconChevronLeft className="h-[18px] w-[18px]" />
      </button>

      <div>
        <p className="text-sm text-muted">
          {flatDay.blockName} · Semana {flatDay.weekNumber} de {flatDay.totalWeeks}
        </p>
        <h2 className="text-xl font-bold text-ink">{flatDay.day.name} · vista previa</h2>
        <p className="mt-1 text-xs text-muted">
          Elegí de antemano qué variante de cada ejercicio vas a usar hoy. Queda guardado como
          selección por defecto al empezar.
        </p>
      </div>

      <div className="space-y-3">
        {flatDay.day.exerciseGroups.map((group, i) => {
          const key = `${flatDay.index}-${i}`;
          const chosen = settings.pendingSubstitutions[key] ?? group.exercise;
          return (
            <PreviewExerciseCard key={i} group={group} chosen={chosen} onChoose={(name) => choose(i, name)} />
          );
        })}
      </div>

      <button
        type="button"
        onClick={onStart}
        className="w-full rounded-pill bg-primary py-3 text-base font-semibold text-white shadow-elevated-sm active:scale-[0.98]"
      >
        Empezar entrenamiento
      </button>
    </div>
  );
}
