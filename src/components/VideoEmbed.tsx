import { useState } from "react";

export function VideoEmbed({ url }: { url: string | null }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm font-medium text-primary"
      >
        {open ? "Ocultar video de técnica" : "Ver video de técnica"}
      </button>
      {open && (
        <div className="mt-2 aspect-video w-full overflow-hidden rounded-block bg-black">
          <iframe
            src={url}
            title="Técnica del ejercicio"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
