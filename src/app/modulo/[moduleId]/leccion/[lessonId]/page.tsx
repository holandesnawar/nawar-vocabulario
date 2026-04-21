import { notFound } from 'next/navigation';
import {
  getPreviousLesson,
  getNextLesson,
  getModuleAsync,
  getLessonAsync,
} from '@/lib/courseService';
import LessonViewer from '@/components/LessonViewer';

// Dinámico: cada visita re-fetch desde Supabase. Garantiza que cambios de
// contenido (audio_url, opciones nuevas, etc.) se vean inmediatamente.
export const dynamic = 'force-dynamic';

export default async function LessonPage({
  params,
}: {
  params: Promise<{ moduleId: string; lessonId: string }>;
}) {
  const { moduleId, lessonId } = await params;

  const [module, lesson] = await Promise.all([
    getModuleAsync(moduleId),
    getLessonAsync(moduleId, lessonId),
  ]);
  if (!module) notFound();
  if (!lesson) notFound();

  // Navigation uses local data (metadata only — no Supabase query needed)
  const prevLesson = getPreviousLesson(moduleId, lessonId);
  const nextLesson = getNextLesson(moduleId, lessonId);

  return (
    <main className="min-h-screen bg-white">
      <LessonViewer
        lesson={lesson}
        module={module}
        prevLesson={prevLesson}
        nextLesson={nextLesson}
      />
    </main>
  );
}
