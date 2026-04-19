import Link from 'next/link';

/**
 * Top bar con el logo Nawar — aparece en TODAS las páginas (va en layout.tsx).
 * Mínimo, discreto, click en el logo lleva a home. Diseñado para no competir
 * visualmente con el contenido ni los heroes de las páginas.
 */
export default function SiteHeader() {
  return (
    <header className="w-full bg-white border-b border-[#EEF0F5]">
      <div className="max-w-2xl mx-auto px-6 py-3 flex items-center">
        <Link href="/" className="inline-flex items-center" aria-label="Inicio — Holandés Nawar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://docs.holandesnawar.com/img/Nawar.png"
            alt="Holandés Nawar"
            className="h-7 w-auto"
          />
        </Link>
      </div>
    </header>
  );
}
