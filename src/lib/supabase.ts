import { createClient } from '@supabase/supabase-js';

/*
  Supabase client — progressive migration layer.

  Set these in .env.local:
    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxx

  When env vars are absent (local/mock development), supabase is null and the
  app falls back to the local courseData.ts mock data automatically.

  Schema (full column definitions):

  modules
    id TEXT PK, title TEXT, subtitle TEXT, description TEXT,
    sort_order INT, emoji TEXT, level TEXT, color TEXT

  lessons
    id TEXT PK, module_id TEXT → modules.id,
    title TEXT, subtitle TEXT, sort_order INT, is_extra BOOL DEFAULT false,
    learning_objective TEXT, estimated_minutes INT

  vocabulary_items
    id TEXT PK, lesson_id TEXT → lessons.id, sort_order INT,
    dutch TEXT, spanish TEXT, article TEXT ('de'|'het'|null),
    emoji TEXT, color TEXT, image TEXT, audio_url TEXT,
    example_nl TEXT, example_es TEXT, category TEXT,
    difficulty TEXT ('A0'|'A1'|'A2')

  phrases
    id TEXT PK, lesson_id TEXT → lessons.id, sort_order INT,
    dutch TEXT, spanish TEXT, audio_url TEXT, context TEXT

  practice_items
    id TEXT PK, lesson_id TEXT → lessons.id, sort_order INT,
    type TEXT, prompt TEXT, correct_answer TEXT,
    audio_url TEXT, hint TEXT, explanation TEXT

  practice_options
    id TEXT PK, practice_item_id TEXT → practice_items.id,
    sort_order INT, option_text TEXT

  dialogues
    id TEXT PK, lesson_id TEXT → lessons.id,
    title TEXT, context TEXT, audio_url TEXT, slow_audio_url TEXT

  dialogue_lines
    id TEXT PK, dialogue_id TEXT → dialogues.id, sort_order INT,
    speaker TEXT, dutch TEXT, spanish TEXT, audio_url TEXT

  Flashcards reuse vocabulary_items — no separate table needed.
  Audio is read from audio_url fields using the existing AudioPlayer component.
*/

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Only create a real client when env vars are present.
// During local/mock development, supabase will be null.
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseEnabled = Boolean(supabase);
