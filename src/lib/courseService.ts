import { MODULES, LESSONS } from './courseData';
import type { CourseModule, Lesson } from './types';

export function getModules(): CourseModule[] {
  return MODULES.slice().sort((a, b) => a.order - b.order);
}

export function getModule(id: string): CourseModule | undefined {
  return MODULES.find(m => m.id === id);
}

export function getLessonsForModule(moduleId: string): Lesson[] {
  return LESSONS.filter(l => l.moduleId === moduleId).sort((a, b) => a.order - b.order);
}

export function getLesson(moduleId: string, lessonId: string): Lesson | undefined {
  return LESSONS.find(l => l.moduleId === moduleId && l.id === lessonId);
}

export function getPreviousLesson(moduleId: string, lessonId: string): Lesson | undefined {
  const lessons = getLessonsForModule(moduleId);
  const idx = lessons.findIndex(l => l.id === lessonId);
  if (idx <= 0) return undefined;
  return lessons[idx - 1];
}

export function getNextLesson(moduleId: string, lessonId: string): Lesson | undefined {
  const lessons = getLessonsForModule(moduleId);
  const idx = lessons.findIndex(l => l.id === lessonId);
  if (idx < 0 || idx >= lessons.length - 1) return undefined;
  return lessons[idx + 1];
}

export function getAllLessonIds(): { moduleId: string; lessonId: string }[] {
  return LESSONS.map(l => ({ moduleId: l.moduleId, lessonId: l.id }));
}
