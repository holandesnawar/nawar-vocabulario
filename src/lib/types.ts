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
  | 'write_answer'
  | 'fill_blank'
  | 'word_scramble'
  | 'match_pairs'
  | 'true_false'   // declaración V/F con 2 botones grandes
  | 'emoji_choice' // elegir el emoji correcto entre 4
  | 'odd_one_out'  // 4 palabras, una no pertenece
  | 'letter_dash'    // palabra con letras faltantes (k_ff_e → koffie)
  | 'pair_memory'    // memory cards: emparejar NL↔ES girando cartas
  | 'listen_translate'; // escucha frase NL, compone traducción ES con chips

export interface ExerciseItem {
  id: string;
  type: ExerciseType;
  prompt: string;
  options?: string[];
  correctAnswer: string;
  audio?: AudioTrack;
  hint?: string;
  explanation?: string;
  pairs?: { left: string; right: string }[];  // for match_pairs
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
  slowAudio?: AudioTrack;
  lines: DialogueLine[];
}

/* ─────────────────────────────────────────────────────────────────────────────
   LESSON BLOCKS — discriminated union
───────────────────────────────────────────────────────────────────────────── */

export interface LezenBlock {
  type: 'lezen';
  title?: string;
  textNl: string;
  textEs: string;
  exercises: ExerciseItem[];
}

export interface SummarySectionData {
  heading: string;
  body?: string;          // texto libre en markdown ligero (negritas **texto**)
  items?: Array<{ nl?: string; es: string }>; // vocabulario/frases clave de la sección
}

export interface SummaryBlock {
  type: 'summary';
  title?: string;
  intro?: string;
  objectives?: string[];
  sections: SummarySectionData[];
  tip?: string;
}

export type LessonBlock =
  | SummaryBlock
  | { type: 'vocabulary'; title?: string; items: VocabularyItem[] }
  | { type: 'phrases';    title?: string; items: PhraseItem[] }
  | { type: 'practice';   title?: string; exercises: ExerciseItem[] }
  | { type: 'dialogue';   title?: string; dialogue: Dialogue }
  | LezenBlock
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
  isExtra?: boolean;
  learningObjective: string;
  estimatedMinutes: number;
  blocks: LessonBlock[];
}

export interface CourseModule {
  id: string;
  title: string;
  subtitle?: string;
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
