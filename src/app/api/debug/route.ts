import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  const info: Record<string, unknown> = {
    supabase_url_set: Boolean(url),
    supabase_key_set: Boolean(key),
    supabase_url_preview: url ? url.slice(0, 30) + '…' : null,
  };

  if (!url || !key) {
    return NextResponse.json({ ...info, error: 'env vars missing' }, { status: 200 });
  }

  const db = createClient(url, key);

  // 1. modules table — check columns and data
  try {
    const { data: modules, error } = await db
      .from('modules')
      .select('id, slug, title')
      .limit(5);
    info.modules = error ? { error: error.message } : modules;
  } catch (e) {
    info.modules = { exception: String(e) };
  }

  // 2. lessons table — check columns and data
  try {
    const { data: lessons, error } = await db
      .from('lessons')
      .select('id, module_id, slug, title')
      .limit(5);
    info.lessons = error ? { error: error.message } : lessons;
  } catch (e) {
    info.lessons = { exception: String(e) };
  }

  // 3. vocabulary_items — check audio_url column
  try {
    const { data: vocab, error } = await db
      .from('vocabulary_items')
      .select('id, lesson_id, dutch, audio_url')
      .limit(5);
    info.vocabulary_items = error ? { error: error.message } : vocab;
  } catch (e) {
    info.vocabulary_items = { exception: String(e) };
  }

  // 4. phrases — check audio_url column
  try {
    const { data: phrases, error } = await db
      .from('phrases')
      .select('id, lesson_id, dutch, audio_url')
      .limit(5);
    info.phrases = error ? { error: error.message } : phrases;
  } catch (e) {
    info.phrases = { exception: String(e) };
  }

  return NextResponse.json(info, { status: 200 });
}
