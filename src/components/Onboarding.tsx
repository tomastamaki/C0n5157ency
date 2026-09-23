import { useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Slide {
  title: string;
  body: React.ReactNode;
}

const SLIDES: Slide[] = [
  {
    title: "¿Qué es el RIR?",
    body: (
      <>
        <p>
          RIR significa <span className="font-semibold text-ink">"Reps In Reserve"</span> — cuántas
          repeticiones más podrías haber hecho antes de fallar. Es la forma en la que el programa mide
          qué tan cerca del fallo entrenás en cada serie.
        </p>
        <p className="mt-3">
          En cada serie vas a ver una botonera <span className="font-mono text-ink">0 · 1 · 2 · 3+</span>:
          tocá el número que más se acerque a cuántas reps te quedaron en el tanque. RIR 0 = fallo total,
          RIR 3+ = todavía te sobraba bastante.
        </p>
      </>
    ),
  },
  {
    title: "Cómo se completa una serie",
    body: (
      <>
        <p>Para cada serie: cargá el peso y las reps que hiciste, elegí el RIR, y tocá el check verde.</p>
        <p className="mt-3">
          <span className="font-semibold text-ink">"Confirmar serie ✓"</span> es lo que la cuenta como
          hecha de verdad — hasta que no la confirmás, no suma al progreso ni dispara el descanso.
        </p>
      </>
    ),
  },
  {
    title: "Agregala a tu pantalla de inicio",
    body: (
      <>
        <p>Esta app funciona mejor si la agregás a la pantalla de inicio de tu celular, como una app nativa.</p>
        <p className="mt-3">
          En <span className="font-semibold text-ink">iPhone</span>: botón compartir → "Agregar a pantalla
          de inicio".
          <br />
          En <span className="font-semibold text-ink">Android</span>: menú (⋮) del navegador → "Agregar a
          pantalla de inicio" o "Instalar app".
        </p>
      </>
    ),
  },
  {
    title: "El programa: Min-Max Phase 2",
    body: (
      <>
        <p className="font-semibold text-ink">Min-Max Phase 2: Peak Physique</p>
        <ul className="mt-3 space-y-1.5">
          <li>• 12 semanas en total, divididas en 2 bloques de 6 semanas.</li>
          <li>• Split de 4 días: Upper / Lower / Push / Pull, en el orden que prefieras cada semana.</li>
          <li>• Cada bloque incluye una semana de deload (volumen reducido) para recuperarte.</li>
        </ul>
      </>
    ),
  },
];

interface Props {
  onDone: () => void;
}

export function OnboardingScreen({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const isLast = step === SLIDES.length - 1;

  function goNext() {
    if (isLast) onDone();
    else setStep((s) => s + 1);
  }
  function goBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (deltaX < -50) goNext();
    else if (deltaX > 50) goBack();
  }

  const slide = SLIDES[step];

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-bg px-6 py-8">
      <button type="button" onClick={onDone} className="self-end text-sm font-medium text-faint">
        Saltar
      </button>

      <div
        className="flex flex-1 flex-col justify-center"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <h1 className="text-2xl font-bold text-ink">{slide.title}</h1>
        <div className="mt-4 text-[15px] leading-relaxed text-muted">{slide.body}</div>
      </div>

      <div className="mb-6 flex justify-center gap-2">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-pill transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-surface2"}`}
          />
        ))}
      </div>

      <div className="flex gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="flex-1 rounded-pill bg-surface2 py-3 text-sm font-semibold text-ink"
          >
            Atrás
          </button>
        )}
        <button
          type="button"
          onClick={goNext}
          className="flex-1 rounded-pill bg-primary py-3 text-sm font-semibold text-white active:scale-[0.98]"
        >
          {isLast ? "Empezar" : "Siguiente"}
        </button>
      </div>
    </div>,
    document.body
  );
}
