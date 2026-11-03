import { useState } from "react";
import { useApp } from "../context/AppContext";
import { VideoEmbed } from "../components/VideoEmbed";
import { getLiteralWorkingSets } from "../lib/program";
import { getDefaultVariant, withVariantChoice } from "../lib/variants";
import { matchExerciseReferences } from "../lib/exerciseReference";
import { globalSeq } from "../lib/cycle";
import { IconChevronLeft } from "../components/icons";
import type { LogsData } from "../types/logs";
import type { ExerciseGroup, FlatProgramDay, Program } from "../types/program";

function summarize(group: ExerciseGroup): string {
  const literal = getLiteralWorkingSets(group);
  if (literal.length === 0) return "";
  return `${literal.length} serie${literal.length > 1 ? "s" : ""} · ${literal[0].reps} reps`;
}

function PreviewExerciseCard({
  group,
  chosen,
  dayName,
  logs,
  program,
  flatDays,
  beforeGlobalSeq,
  onChoose,
}: {
  group: ExerciseGroup;
  chosen: string;
  dayName: string;
  logs: LogsData;
  program: Program;
  flatDays: FlatProgramDay[];
  beforeGlobalSeq: number;
  onChoose: (name: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const variants = [
    { name: group.exercise, videoUrl: group.videoUrl, isOriginal: true },
    ...group.substitutions.map((s) => ({ name: s.name, videoUrl: s.videoUrl, isOriginal: false })),
  ];
  const isSubstituted = chosen !== group.exercise;
  const literal = getLiteralWorkingSets(group);
  const references = matchExerciseReferences(
    logs,
    flatDays,
    program,
    chosen,
    dayName,
    literal.map((s) => s.reps),
    beforeGlobalSeq
  )[0];

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

      {references.some((r) => r.set !== null) && (
        <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted">
          {literal.map((set, i) => {
            const ref = references[i];
            if (!ref.set) return null;
            return (
              <li key={i}>
                S{i + 1} ({set.reps} reps): última vez {ref.set.weightKg}kg × {ref.set.reps}
                {ref.tier !== "same-day" && <span className="text-warning"> · {ref.dayName}</span>}
              </li>
            );
          })}
        </ul>
      )}

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
  const { settings, updateSettings, logs, program, flatDays } = useApp();
  const beforeGlobalSeq = globalSeq({ programIndex: flatDay.index, cycle: settings.programCycle });

  function choose(originalName: string, name: string | null) {
    updateSettings({ exerciseVariantDefaults: withVariantChoice(settings, originalName, name) });
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
          Elegí de antemano qué variante de cada ejercicio vas a usar. Queda como la
          predeterminada de ese ejercicio en todo el programa, hasta que la cambies de nuevo.
        </p>
      </div>

      <div className="space-y-3">
        {flatDay.day.exerciseGroups.map((group, i) => {
          const chosen = getDefaultVariant(settings, group.exercise);
          return (
            <PreviewExerciseCard
              key={i}
              group={group}
              chosen={chosen}
              dayName={flatDay.day.name}
              logs={logs}
              program={program}
              flatDays={flatDays}
              beforeGlobalSeq={beforeGlobalSeq}
              onChoose={(name) => choose(group.exercise, name)}
            />
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
