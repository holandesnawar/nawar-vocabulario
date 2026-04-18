import { notFound } from 'next/navigation';
import {
  getModules,
  getLessonsForModule,
  getExtrasForModule,
  getPreviousLesson,
  getNextLesson,
  getModuleAsync,
  getLessonAsync,
} from '@/lib/courseService';
import LessonViewer from '@/components/LessonViewer';

// Cache 60s: balance entre frescura (audio/contenido nuevo de Supabase visible
// rápido tras cambios) y rendimiento (navegaciones repetidas sin re-fetch).
export const revalidate = 60;

export function generateStaticParams() {
  return getModules().flatMap((module) =>
    [...getLessonsForModule(module.id), ...getExtrasForModule(module.id)].map((lesson) => ({
      moduleId: module.id,
      lessonId: lesson.id,
    }))
  )
}

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
