/**
 * GET /api/seed
 *
 * Populates Supabase tables from local courseData.ts.
 * Does NOT require UNIQUE constraints — checks for existing rows first.
 * Skips vocab/phrases for lessons that already have data (preserves audio_url).
 * Use ?force=true to delete all content rows and re-insert from scratch.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MODULES, LESSONS } from '@/lib/courseData';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase env vars not set' }, { status: 500 });
  }

  const force = req.nextUrl.searchParams.get('force') === 'true';
  const db = createClient(supabaseUrl, supabaseKey);
  const report: Record<string, unknown> = { force };

  // ── 1. Modules ──────────────────────────────────────────────────────────────
  // Fetch existing modules so we can skip already-inserted ones
  const { data: existingModules } = await db.from('modules').select('id, slug');
  const existingModuleSlugs = new Set((existingModules ?? []).map((m: { slug: string }) => m.slug));

  const newModuleRows = MODULES
    .filter(m => !existingModuleSlugs.has(m.id))
    .map(m => ({
      slug: m.id,
      title_nl: m.title,
      title_es: m.subtitle ?? '',
      sort_order: m.order,
    }));

  if (newModuleRows.length > 0) {
    const { error } = await db.from('modules').insert(newModuleRows);
    if (error) return NextResponse.json({ step: 'modules insert', error: error.message }, { status: 500 });
  }

  // Fetch all modules (existing + just inserted) to build slug → id map
  const { data: allModules, error: allModErr } = await db.from('modules').select('id, slug');
  if (allModErr) return NextResponse.json({ step: 'modules select', error: allModErr.message }, { status: 500 });

  const moduleIdMap = new Map<string, number>(
    (allModules ?? []).map((m: { id: number; slug: string }) => [m.slug, m.id])
  );
  report.modules = `total ${moduleIdMap.size} (inserted ${newModuleRows.length} new)`;

  // ── 2. Lessons ──────────────────────────────────────────────────────────────
  const { data: existingLessons } = await db.from('lessons').select('id, slug');
  const existingLessonSlugs = new Set((existingLessons ?? []).map((l: { slug: string }) => l.slug));

  const newLessonRows = LESSONS
    .filter(l => !existingLessonSlugs.has(l.id) && moduleIdMap.has(l.moduleId))
    .map(l => ({
      slug: l.id,
      module_id: moduleIdMap.get(l.moduleId),
      title_nl: l.title,
      title_es: l.subtitle,
      sort_order: l.order,
      is_extra: l.isExtra ?? false,
    }));

  if (newLessonRows.length > 0) {
    const { error } = await db.from('lessons').insert(newLessonRows);
    if (error) return NextResponse.json({ step: 'lessons insert', error: error.message }, { status: 500 });
  }

  const { data: allLessons, error: allLesErr } = await db.from('lessons').select('id, slug');
  if (allLesErr) return NextResponse.json({ step: 'lessons select', error: allLesErr.message }, { status: 500 });

  const lessonIdMap = new Map<string, number>(
    (allLessons ?? []).map((l: { id: number; slug: string }) => [l.slug, l.id])
  );
  report.lessons = `total ${lessonIdMap.size} (inserted ${newLessonRows.length} new)`;

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

    // Check if rows already exist for this lesson
    if (!force) {
      const { count } = await db
        .from('vocabulary_items')
        .select('id', { count: 'exact', head: true })
        .eq('lesson_id', lessonDbId);
      if ((count ?? 0) > 0) { vocabSkipped++; continue; }
    } else {
      await db.from('vocabulary_items').delete().eq('lesson_id', lessonDbId);
    }

    const rows = vocabBlocks.flatMap(b =>
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
      report[`vocab_error_${lesson.id}`] = error.message;
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
    } else {
      await db.from('phrases').delete().eq('lesson_id', lessonDbId);
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
      report[`phrases_error_${lesson.id}`] = error.message;
    } else {
      phrasesInserted += rows.length;
    }
  }

  report.phrases = `inserted ${phrasesInserted} rows, skipped ${phrasesSkipped} lessons (already had data)`;
  report.done = true;

  return NextResponse.json(report, { status: 200 });
}
