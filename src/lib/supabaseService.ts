/**
 * supabaseService.ts
 *
 * Async functions that fetch course data from Supabase.
 * All functions return null if Supabase is unavailable or the query fails,
 * so callers can fall back to local mock data transparently.
 *
 * Schema (tables & columns used):
 *
 *   modules            id TEXT PK, title TEXT, subtitle TEXT, description TEXT,
 *                      sort_order INT, emoji TEXT, level TEXT, color TEXT
 *
 *   lessons            id TEXT PK, module_id TEXT, title TEXT, subtitle TEXT,
 *                      sort_order INT, is_extra BOOL, learning_objective TEXT,
 *                      estimated_minutes INT
 *
 *   vocabulary_items   id TEXT PK, lesson_id TEXT, sort_order INT,
 *                      dutch TEXT, spanish TEXT, article TEXT,
 *                      emoji TEXT, color TEXT, image TEXT,
 *                      audio_url TEXT, example_nl TEXT, example_es TEXT,
 *                      category TEXT, difficulty TEXT
 *
 *   phrases            id TEXT PK, lesson_id TEXT, sort_order INT,
 *                      dutch TEXT, spanish TEXT, audio_url TEXT, context TEXT
 *
 *   practice_items     id TEXT PK, lesson_id TEXT, sort_order INT,
 *                      type TEXT, prompt TEXT, correct_answer TEXT,
 *                      audio_url TEXT, hint TEXT, explanation TEXT
 *
 *   practice_options   id TEXT PK, practice_item_id TEXT, sort_order INT,
 *                      option_text TEXT
 *
 *   dialogues          id TEXT PK, lesson_id TEXT, title TEXT, context TEXT,
 *                      audio_url TEXT, slow_audio_url TEXT
 *
 *   dialogue_lines     id TEXT PK, dialogue_id TEXT, sort_order INT,
 *                      speaker TEXT, dutch TEXT, spanish TEXT, audio_url TEXT
 */

import { supabase } from './supabase';
import type {
  CourseModule,
  Lesson,
  LessonBlock,
  VocabularyItem,
  PhraseItem,
  ExerciseItem,
  Dialogue,
  Article,
  Difficulty,
  ExerciseType,
} from './types';

// ── DB Row Types ───────────────────────────────────────────────────────────────

interface DbModule {
  id: string;
  title: string;
  subtitle: string | null;
  description: string;
  sort_order: number;
  emoji: string;
  level: string;
  color: string;
}

interface DbLesson {
  id: string;
  module_id: string;
  title: string;
  subtitle: string;
  sort_order: number;
  is_extra: boolean;
  learning_objective: string;
  estimated_minutes: number;
}

interface DbVocabularyItem {
  id: string;
  lesson_id: string;
  sort_order: number;
  dutch: string;
  spanish: string;
  article: string | null;
  emoji: string;
  color: string;
  image: string | null;
  audio_url: string | null;
  example_nl: string;
  example_es: string;
  category: string;
  difficulty: string;
}

interface DbPhrase {
  id: string;
  lesson_id: string;
  sort_order: number;
  dutch: string;
  spanish: string;
  audio_url: string | null;
  context: string | null;
}

interface DbPracticeItem {
  id: string;
  lesson_id: string;
  sort_order: number;
  type: string;
  prompt: string;
  correct_answer: string;
  audio_url: string | null;
  hint: string | null;
  explanation: string | null;
}

interface DbPracticeOption {
  id: string;
  practice_item_id: string;
  sort_order: number;
  option_text: string;
}

interface DbDialogue {
  id: string;
  lesson_id: string;
  title: string;
  context: string;
  audio_url: string | null;
  slow_audio_url: string | null;
}

interface DbDialogueLine {
  id: string;
  dialogue_id: string;
  sort_order: number;
  speaker: string;
  dutch: string;
  spanish: string;
  audio_url: string | null;
}

// ── Mapping Functions ──────────────────────────────────────────────────────────

function mapModule(row: DbModule): CourseModule {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    description: row.description,
    order: row.sort_order,
    emoji: row.emoji,
    level: row.level,
    color: row.color,
  };
}

function mapLessonMeta(row: DbLesson): Lesson {
  return {
    id: row.id,
    moduleId: row.module_id,
    title: row.title,
    subtitle: row.subtitle,
    order: row.sort_order,
    isExtra: row.is_extra,
    learningObjective: row.learning_objective,
    estimatedMinutes: row.estimated_minutes,
    blocks: [], // Not loaded for list views — only fetchLesson loads blocks
  };
}

function mapVocabularyItem(row: DbVocabularyItem): VocabularyItem {
  return {
    id: row.id,
    dutch: row.dutch,
    spanish: row.spanish,
    article: row.article as Article,
    emoji: row.emoji,
    color: row.color,
    image: row.image ?? undefined,
    audio: row.audio_url ? { url: row.audio_url } : undefined,
    exampleNl: row.example_nl,
    exampleEs: row.example_es,
    category: row.category,
    difficulty: row.difficulty as Difficulty,
  };
}

function mapPhrase(row: DbPhrase): PhraseItem {
  return {
    id: row.id,
    dutch: row.dutch,
    spanish: row.spanish,
    audio: row.audio_url ? { url: row.audio_url } : undefined,
    context: row.context ?? undefined,
  };
}

function mapExercise(row: DbPracticeItem, options: DbPracticeOption[]): ExerciseItem {
  const itemOptions = options
    .filter(o => o.practice_item_id === row.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(o => o.option_text);

  return {
    id: row.id,
    type: row.type as ExerciseType,
    prompt: row.prompt,
    options: itemOptions.length > 0 ? itemOptions : undefined,
    correctAnswer: row.correct_answer,
    audio: row.audio_url ? { url: row.audio_url } : undefined,
    hint: row.hint ?? undefined,
    explanation: row.explanation ?? undefined,
  };
}

function mapDialogue(row: DbDialogue, lines: DbDialogueLine[]): Dialogue {
  return {
    id: row.id,
    title: row.title,
    context: row.context,
    audio: row.audio_url ? { url: row.audio_url } : undefined,
    slowAudio: row.slow_audio_url ? { url: row.slow_audio_url } : undefined,
    lines: lines
      .filter(l => l.dialogue_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(l => ({
        id: l.id,
        speaker: l.speaker,
        dutch: l.dutch,
        spanish: l.spanish,
        audio: l.audio_url ? { url: l.audio_url } : undefined,
      })),
  };
}

// ── Internal: build a full Lesson with blocks from DB ─────────────────────────

async function assembleLessonBlocks(lessonRow: DbLesson): Promise<Lesson> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const db = supabase!;
  const lessonId = lessonRow.id;

  // Round 1: fetch all content tables in parallel
  const [
    { data: vocabRows },
    { data: phraseRows },
    { data: practiceRows },
    { data: dialogueRows },
  ] = await Promise.all([
    db.from('vocabulary_items').select('*').eq('lesson_id', lessonId).order('sort_order'),
    db.from('phrases').select('*').eq('lesson_id', lessonId).order('sort_order'),
    db.from('practice_items').select('*').eq('lesson_id', lessonId).order('sort_order'),
    db.from('dialogues').select('*').eq('lesson_id', lessonId),
  ]);

  // Round 2: fetch dependent rows (options + lines), filtered by parent IDs
  const practiceItemIds = (practiceRows ?? []).map((r: DbPracticeItem) => r.id);
  const dialogueIds = (dialogueRows ?? []).map((r: DbDialogue) => r.id);

  const [{ data: optionRows }, { data: lineRows }] = await Promise.all([
    practiceItemIds.length
      ? db.from('practice_options').select('*').in('practice_item_id', practiceItemIds).order('sort_order')
      : Promise.resolve({ data: [] as DbPracticeOption[] }),
    dialogueIds.length
      ? db.from('dialogue_lines').select('*').in('dialogue_id', dialogueIds).order('sort_order')
      : Promise.resolve({ data: [] as DbDialogueLine[] }),
  ]);

  // Assemble blocks in standard order: vocabulary → phrases → dialogue → practice → review
  const blocks: LessonBlock[] = [];

  if (vocabRows?.length) {
    blocks.push({ type: 'vocabulary', items: (vocabRows as DbVocabularyItem[]).map(mapVocabularyItem) });
  }
  if (phraseRows?.length) {
    blocks.push({ type: 'phrases', items: (phraseRows as DbPhrase[]).map(mapPhrase) });
  }
  if (dialogueRows?.length) {
    blocks.push({
      type: 'dialogue',
      dialogue: mapDialogue(dialogueRows[0] as DbDialogue, (lineRows ?? []) as DbDialogueLine[]),
    });
  }
  if (practiceRows?.length) {
    blocks.push({
      type: 'practice',
      exercises: (practiceRows as DbPracticeItem[]).map(row =>
        mapExercise(row, (optionRows ?? []) as DbPracticeOption[])
      ),
    });
  }
  blocks.push({ type: 'review' });

  return {
    ...mapLessonMeta(lessonRow),
    blocks,
  };
}

// ── Public Fetch Functions ─────────────────────────────────────────────────────

/** Returns all modules sorted by sort_order, or null if unavailable. */
export async function fetchModules(): Promise<CourseModule[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('modules').select('*').order('sort_order');
    if (error || !data?.length) return null;
    return (data as DbModule[]).map(mapModule);
  } catch {
    return null;
  }
}

/** Returns a single module by id, or null if not found / unavailable. */
export async function fetchModule(id: string): Promise<CourseModule | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('modules').select('*').eq('id', id).single();
    if (error || !data) return null;
    return mapModule(data as DbModule);
  } catch {
    return null;
  }
}

/**
 * Returns lesson metadata (no blocks) for a module — suitable for list views.
 * Pass extrasOnly=true to get only extra lessons.
 */
export async function fetchLessonsForModule(
  moduleId: string,
  extrasOnly = false
): Promise<Lesson[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('module_id', moduleId)
      .eq('is_extra', extrasOnly)
      .order('sort_order');
    if (error || !data?.length) return null;
    return (data as DbLesson[]).map(mapLessonMeta);
  } catch {
    return null;
  }
}

/**
 * Returns a fully assembled Lesson (with all blocks) by moduleId + lessonId,
 * or null if not found / unavailable.
 */
export async function fetchLesson(moduleId: string, lessonId: string): Promise<Lesson | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .eq('module_id', moduleId)
      .single();
    if (error || !data) return null;
    return assembleLessonBlocks(data as DbLesson);
  } catch {
    return null;
  }
}
