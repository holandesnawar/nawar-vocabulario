import type { CourseProgress, LessonProgress, LessonStatus } from './types';

const KEY = 'nawar_course_progress';

export function getProgress(): CourseProgress {
  if (typeof window === 'undefined') return { lessons: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { lessons: {} };
    return JSON.parse(raw) as CourseProgress;
  } catch {
    return { lessons: {} };
  }
}

function saveProgress(progress: CourseProgress): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // storage quota exceeded or unavailable — silently ignore
  }
}

export function getLessonProgress(lessonId: string): LessonProgress | undefined {
  const p = getProgress();
  return p.lessons[lessonId];
}

export function updateLessonProgress(progress: LessonProgress): void {
  const p = getProgress();
  p.lessons[progress.lessonId] = progress;
  saveProgress(p);
}

export function markLessonStarted(lessonId: string, moduleId: string): void {
  const existing = getLessonProgress(lessonId);
  if (existing && existing.status !== 'pending') return;
  updateLessonProgress({
    lessonId,
    moduleId,
    status: 'in_progress',
    errorIds: [],
  });
}

export function markLessonCompleted(
  lessonId: string,
  moduleId: string,
  score: number,
  total: number,
  errorIds: string[],
): void {
  const existing = getLessonProgress(lessonId);
  updateLessonProgress({
    lessonId,
    moduleId,
    status: 'completed',
    score,
    total,
    completedAt: new Date().toISOString(),
    errorIds: errorIds,
    ...(existing ? {} : {}),
  });
}

export function getModuleStats(
  moduleId: string,
  lessonIds: string[],
): { completed: number; inProgress: number; total: number } {
  const p = getProgress();
  let completed = 0;
  let inProgress = 0;
  for (const id of lessonIds) {
    const lp = p.lessons[id];
    if (!lp) continue;
    if (lp.status === 'completed') completed++;
    else if (lp.status === 'in_progress') inProgress++;
  }
  return { completed, inProgress, total: lessonIds.length };
}

export function resetProgress(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
