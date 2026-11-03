import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Registra el service worker (solo en producción, para no pelearse con el
 * HMR de Vite en desarrollo) y detecta cuándo hay una versión nueva
 * disponible: el service worker se genera con el hash de commit embebido en
 * cada build (`scripts/gen-sw.mjs`), así que su contenido cambia en cada
 * deploy y el navegador dispara `updatefound` al notar la diferencia.
 *
 * Además fuerza una revisión manual (`registration.update()`) al volver a la
 * pestaña o reconectarse, para no depender solo del chequeo automático del
 * navegador (hasta 24hs).
 */
export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let reloadedOnce = false;

    function markWaiting(worker: ServiceWorker | null) {
      if (!worker) return;
      waitingWorkerRef.current = worker;
      setUpdateAvailable(true);
    }

    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        registration = reg;
        if (reg.waiting && navigator.serviceWorker.controller) markWaiting(reg.waiting);

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              markWaiting(installing);
            }
          });
        });
      })
      .catch(() => {});

    function recheck() {
      registration?.update().catch(() => {});
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") recheck();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", recheck);

    function onControllerChange() {
      // El nuevo service worker ya tomó control: recargar una sola vez para servir los assets nuevos.
      if (reloadedOnce) return;
      reloadedOnce = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", recheck);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    waitingWorkerRef.current?.postMessage("SKIP_WAITING");
  }, []);

  return { updateAvailable, applyUpdate };
}
