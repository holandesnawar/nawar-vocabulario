/**
 * supabaseService.ts
 *
 * Fetches course data from Supabase using the real column names.
 * Returns null on any failure so callers fall back to local mock data.
 *
 * Merge strategy
 * ──────────────
 * Supabase stores identifiers + audio_url (minimal schema).
 * Local courseData.ts stores the rich display fields (emoji, color, examples…).
 * For each entity we merge both sources:
 *   - Text content + audio_url  → from Supabase (source of truth)
 *   - Display fields (emoji, color, exampleNl…) → from local, matched by text
 *
 * Real Supabase column names (do NOT rename):
 *
 *   modules          id, slug, title_nl, title_es, sort_order
 *   lessons          id, module_id, slug, title_nl, title_es, sort_order, is_extra
 *   vocabulary_items id, lesson_id, sort_order, article, word_nl, translation_es, audio_url
 *   phrases          id, lesson_id, sort_order, phrase_nl, translation_es, audio_url
 *   practice_items   id, lesson_id, sort_order, type, prompt, correct_answer, audio_url, hint, explanation
 *   practice_options id, practice_item_id, sort_order, option_text
 *   dialogues        id, lesson_id, title, context, audio_url, slow_audio_url
 *   dialogue_lines   id, dialogue_id, sort_order, speaker, dutch, spanish, audio_url
 */

import { supabaseAdmin as supabase } from './supabaseAdmin';
import { MODULES, LESSONS } from './courseData';
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

type DbId = string | number;

interface DbModule {
  id: DbId;
  slug: string;
  title_nl: string;
  title_es: string;
  sort_order: number;
}

interface DbLesson {
  id: DbId;
  module_id: DbId;
  slug: string;
  title_nl: string;
  title_es: string;
  sort_order: number;
  is_extra: boolean;
}

interface DbVocabularyItem {
  id: DbId;
  lesson_id: DbId;
  sort_order: number;
  article: string | null;
  word_nl: string;
  translation_es: string;
  audio_url: string | null;
}

interface DbPhrase {
  id: DbId;
  lesson_id: DbId;
  sort_order: number;
  phrase_nl: string;
  translation_es: string;
  audio_url: string | null;
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

/**
 * Map a module row.
 * Display-only fields (emoji, color, description, level) come from local data
 * matched by slug — those columns don't exist in Supabase.
 */
function mapModule(row: DbModule): CourseModule {
  const local = MODULES.find(m => m.id === row.slug);
  return {
    id: row.slug,
    title: row.title_nl,
    subtitle: row.title_es || undefined,
    description: local?.description ?? '',
    order: row.sort_order,
    emoji: local?.emoji ?? '',
    level: local?.level ?? '',
    color: local?.color ?? '#1D0084',
  };
}

/**
 * Map a lesson row (no blocks).
 * Display-only fields (learningObjective, estimatedMinutes, subtitle) come
 * from local data if not present in Supabase.
 */
function mapLessonMeta(row: DbLesson, moduleSlug: string): Lesson {
  const local = LESSONS.find(l => l.id === row.slug);
  return {
    id: row.slug,
    moduleId: moduleSlug,
    title: row.title_nl,
    subtitle: row.title_es || local?.subtitle || '',
    order: row.sort_order,
    isExtra: row.is_extra,
    learningObjective: local?.learningObjective ?? '',
    estimatedMinutes: local?.estimatedMinutes ?? 0,
    blocks: [],
  };
}

/**
 * Map a vocabulary_item row.
 * Supabase provides: word_nl, translation_es, article, audio_url.
 * Local data fills in: emoji, color, exampleNl, exampleEs, category, difficulty.
 * audio_url from Supabase takes priority over any local audio.
 */
function mapVocabularyItem(
  row: DbVocabularyItem,
  localItems: VocabularyItem[]
): VocabularyItem {
  const local = localItems.find(v => v.dutch === row.word_nl);
  return {
    id: local?.id ?? String(row.id),
    dutch: row.word_nl,
    spanish: row.translation_es,
    article: row.article as Article,
    emoji: local?.emoji ?? '',
    color: local?.color ?? '#1D0084',
    image: local?.image,
    audio: row.audio_url ? { url: row.audio_url } : local?.audio,
    exampleNl: local?.exampleNl ?? '',
    exampleEs: local?.exampleEs ?? '',
    category: local?.category ?? '',
    difficulty: (local?.difficulty ?? 'A1') as Difficulty,
  };
}

/**
 * Map a phrase row.
 * Supabase provides: phrase_nl, translation_es, audio_url.
 * Local data fills in: context.
 * audio_url from Supabase takes priority over any local audio.
 */
function mapPhrase(row: DbPhrase, localItems: PhraseItem[]): PhraseItem {
  const local = localItems.find(p => p.dutch === row.phrase_nl);
  return {
    id: local?.id ?? String(row.id),
    dutch: row.phrase_nl,
    spanish: row.translation_es,
    audio: row.audio_url ? { url: row.audio_url } : local?.audio,
    context: local?.context,
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

// ── Internal: assemble full Lesson with blocks ────────────────────────────────

async function assembleLessonBlocks(lessonRow: DbLesson, moduleSlug: string): Promise<Lesson> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const db = supabase!;
  const lessonDbId = lessonRow.id;

  // Local lesson for merging display-only fields
  const localLesson = LESSONS.find(l => l.id === lessonRow.slug);
  const localVocab = localLesson?.blocks
    .filter((b): b is Extract<typeof b, { type: 'vocabulary' }> => b.type === 'vocabulary')
    .flatMap(b => b.items) ?? [];
  const localPhrases = localLesson?.blocks
    .filter((b): b is Extract<typeof b, { type: 'phrases' }> => b.type === 'phrases')
    .flatMap(b => b.items) ?? [];

  // Round 1: parallel fetch
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

  // Round 2: dependent rows
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

  // Assemble blocks
  const blocks: LessonBlock[] = [];

  if (vocabRows?.length) {
    blocks.push({
      type: 'vocabulary',
      items: (vocabRows as DbVocabularyItem[]).map(r => mapVocabularyItem(r, localVocab)),
    });
  }
  if (phraseRows?.length) {
    blocks.push({
      type: 'phrases',
      items: (phraseRows as DbPhrase[]).map(r => mapPhrase(r, localPhrases)),
    });
  }
  if (dialogueRows?.length) {
    blocks.push({
      type: 'dialogue',
      dialogue: mapDialogue(dialogueRows[0] as DbDialogue, (lineRows ?? []) as DbDialogueLine[]),
    });
  } else if (localLesson) {
    const localDialogue = localLesson.blocks.find(b => b.type === 'dialogue');
    if (localDialogue) blocks.push(localDialogue);
  }
  if (practiceRows?.length) {
    const knownTypes = ['multiple_choice', 'write_answer', 'listen_and_choose', 'order_sentence', 'fill_blank'];
    const exercises = (practiceRows as DbPracticeItem[])
      .map(r => mapExercise(r, (optionRows ?? []) as DbPracticeOption[]))
      .filter(e => e.prompt && knownTypes.includes(e.type));
    if (exercises.length > 0) {
      blocks.push({ type: 'practice', exercises });
    } else if (localLesson) {
      const localPractice = localLesson.blocks.find(b => b.type === 'practice');
      if (localPractice) blocks.push(localPractice);
    }
  } else if (localLesson) {
    const localPractice = localLesson.blocks.find(b => b.type === 'practice');
    if (localPractice) blocks.push(localPractice);
  }
  blocks.push({ type: 'review' });

  return { ...mapLessonMeta(lessonRow, moduleSlug), blocks };
}

// ── Public Fetch Functions ─────────────────────────────────────────────────────

export async function fetchModules(): Promise<CourseModule[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('modules')
      .select('id, slug, title_nl, title_es, sort_order')
      .order('sort_order');
    if (error || !data?.length) return null;
    return (data as DbModule[]).map(mapModule);
  } catch {
    return null;
  }
}

export async function fetchModule(slug: string): Promise<CourseModule | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('modules')
      .select('id, slug, title_nl, title_es, sort_order')
      .eq('slug', slug)
      .single();
    if (error || !data) return null;
    return mapModule(data as DbModule);
  } catch {
    return null;
  }
}

export async function fetchLessonsForModule(
  moduleSlug: string,
  extrasOnly = false
): Promise<Lesson[] | null> {
  if (!supabase) return null;
  try {
    const { data: moduleRow, error: moduleErr } = await supabase
      .from('modules')
      .select('id')
      .eq('slug', moduleSlug)
      .single();
    if (moduleErr || !moduleRow) return null;

    const { data, error } = await supabase
      .from('lessons')
      .select('id, module_id, slug, title_nl, title_es, sort_order, is_extra')
      .eq('module_id', (moduleRow as DbModule).id)
      .eq('is_extra', extrasOnly)
      .order('sort_order');
    if (error || !data?.length) return null;

    return (data as DbLesson[]).map(row => mapLessonMeta(row, moduleSlug));
  } catch {
    return null;
  }
}

export async function fetchLesson(moduleSlug: string, lessonSlug: string): Promise<Lesson | null> {
  if (!supabase) return null;
  try {
    const { data: moduleRow, error: moduleErr } = await supabase
      .from('modules')
      .select('id')
      .eq('slug', moduleSlug)
      .single();
    if (moduleErr || !moduleRow) return null;

    const { data, error } = await supabase
      .from('lessons')
      .select('id, module_id, slug, title_nl, title_es, sort_order, is_extra')
      .eq('slug', lessonSlug)
      .eq('module_id', (moduleRow as DbModule).id)
      .single();
    if (error || !data) return null;

    return assembleLessonBlocks(data as DbLesson, moduleSlug);
  } catch {
    return null;
  }
}
