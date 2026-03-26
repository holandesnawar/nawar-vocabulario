import { notFound } from 'next/navigation';
import { getModule, getLesson, getPreviousLesson, getNextLesson, getAllLessonIds } from '@/lib/courseService';
import LessonViewer from '@/components/LessonViewer';

export async function generateStaticParams() {
  return getAllLessonIds().map(({ moduleId, lessonId }) => ({
    moduleId,
    lessonId,
  }));
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
