import { useState } from "react";
import type { Recommendation } from "../lib/recommendation";

const LEVEL_STYLES: Record<Recommendation["level"], { badge: string; text: string }> = {
  rest: { badge: "bg-warning/15 text-warning", text: "text-warning" },
  push: { badge: "bg-success/15 text-success", text: "text-success" },
  normal: { badge: "bg-primary/15 text-primary", text: "text-primary" },
  deload: { badge: "bg-surface2 text-muted", text: "text-muted" },
  "muscle-alert": { badge: "bg-warning/15 text-warning", text: "text-warning" },
  "not-enough-data": { badge: "bg-surface2 text-muted", text: "text-muted" },
};

const PARAM_UNIT: Record<string, string> = {
  feeling: "/10",
  rirDeviation: " RIR",
  ownProgress: "%",
  setsCompleted: "%",
  sleep: "/100",
};

export function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const [showDetail, setShowDetail] = useState(false);
  const style = LEVEL_STYLES[recommendation.level];
  const hasDetail = recommendation.muscleAlerts.length > 0 || recommendation.layer2 !== null;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${style.badge}`}>
          {recommendation.title}
        </span>
        {hasDetail && (
          <button
            type="button"
            onClick={() => setShowDetail((s) => !s)}
            className="text-xs font-medium text-faint underline"
          >
            {showDetail ? "ocultar detalle" : "ver detalle"}
          </button>
        )}
      </div>
      {recommendation.level !== "muscle-alert" && (
        <p className={`mt-1 whitespace-pre-line text-xs ${style.text}`}>{recommendation.detail}</p>
      )}
      {recommendation.trendNote && <p className="mt-0.5 text-xs text-warning">{recommendation.trendNote}</p>}

      {showDetail && (
        <div className="mt-2 space-y-1 rounded-block border border-border bg-surface2 p-3">
          {recommendation.muscleAlerts.map((a) => (
            <p key={a.muscle} className="text-xs text-muted">
              {a.muscle}: {Math.round(a.hoursSince)}h desde la última vez · recomendado{" "}
              {Math.round(a.recommendedHours)}h
            </p>
          ))}
          {recommendation.layer2?.params.map((p) => (
            <div key={p.key} className="flex items-center justify-between text-xs">
              <span className="text-muted">{p.label}</span>
              <span className="font-mono text-ink">
                {p.rawValue === null
                  ? "sin datos"
                  : `${p.rawValue.toFixed(1)}${PARAM_UNIT[p.key] ?? ""} → ${
                      p.classified === -1 ? "−1" : p.classified === 1 ? "+1" : "0"
                    } (peso ${p.weight})`}
              </span>
            </div>
          ))}
          {recommendation.layer2 && (
            <p className="mt-1 border-t border-border pt-1 text-xs font-semibold text-ink">
              Score final: {recommendation.layer2.score.toFixed(2)} (sobre {recommendation.layer2.sessionsUsed}{" "}
              sesiones)
            </p>
          )}
        </div>
      )}

      <p className="mt-1 text-[10px] text-faint">
        Sugerencia orientativa en base a tus propios datos, no es una recomendación médica.
      </p>
    </div>
  );
}
