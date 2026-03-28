/**
 * GET /api/seed
 *
 * Populates Supabase tables from local courseData.ts.
 * - Modules and lessons: upsert on slug (safe to re-run)
 * - vocabulary_items / phrases: only inserts if the lesson has no rows yet
 *   (preserves any audio_url you've already set manually in Supabase)
 *
 * Add ?force=true to re-insert vocab/phrases even if rows exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MODULES, LESSONS } from '@/lib/courseData';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase env vars not set' }, { status: 500 });
  }

  const force = req.nextUrl.searchParams.get('force') === 'true';
  const db = createClient(url, key);
  const report: Record<string, unknown> = { force };

  // ── 1. Modules ──────────────────────────────────────────────────────────────
  const moduleRows = MODULES.map(m => ({
    slug: m.id,
    title_nl: m.title,
    title_es: m.subtitle ?? '',
    sort_order: m.order,
  }));

  const { data: insertedModules, error: modErr } = await db
    .from('modules')
    .upsert(moduleRows, { onConflict: 'slug' })
    .select('id, slug');

  if (modErr) {
    return NextResponse.json({ step: 'modules', error: modErr.message }, { status: 500 });
  }

  const moduleIdMap = new Map<string, number>(
    (insertedModules ?? []).map((m: { id: number; slug: string }) => [m.slug, m.id])
  );
  report.modules = `upserted ${moduleIdMap.size}`;

  // ── 2. Lessons ──────────────────────────────────────────────────────────────
  const lessonRows = LESSONS.map(l => ({
    slug: l.id,
    module_id: moduleIdMap.get(l.moduleId),
    title_nl: l.title,
    title_es: l.subtitle,
    sort_order: l.order,
    is_extra: l.isExtra ?? false,
  })).filter(r => r.module_id != null);

  const { data: insertedLessons, error: lesErr } = await db
    .from('lessons')
    .upsert(lessonRows, { onConflict: 'slug' })
    .select('id, slug');

  if (lesErr) {
    return NextResponse.json({ step: 'lessons', error: lesErr.message }, { status: 500 });
  }

  const lessonIdMap = new Map<string, number>(
    (insertedLessons ?? []).map((l: { id: number; slug: string }) => [l.slug, l.id])
  );
  report.lessons = `upserted ${lessonIdMap.size}`;

  // ── 3. Vocabulary items ─────────────────────────────────────────────────────
  let vocabInserted = 0;
  let vocabSkipped = 0;

  for (const lesson of LESSONS) {
    const lessonDbId = lessonIdMap.get(lesson.id);
    if (!lessonDbId) continue;

    const vocabBlocks = lesson.blocks.filter(
      (b): b is Extract<typeof b, { type: 'vocabulary' }> => b.type === 'vocabulary'
    );
    if (!vocabBlocks.length) continue;

    // Skip if rows already exist (preserves existing audio_url values)
    if (!force) {
      const { count } = await db
        .from('vocabulary_items')
        .select('id', { count: 'exact', head: true })
        .eq('lesson_id', lessonDbId);
      if ((count ?? 0) > 0) { vocabSkipped++; continue; }
    }

    const rows = vocabBlocks.flatMap((b, _bi) =>
      b.items.map((item, idx) => ({
        lesson_id: lessonDbId,
        sort_order: idx + 1,
        article: item.article ?? null,
        word_nl: item.dutch,
        translation_es: item.spanish,
        audio_url: null,
      }))
    );

    const { error } = await db.from('vocabulary_items').insert(rows);
    if (error) {
      report.vocab_error = `lesson ${lesson.id}: ${error.message}`;
    } else {
      vocabInserted += rows.length;
    }
  }

  report.vocabulary_items = `inserted ${vocabInserted} rows, skipped ${vocabSkipped} lessons (already had data)`;

  // ── 4. Phrases ──────────────────────────────────────────────────────────────
  let phrasesInserted = 0;
  let phrasesSkipped = 0;

  for (const lesson of LESSONS) {
    const lessonDbId = lessonIdMap.get(lesson.id);
    if (!lessonDbId) continue;

    const phraseBlocks = lesson.blocks.filter(
      (b): b is Extract<typeof b, { type: 'phrases' }> => b.type === 'phrases'
    );
    if (!phraseBlocks.length) continue;

    if (!force) {
      const { count } = await db
        .from('phrases')
        .select('id', { count: 'exact', head: true })
        .eq('lesson_id', lessonDbId);
      if ((count ?? 0) > 0) { phrasesSkipped++; continue; }
    }

    const rows = phraseBlocks.flatMap(b =>
      b.items.map((item, idx) => ({
        lesson_id: lessonDbId,
        sort_order: idx + 1,
        phrase_nl: item.dutch,
        translation_es: item.spanish,
        audio_url: null,
      }))
    );

    const { error } = await db.from('phrases').insert(rows);
    if (error) {
      report.phrases_error = `lesson ${lesson.id}: ${error.message}`;
    } else {
      phrasesInserted += rows.length;
    }
  }

  report.phrases = `inserted ${phrasesInserted} rows, skipped ${phrasesSkipped} lessons (already had data)`;
  report.done = true;

  return NextResponse.json(report, { status: 200 });
}
