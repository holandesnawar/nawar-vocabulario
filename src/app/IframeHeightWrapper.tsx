'use client';

import { useEffect, useRef } from 'react';

/**
 * Cuando esta app se embebe dentro de un iframe (Circle), este wrapper:
 *  1. Desactiva `min-height: 100vh` del html/body para evitar el bucle
 *     de crecimiento infinito.
 *  2. Mide la altura real del CONTENIDO (no del body) y la envía al
 *     iframe padre, con tolerancia de píxeles para que pequeñas
 *     variaciones no re-disparen el ajuste en bucle.
 */
export default function IframeHeightWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Si no estamos dentro de un iframe no hacemos nada
    if (window.self === window.top) return;

    // Neutralizar min-h-screen cuando estamos embebidos
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const prevHtmlMin = htmlEl.style.minHeight;
    const prevBodyMin = bodyEl.style.minHeight;
    htmlEl.style.minHeight = '0';
    bodyEl.style.minHeight = '0';

    let lastHeight = 0;

    const sendHeight = () => {
      const el = contentRef.current;
      if (!el) return;
      // Medimos el alto real del contenido, ignorando el body
      const height = el.scrollHeight;
      // Guardia anti-loop: ignoramos cambios <= 2px
      if (Math.abs(height - lastHeight) <= 2) return;
      lastHeight = height;
      window.parent.postMessage(
        { type: 'vocab-height', height },
        '*'
      );
    };

    // Altura inicial (con pequeño retraso para que el DOM esté listo)
    const initial = window.setTimeout(sendHeight, 50);

    // Observador sobre el contenedor de contenido
    const ro = new ResizeObserver(() => sendHeight());
    if (contentRef.current) ro.observe(contentRef.current);

    window.addEventListener('resize', sendHeight);

    return () => {
      window.clearTimeout(initial);
      ro.disconnect();
      window.removeEventListener('resize', sendHeight);
      htmlEl.style.minHeight = prevHtmlMin;
      bodyEl.style.minHeight = prevBodyMin;
    };
  }, []);

  return <div ref={contentRef}>{children}</div>;
}
