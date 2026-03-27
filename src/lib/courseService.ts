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
