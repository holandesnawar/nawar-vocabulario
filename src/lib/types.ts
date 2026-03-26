/* ─────────────────────────────────────────────────────────────────────────────
   AUDIO
───────────────────────────────────────────────────────────────────────────── */

export interface AudioTrack {
  url: string;
  duration?: number;
  label?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   VOCABULARY
───────────────────────────────────────────────────────────────────────────── */

export type Article = 'de' | 'het' | null;
export type Difficulty = 'A0' | 'A1' | 'A2';

export interface VocabularyItem {
  id: string;
  dutch: string;
  spanish: string;
  article: Article;
  emoji: string;
  color: string;
  image?: string;
  audio?: AudioTrack;
  exampleNl: string;
  exampleEs: string;
  category: string;
  difficulty: Difficulty;
}

export interface PhraseItem {
  id: string;
  dutch: string;
  spanish: string;
  audio?: AudioTrack;
  context?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   EXERCISES
───────────────────────────────────────────────────────────────────────────── */

export type ExerciseType =
  | 'multiple_choice'
  | 'listen_and_choose'
  | 'order_sentence'
  | 'write_answer';

export interface ExerciseItem {
  id: string;
  type: ExerciseType;
  prompt: string;
  options?: string[];
  correctAnswer: string;
  audio?: AudioTrack;
  hint?: string;
  explanation?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   DIALOGUE
───────────────────────────────────────────────────────────────────────────── */

export interface DialogueLine {
  id: string;
  speaker: string;
  dutch: string;
  spanish: string;
  audio?: AudioTrack;
}

export interface Dialogue {
  id: string;
  title: string;
  context: string;
  audio?: AudioTrack;
  lines: DialogueLine[];
}

/* ─────────────────────────────────────────────────────────────────────────────
   LESSON BLOCKS — discriminated union
───────────────────────────────────────────────────────────────────────────── */

export type LessonBlock =
  | { type: 'vocabulary'; title?: string; items: VocabularyItem[] }
  | { type: 'phrases';    title?: string; items: PhraseItem[] }
  | { type: 'practice';   title?: string; exercises: ExerciseItem[] }
  | { type: 'dialogue';   title?: string; dialogue: Dialogue }
  | { type: 'review' };

/* ─────────────────────────────────────────────────────────────────────────────
   LESSON & MODULE
───────────────────────────────────────────────────────────────────────────── */

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  subtitle: string;
  order: number;
  learningObjective: string;
  estimatedMinutes: number;
  blocks: LessonBlock[];
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  order: number;
  emoji: string;
  level: string;
  color: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROGRESS
───────────────────────────────────────────────────────────────────────────── */

export type LessonStatus = 'pending' | 'in_progress' | 'completed';

export interface LessonProgress {
  lessonId: string;
  moduleId: string;
  status: LessonStatus;
  score?: number;
  total?: number;
  completedAt?: string;
  errorIds: string[];
}

export interface CourseProgress {
  lessons: Record<string, LessonProgress>;
}
