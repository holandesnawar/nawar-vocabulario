import { notFound } from 'next/navigation';
import { getModule, getLesson, getPreviousLesson, getNextLesson, getModules, getLessonsForModule, getExtrasForModule } from '@/lib/courseService';
import LessonViewer from '@/components/LessonViewer';

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
  const module = getModule(moduleId);
  if (!module) notFound();

  const lesson = getLesson(moduleId, lessonId);
  if (!lesson) notFound();

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
