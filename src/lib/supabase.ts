import { createClient } from '@supabase/supabase-js';

/*
  Supabase client — ready for future migration from mock data.

  Set these in .env.local:
    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxx

  Schema (reference):

  modules           id, slug, title_nl, title_es, sort_order
  lessons           id, module_id, slug, title_nl, title_es, sort_order, is_extra
  vocabulary_items  id, lesson_id, sort_order, article, word_nl, translation_es, audio_url
  phrases           id, lesson_id, sort_order, phrase_nl, translation_es, audio_url
  practice_items    id, lesson_id, sort_order, type, question_text, hint, correct_answer, explanation
  practice_options  id, practice_item_id, sort_order, option_text, is_correct
  dialogues         id, lesson_id, title, audio_normal_url, audio_slow_url
  dialogue_lines    id, dialogue_id, sort_order, speaker, text_nl, text_es

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
