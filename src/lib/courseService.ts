import { MODULES, LESSONS } from './courseData';
import type { CourseModule, Lesson } from './types';
import {
  fetchModules,
  fetchModule,
  fetchLessonsForModule,
  fetchLesson,
} from './supabaseService';

export function getModules(): CourseModule[] {
  return MODULES.slice().sort((a, b) => a.order - b.order);
}

export function getModule(id: string): CourseModule | undefined {
  return MODULES.find(m => m.id === id);
}

export function getLessonsForModule(moduleId: string): Lesson[] {
  return LESSONS.filter(l => l.moduleId === moduleId && !l.isExtra).sort((a, b) => a.order - b.order);
}

export function getExtrasForModule(moduleId: string): Lesson[] {
  return LESSONS.filter(l => l.moduleId === moduleId && l.isExtra === true).sort((a, b) => a.order - b.order);
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

/**
 * Returns the lesson that must be completed BEFORE this one unlocks.
 * - Extras (isExtra) return undefined (they're always unlocked).
 * - Lesson N>1 in a module: returns the previous lesson in the same module.
 * - First lesson of a module: returns the last lesson of the previous module.
 * - First lesson of the first module: returns undefined (always unlocked).
 */
export function getPreviousLessonInOrder(lesson: Lesson): Lesson | undefined {
  if (lesson.isExtra) return undefined;

  const orderedModules = MODULES.slice().sort((a, b) => a.order - b.order);
  const module = orderedModules.find(m => m.id === lesson.moduleId);
  if (!module) return undefined;

  if (lesson.order > 1) {
    const lessons = getLessonsForModule(lesson.moduleId);
    return lessons.find(l => l.order === lesson.order - 1);
  }

  // First lesson of the module → needs the last lesson of the previous module
  const prevModule = orderedModules.find(m => m.order === module.order - 1);
  if (!prevModule) return undefined; // very first lesson of the course

  const prevModuleLessons = getLessonsForModule(prevModule.id);
  if (prevModuleLessons.length === 0) return undefined;
  return prevModuleLessons[prevModuleLessons.length - 1];
}

/* ─────────────────────────────────────────────────────────────────────────────
   ASYNC VERSIONS — try Supabase first, fall back to local data silently.
   Use these in server components for progressive Supabase integration.
───────────────────────────────────────────────────────────────────────────── */

export async function getModulesAsync(): Promise<CourseModule[]> {
  return (await fetchModules()) ?? getModules();
}

export async function getModuleAsync(id: string): Promise<CourseModule | undefined> {
  return (await fetchModule(id)) ?? getModule(id);
}

export async function getLessonsForModuleAsync(moduleId: string): Promise<Lesson[]> {
  return (await fetchLessonsForModule(moduleId, false)) ?? getLessonsForModule(moduleId);
}

export async function getExtrasForModuleAsync(moduleId: string): Promise<Lesson[]> {
  return (await fetchLessonsForModule(moduleId, true)) ?? getExtrasForModule(moduleId);
}

export async function getLessonAsync(moduleId: string, lessonId: string): Promise<Lesson | undefined> {
  return (await fetchLesson(moduleId, lessonId)) ?? getLesson(moduleId, lessonId);
}
