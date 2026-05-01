/**
 * Skeleton de carga para /modulo/[moduleId].
 * Aparece instantáneamente al hacer click en un módulo mientras Next
 * obtiene los datos. Replica la estructura del hero + lista de lecciones
 * para que la transición sea suave (sin "salto" cuando llega el contenido).
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative brand-banner overflow-hidden">
        <div aria-hidden className="absolute inset-0 dots-dark pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-6 pt-8 pb-8">
          <div className="flex items-center justify-between mb-5">
            <div className="h-7 w-32 rounded bg-white/10 animate-pulse" />
            <div className="h-9 w-9 rounded-full bg-white/10 animate-pulse" />
          </div>
          <div className="h-7 w-44 rounded-full bg-white/10 animate-pulse mb-5" />
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/10 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-2/3 rounded bg-white/15 animate-pulse" />
              <div className="h-4 w-1/3 rounded bg-white/10 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2">
            <div className="h-7 w-28 rounded-full bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Lesson list skeleton */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-4 rounded-2xl border border-[#DDE6F5] bg-white p-5"
          >
            <div className="h-10 w-10 rounded-xl bg-[#F0F5FF] animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-[#F0F5FF] animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-[#F0F5FF] animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-[#F0F5FF] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
