/**
 * Skeleton de carga para /modulo/[moduleId]/leccion/[lessonId].
 * Cubre la primera visita mientras Supabase devuelve los ~10 queries del
 * contenido. Tras esa primera carga, ISR sirve la página al instante.
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
          <div className="h-7 w-52 rounded-full bg-white/10 animate-pulse mb-5" />
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded bg-white/10 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-3/4 rounded bg-white/15 animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-white/10 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Section landing skeleton */}
      <div className="bg-white min-h-[70vh] py-8 pb-20">
        <div className="max-w-5xl mx-auto px-6 space-y-3">
          {/* Tip banner */}
          <div className="rounded-2xl bg-[#F0F5FF] h-16 animate-pulse mb-6" />
          {/* 4 sections (vocab, flashcards, lezen, luisteren) */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-white border border-[#DDE6F5]"
            >
              <div className="w-12 h-12 flex items-center justify-center shrink-0">
                <div className="h-9 w-9 rounded-lg bg-[#F0F5FF] animate-pulse" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-[#F0F5FF] animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-[#F0F5FF] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
