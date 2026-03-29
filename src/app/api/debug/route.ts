import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  const info: Record<string, unknown> = {
    supabase_url_set: Boolean(url),
    service_key_set: Boolean(serviceKey),
    anon_key_set: Boolean(anonKey),
    supabase_url_preview: url ? url.slice(0, 40) + '…' : null,
  };

  if (!url || !serviceKey) {
    return NextResponse.json({ ...info, error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 200 });
  }

  // Use service role key so RLS doesn't hide data
  const db = createClient(url, serviceKey);

  // modules: id, slug, title_nl, title_es, sort_order
  try {
    const { data, error } = await db
      .from('modules')
      .select('id, slug, title_nl, title_es, sort_order')
      .limit(5);
    info.modules = error ? { error: error.message } : data;
  } catch (e) {
    info.modules = { exception: String(e) };
  }

  // lessons: id, module_id, slug, title_nl, title_es, sort_order, is_extra
  try {
    const { data, error } = await db
      .from('lessons')
      .select('id, module_id, slug, title_nl, title_es, sort_order, is_extra')
      .limit(5);
    info.lessons = error ? { error: error.message } : data;
  } catch (e) {
    info.lessons = { exception: String(e) };
  }

  // vocabulary_items: id, lesson_id, sort_order, article, word_nl, translation_es, audio_url
  try {
    const { data, error } = await db
      .from('vocabulary_items')
      .select('id, lesson_id, sort_order, article, word_nl, translation_es, audio_url')
      .limit(5);
    info.vocabulary_items = error ? { error: error.message } : data;
  } catch (e) {
    info.vocabulary_items = { exception: String(e) };
  }

  // phrases: id, lesson_id, sort_order, phrase_nl, translation_es, audio_url
  try {
    const { data, error } = await db
      .from('phrases')
      .select('id, lesson_id, sort_order, phrase_nl, translation_es, audio_url')
      .limit(5);
    info.phrases = error ? { error: error.message } : data;
  } catch (e) {
    info.phrases = { exception: String(e) };
  }

  // dialogues + dialogue_lines: show actual column names
  try {
    const { data, error } = await db.from('dialogues').select('*').limit(2);
    info.dialogues = error ? { error: error.message } : data;
  } catch (e) {
    info.dialogues = { exception: String(e) };
  }

  try {
    const { data, error } = await db.from('dialogue_lines').select('*').limit(3);
    info.dialogue_lines = error ? { error: error.message } : data;
  } catch (e) {
    info.dialogue_lines = { exception: String(e) };
  }

  return NextResponse.json(info, { status: 200 });
}
