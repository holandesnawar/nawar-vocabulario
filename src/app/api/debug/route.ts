import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  const info: Record<string, unknown> = {
    supabase_url_set: Boolean(url),
    supabase_key_set: Boolean(key),
    supabase_url_preview: url ? url.slice(0, 40) + '…' : null,
  };

  if (!url || !key) {
    return NextResponse.json({ ...info, error: 'env vars missing — check Vercel settings' }, { status: 200 });
  }

  const db = createClient(url, key);

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

  return NextResponse.json(info, { status: 200 });
}
