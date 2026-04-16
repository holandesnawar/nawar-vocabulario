'use client';

import { useEffect } from 'react';

/**
 * Hook que comunica al iframe padre (Circle) la altura real del contenido
 * de esta app. Así el iframe crece/encoge automáticamente y no se produce
 * doble scroll (iframe + página contenedora).
 *
 * Solo actúa si la app está embebida dentro de un iframe.
 */
export function useIframeHeight() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Si no estamos dentro de un iframe, no hacemos nada
    if (window.self === window.top) return;

    const sendHeight = () => {
      const height = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
      );

      window.parent.postMessage(
        { type: 'vocab-height', height },
        '*'
      );
    };

    // Altura inicial
    sendHeight();

    // Observar cambios en el DOM (módulos que se abren, ejercicios, etc.)
    const resizeObserver = new ResizeObserver(() => {
      sendHeight();
    });
    resizeObserver.observe(document.body);

    // Cuando cambia el tamaño de la ventana
    window.addEventListener('resize', sendHeight);

    // Fallback por si algo cambia sin disparar el ResizeObserver
    const interval = window.setInterval(sendHeight, 1000);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', sendHeight);
      window.clearInterval(interval);
    };
  }, []);
}
