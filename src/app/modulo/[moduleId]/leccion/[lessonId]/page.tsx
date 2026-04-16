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

// Cacheamos la página 5 minutos. Las modificaciones de contenido en Supabase
// tardarán hasta 5 min en verse para alumnos que ya habían cargado la página,
// pero las navegaciones repetidas se sienten instantáneas.
export const revalidate = 300;

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
