/**
 * supabaseService.ts
 *
 * Async functions that fetch course data from Supabase.
 * All functions return null if Supabase is unavailable or the query fails,
 * so callers can fall back to local mock data transparently.
 *
 * ID strategy
 * ───────────
 * Supabase uses numeric (or UUID) PKs internally.
 * Every module and lesson MUST also have a `slug` column with the
 * URL-friendly string identifier (e.g. 'over-jou', 'les-1-voorstellen').
 * All public lookups use slug; internal FK joins use the numeric id.
 *
 * Schema (tables & columns used):
 *
 *   modules            id (PK, numeric/uuid), slug TEXT UNIQUE,
 *                      title TEXT, subtitle TEXT, description TEXT,
 *                      sort_order INT, emoji TEXT, level TEXT, color TEXT
 *
 *   lessons            id (PK, numeric/uuid), module_id → modules.id,
 *                      slug TEXT UNIQUE, title TEXT, subtitle TEXT,
 *                      sort_order INT, is_extra BOOL DEFAULT false,
 *                      learning_objective TEXT, estimated_minutes INT
 *
 *   vocabulary_items   id (PK), lesson_id → lessons.id, sort_order INT,
 *                      dutch TEXT, spanish TEXT, article TEXT,
 *                      emoji TEXT, color TEXT, image TEXT,
 *                      audio_url TEXT, example_nl TEXT, example_es TEXT,
 *                      category TEXT, difficulty TEXT
 *
 *   phrases            id (PK), lesson_id → lessons.id, sort_order INT,
 *                      dutch TEXT, spanish TEXT, audio_url TEXT, context TEXT
 *
 *   practice_items     id (PK), lesson_id → lessons.id, sort_order INT,
 *                      type TEXT, prompt TEXT, correct_answer TEXT,
 *                      audio_url TEXT, hint TEXT, explanation TEXT
 *
 *   practice_options   id (PK), practice_item_id → practice_items.id,
 *                      sort_order INT, option_text TEXT
 *
 *   dialogues          id (PK), lesson_id → lessons.id,
 *                      title TEXT, context TEXT,
 *                      audio_url TEXT, slow_audio_url TEXT
 *
 *   dialogue_lines     id (PK), dialogue_id → dialogues.id, sort_order INT,
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
// `id` is the internal PK (numeric or uuid — we treat it as unknown / opaque).
// `slug` is the public URL-friendly identifier the app routes use.

type DbId = string | number;

interface DbModule {
  id: DbId;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  sort_order: number;
  emoji: string;
  level: string;
  color: string;
}

interface DbLesson {
  id: DbId;
  module_id: DbId;
  slug: string;
  title: string;
  subtitle: string;
  sort_order: number;
  is_extra: boolean;
  learning_objective: string;
  estimated_minutes: number;
}

interface DbVocabularyItem {
  id: DbId;
  lesson_id: DbId;
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
  id: DbId;
  lesson_id: DbId;
  sort_order: number;
  dutch: string;
  spanish: string;
  audio_url: string | null;
  context: string | null;
}

interface DbPracticeItem {
  id: DbId;
  lesson_id: DbId;
  sort_order: number;
  type: string;
  prompt: string;
  correct_answer: string;
  audio_url: string | null;
  hint: string | null;
  explanation: string | null;
}

interface DbPracticeOption {
  id: DbId;
  practice_item_id: DbId;
  sort_order: number;
  option_text: string;
}

interface DbDialogue {
  id: DbId;
  lesson_id: DbId;
  title: string;
  context: string;
  audio_url: string | null;
  slow_audio_url: string | null;
}

interface DbDialogueLine {
  id: DbId;
  dialogue_id: DbId;
  sort_order: number;
  speaker: string;
  dutch: string;
  spanish: string;
  audio_url: string | null;
}

// ── Mapping Functions ──────────────────────────────────────────────────────────

function mapModule(row: DbModule): CourseModule {
  return {
    id: row.slug,              // slug is the public identifier used in routes
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    description: row.description,
    order: row.sort_order,
    emoji: row.emoji,
    level: row.level,
    color: row.color,
  };
}

// moduleSlug must be passed in because the lesson row only stores module_id (numeric FK)
function mapLessonMeta(row: DbLesson, moduleSlug: string): Lesson {
  return {
    id: row.slug,              // slug is the public identifier used in routes
    moduleId: moduleSlug,
    title: row.title,
    subtitle: row.subtitle,
    order: row.sort_order,
    isExtra: row.is_extra,
    learningObjective: row.learning_objective,
    estimatedMinutes: row.estimated_minutes,
    blocks: [],                // Not loaded for list views — fetchLesson loads blocks
  };
}

function mapVocabularyItem(row: DbVocabularyItem): VocabularyItem {
  return {
    id: String(row.id),
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
    id: String(row.id),
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
    id: String(row.id),
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
    id: String(row.id),
    title: row.title,
    context: row.context,
    audio: row.audio_url ? { url: row.audio_url } : undefined,
    slowAudio: row.slow_audio_url ? { url: row.slow_audio_url } : undefined,
    lines: lines
      .filter(l => l.dialogue_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(l => ({
        id: String(l.id),
        speaker: l.speaker,
        dutch: l.dutch,
        spanish: l.spanish,
        audio: l.audio_url ? { url: l.audio_url } : undefined,
      })),
  };
}

// ── Internal: build a full Lesson with blocks from DB ─────────────────────────

async function assembleLessonBlocks(lessonRow: DbLesson, moduleSlug: string): Promise<Lesson> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const db = supabase!;
  const lessonDbId = lessonRow.id; // numeric/uuid PK — used for FK joins

  // Round 1: fetch all content tables in parallel (join via internal numeric id)
  const [
    { data: vocabRows },
    { data: phraseRows },
    { data: practiceRows },
    { data: dialogueRows },
  ] = await Promise.all([
    db.from('vocabulary_items').select('*').eq('lesson_id', lessonDbId).order('sort_order'),
    db.from('phrases').select('*').eq('lesson_id', lessonDbId).order('sort_order'),
    db.from('practice_items').select('*').eq('lesson_id', lessonDbId).order('sort_order'),
    db.from('dialogues').select('*').eq('lesson_id', lessonDbId),
  ]);

  // Round 2: fetch dependent rows filtered by parent numeric IDs
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

  // Assemble blocks: vocabulary → phrases → dialogue → practice → review
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
    ...mapLessonMeta(lessonRow, moduleSlug),
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

/** Looks up a module by its slug (e.g. 'over-jou'), not by numeric id. */
export async function fetchModule(slug: string): Promise<CourseModule | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error || !data) return null;
    return mapModule(data as DbModule);
  } catch {
    return null;
  }
}

/**
 * Returns lesson metadata (no blocks) for a module — suitable for list views.
 * Looks up the module by slug first, then fetches lessons via the numeric FK.
 * Pass extrasOnly=true to get only extra lessons.
 */
export async function fetchLessonsForModule(
  moduleSlug: string,
  extrasOnly = false
): Promise<Lesson[] | null> {
  if (!supabase) return null;
  try {
    // Step 1: resolve the module's internal numeric id
    const { data: moduleRow, error: moduleErr } = await supabase
      .from('modules')
      .select('id')
      .eq('slug', moduleSlug)
      .single();
    if (moduleErr || !moduleRow) return null;

    // Step 2: fetch lessons by numeric FK
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('module_id', (moduleRow as DbModule).id)
      .eq('is_extra', extrasOnly)
      .order('sort_order');
    if (error || !data?.length) return null;

    return (data as DbLesson[]).map(row => mapLessonMeta(row, moduleSlug));
  } catch {
    return null;
  }
}

/**
 * Returns a fully assembled Lesson (with all blocks).
 * Looks up lesson by its slug and validates it belongs to the given module slug.
 */
export async function fetchLesson(moduleSlug: string, lessonSlug: string): Promise<Lesson | null> {
  if (!supabase) return null;
  try {
    // Step 1: resolve the module's internal id
    const { data: moduleRow, error: moduleErr } = await supabase
      .from('modules')
      .select('id')
      .eq('slug', moduleSlug)
      .single();
    if (moduleErr || !moduleRow) return null;

    // Step 2: fetch lesson by slug + module FK
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('slug', lessonSlug)
      .eq('module_id', (moduleRow as DbModule).id)
      .single();
    if (error || !data) return null;

    return assembleLessonBlocks(data as DbLesson, moduleSlug);
  } catch {
    return null;
  }
}
