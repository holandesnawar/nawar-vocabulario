import { notFound } from 'next/navigation';
import { getModule, getLesson, getPreviousLesson, getNextLesson, getAllLessonIds, getModules, getLessonsForModule } from '@/lib/courseService';
import LessonViewer from '@/components/LessonViewer';

export function generateStaticParams() {
  return getModules().flatMap((module) =>
    getLessonsForModule(module.id).map((lesson) => ({
      moduleId: module.id,
      lessonId: lesson.id,
    }))
  )
}

export default function LessonPage({
  params,
}: {
  params: { moduleId: string; lessonId: string };
}) {
  const module = getModule(params.moduleId);
  if (!module) notFound();

  const lesson = getLesson(params.moduleId, params.lessonId);
  if (!lesson) notFound();

  const prevLesson = getPreviousLesson(params.moduleId, params.lessonId);
  const nextLesson = getNextLesson(params.moduleId, params.lessonId);

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
