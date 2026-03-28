/**
 * GET /api/seed
 *
 * Populates Supabase tables from local courseData.ts.
 * Uses count checks — if a table already has rows, skips it (safe re-run).
 * Use ?force=true to wipe and re-insert everything from scratch.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY env var (bypasses RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MODULES, LESSONS } from '@/lib/courseData';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({
      error: 'Missing SUPABASE_SERVICE_ROLE_KEY — add it in Vercel env vars',
    }, { status: 500 });
  }

  const force = req.nextUrl.searchParams.get('force') === 'true';
  const db = createClient(supabaseUrl, supabaseKey);
  const report: Record<string, unknown> = { force };

  // ── helper ─────────────────────────────────────────────────────────────────
  async function countRows(table: string): Promise<number> {
    const { count } = await db.from(table).select('id', { count: 'exact', head: true });
    return count ?? 0;
  }

  // ── 1. Modules ──────────────────────────────────────────────────────────────
  const moduleCount = await countRows('modules');

  if (moduleCount > 0 && !force) {
    report.modules = `skipped — ${moduleCount} rows already exist (use ?force=true to reset)`;
  } else {
    if (force) await db.from('modules').delete().neq('id', 0);

    const rows = MODULES.map(m => ({
      slug: m.id,
      title_nl: m.title,
      title_es: m.subtitle ?? '',
      sort_order: m.order,
    }));

    const { error } = await db.from('modules').insert(rows);
    if (error) return NextResponse.json({ step: 'modules insert', error: error.message }, { status: 500 });
    report.modules = `inserted ${rows.length}`;
  }

  // Fetch all modules to build slug → id map
  const { data: allModules, error: modErr } = await db.from('modules').select('id, slug');
  if (modErr) return NextResponse.json({ step: 'modules select', error: modErr.message }, { status: 500 });

  const moduleIdMap = new Map<string, number>(
    (allModules ?? []).map((m: { id: number; slug: string }) => [m.slug, m.id])
  );

  // ── 2. Lessons ──────────────────────────────────────────────────────────────
  const lessonCount = await countRows('lessons');

  if (lessonCount > 0 && !force) {
    report.lessons = `skipped — ${lessonCount} rows already exist (use ?force=true to reset)`;
  } else {
    if (force) await db.from('lessons').delete().neq('id', 0);

    const rows = LESSONS
      .filter(l => moduleIdMap.has(l.moduleId))
      .map(l => ({
        slug: l.id,
        module_id: moduleIdMap.get(l.moduleId),
        title_nl: l.title,
        title_es: l.subtitle,
        sort_order: l.order,
        is_extra: l.isExtra ?? false,
      }));

    const { error } = await db.from('lessons').insert(rows);
    if (error) return NextResponse.json({ step: 'lessons insert', error: error.message }, { status: 500 });
    report.lessons = `inserted ${rows.length}`;
  }

  // Fetch all lessons to build slug → id map
  const { data: allLessons, error: lesErr } = await db.from('lessons').select('id, slug');
  if (lesErr) return NextResponse.json({ step: 'lessons select', error: lesErr.message }, { status: 500 });

  const lessonIdMap = new Map<string, number>(
    (allLessons ?? []).map((l: { id: number; slug: string }) => [l.slug, l.id])
  );

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
