import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getModules,
  getModuleAsync,
  getLessonsForModuleAsync,
  getExtrasForModuleAsync,
} from "@/lib/courseService"
import LessonList from '@/components/LessonList';

// Cacheamos la página 5 minutos. Navegaciones repetidas entre m\u00f3dulos se sienten
// instant\u00e1neas. Cambios de contenido en Supabase se reflejan en m\u00e1ximo 5 min.
export const revalidate = 300;

export function generateStaticParams() {
  return getModules().map((module) => ({
    moduleId: module.id,
  }))
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */

export default async function ModulePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const module = await getModuleAsync(moduleId);
  if (!module) notFound();

  const [lessons, extras] = await Promise.all([
    getLessonsForModuleAsync(module.id),
    getExtrasForModuleAsync(module.id),
  ]);

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="relative bg-[#1D0084] overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[700px] h-[500px]"
            style={{ background: 'radial-gradient(ellipse at center, rgba(11,109,240,0.30) 0%, transparent 65%)' }}
          />
        </div>
        <div aria-hidden className="absolute inset-0 dots-dark pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-6 pt-8 pb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[13px] text-white/50 hover:text-white/80 transition-colors duration-200 mb-5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            Todos los módulos
          </Link>

          <div className="flex items-start gap-3">
            <span className="text-4xl">{module.emoji}</span>
            <div>
              <h1
                className="text-[24px] font-bold text-white leading-tight"
                style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
              >
                {module.title}
              </h1>
              {module.subtitle && (
                <p className="text-[13px] font-semibold text-white/60 mt-0.5">{module.subtitle}</p>
              )}
              <p className="text-[13px] text-white/50 mt-1 leading-snug max-w-sm">
                {module.description}
              </p>
            </div>
          </div>

          <div className="mt-5 text-[12px] text-white/40 font-medium">
            {lessons.length} lección{lessons.length !== 1 ? 'es' : ''} en este módulo
            {extras.length > 0 && ` · ${extras.length} extra${extras.length !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {/* Lesson list */}
      <div className="max-w-2xl mx-auto px-6 py-8">
        <LessonList lessons={lessons} moduleId={module.id} />

        {extras.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[13px] font-bold text-[#5A6480] uppercase tracking-widest">Lecciones extra</span>
              <div className="flex-1 h-px bg-[#DDE6F5]" />
            </div>
            <LessonList lessons={extras} moduleId={module.id} />
          </div>
        )}
      </div>
    </main>
  );
}
