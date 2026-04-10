/**
 * seed-practice.mjs
 *
 * Seeds practice exercises for a lesson into Supabase.
 * Usage:
 *   node scripts/seed-practice.mjs <lesson-slug>
 *   node scripts/seed-practice.mjs les-1-voorstellen
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
 * Requires: Node 18+ (native fetch)
 *
 * What it does:
 *   1. Resolves the lesson DB id by slug
 *   2. Deletes existing practice_items for that lesson (clean slate)
 *   3. Inserts exercises defined in LESSONS below
 *   4. Inserts practice_options for MC/V-F exercises
 *   5. Inserts match_pair_items for match_pairs exercises
 *      (requires table from create-match-pairs-table.sql to exist first)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env.local ────────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');
const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey': SERVICE_KEY,
  'Prefer': 'return=representation',
};

async function get(table, params = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers });
  if (!r.ok) throw new Error(`GET ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function post(table, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function del(table, params) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'DELETE', headers,
  });
  if (!r.ok) throw new Error(`DELETE ${table}: ${r.status} ${await r.text()}`);
}

// ── Lesson exercise definitions ────────────────────────────────────────────────
// Add entries for other lessons as needed.

const LESSONS = {
  'les-1-voorstellen': [
    {
      type: 'multiple_choice',
      question_text: '¿Cómo se dice "Me llamo" en neerlandés?',
      correct_answer: null,
      sort_order: 1,
      options: [
        { option_text: 'Ik heet',  is_correct: true,  sort_order: 1 },
        { option_text: 'Ik woon', is_correct: false, sort_order: 2 },
        { option_text: 'Ik werk', is_correct: false, sort_order: 3 },
        { option_text: 'Ik kom',  is_correct: false, sort_order: 4 },
      ],
      explanation: '"Heten" significa llamarse. "Ik heet" = me llamo.',
    },
    {
      type: 'multiple_choice',
      question_text: '¿Qué significa "Ik kom uit Spanje"?',
      correct_answer: null,
      sort_order: 2,
      options: [
        { option_text: 'Vivo en España',    is_correct: false, sort_order: 1 },
        { option_text: 'Soy de España',     is_correct: true,  sort_order: 2 },
        { option_text: 'Hablo español',     is_correct: false, sort_order: 3 },
        { option_text: 'Trabajo en España', is_correct: false, sort_order: 4 },
      ],
      explanation: '"Komen uit" significa ser de / venir de.',
    },
    {
      type: 'fill_blank',
      question_text: 'Ik ___ in Amsterdam. (vivir)',
      correct_answer: 'woon',
      sort_order: 3,
      hint: 'wonen',
      options: [],
    },
    {
      type: 'fill_blank',
      question_text: 'Ik ___ een beetje Nederlands. (hablar)',
      correct_answer: 'spreek',
      sort_order: 4,
      hint: 'spreken',
      options: [],
    },
    {
      type: 'order_sentence',
      question_text: 'Ordena: "Me llamo Marco y soy de Italia."',
      correct_answer: 'Ik heet Marco en ik kom uit Italië',
      sort_order: 5,
      options: [
        { option_text: 'Ik',     is_correct: false, sort_order: 1 },
        { option_text: 'heet',   is_correct: false, sort_order: 2 },
        { option_text: 'Marco',  is_correct: false, sort_order: 3 },
        { option_text: 'en',     is_correct: false, sort_order: 4 },
        { option_text: 'ik',     is_correct: false, sort_order: 5 },
        { option_text: 'kom',    is_correct: false, sort_order: 6 },
        { option_text: 'uit',    is_correct: false, sort_order: 7 },
        { option_text: 'Italië', is_correct: false, sort_order: 8 },
      ],
    },
    {
      type: 'multiple_choice',
      question_text: '¿Cómo preguntas "¿De dónde eres?" en neerlandés?',
      correct_answer: null,
      sort_order: 6,
      options: [
        { option_text: 'Hoe heet jij?',         is_correct: false, sort_order: 1 },
        { option_text: 'Waar woon jij?',         is_correct: false, sort_order: 2 },
        { option_text: 'Waar kom jij vandaan?',  is_correct: true,  sort_order: 3 },
        { option_text: 'Hoe oud ben jij?',       is_correct: false, sort_order: 4 },
      ],
    },
    {
      type: 'fill_blank',
      question_text: 'Ik ___ als verpleegkundige. (trabajar)',
      correct_answer: 'werk',
      sort_order: 7,
      hint: 'werken',
      options: [],
    },
    {
      type: 'order_sentence',
      question_text: 'Ordena: "Tengo 30 años y vivo en Bruselas."',
      correct_answer: 'Ik ben 30 jaar oud en ik woon in Brussel',
      sort_order: 8,
      options: [
        { option_text: 'Ik',      is_correct: false, sort_order: 1 },
        { option_text: 'ben',     is_correct: false, sort_order: 2 },
        { option_text: '30',      is_correct: false, sort_order: 3 },
        { option_text: 'jaar',    is_correct: false, sort_order: 4 },
        { option_text: 'oud',     is_correct: false, sort_order: 5 },
        { option_text: 'en',      is_correct: false, sort_order: 6 },
        { option_text: 'ik',      is_correct: false, sort_order: 7 },
        { option_text: 'woon',    is_correct: false, sort_order: 8 },
        { option_text: 'in',      is_correct: false, sort_order: 9 },
        { option_text: 'Brussel', is_correct: false, sort_order: 10 },
      ],
    },
    // Verdadero / Falso
    {
      type: 'multiple_choice',
      question_text: '"Ik heet" significa "Me llamo".',
      correct_answer: null,
      sort_order: 9,
      options: [
        { option_text: 'Verdadero', is_correct: true,  sort_order: 1 },
        { option_text: 'Falso',     is_correct: false, sort_order: 2 },
      ],
    },
    {
      type: 'multiple_choice',
      question_text: '"Wonen" significa "trabajar".',
      correct_answer: null,
      sort_order: 10,
      options: [
        { option_text: 'Verdadero', is_correct: false, sort_order: 1 },
        { option_text: 'Falso',     is_correct: true,  sort_order: 2 },
      ],
      explanation: '"Wonen" significa vivir. "Werken" significa trabajar.',
    },
    {
      type: 'multiple_choice',
      question_text: '"Waar kom jij vandaan?" pregunta de dónde eres.',
      correct_answer: null,
      sort_order: 11,
      options: [
        { option_text: 'Verdadero', is_correct: true,  sort_order: 1 },
        { option_text: 'Falso',     is_correct: false, sort_order: 2 },
      ],
    },
    // Word scramble
    {
      type: 'word_scramble',
      question_text: '¿Cómo se dice "trabajar"?',
      correct_answer: 'werken',
      sort_order: 12,
      hint: 'trabajar',
      options: [],
    },
    {
      type: 'word_scramble',
      question_text: '¿Cómo se dice "hablar"?',
      correct_answer: 'spreken',
      sort_order: 13,
      hint: 'hablar',
      options: [],
    },
    {
      type: 'word_scramble',
      question_text: '¿Cómo se dice "estudiar"?',
      correct_answer: 'studeren',
      sort_order: 14,
      hint: 'estudiar',
      options: [],
    },
    // Match pairs — options stored separately in match_pair_items
    {
      type: 'match_pairs',
      question_text: 'Une cada palabra neerlandesa con su traducción española',
      correct_answer: '',
      sort_order: 15,
      options: [],
      pairs: [
        { left_text: 'wonen',    right_text: 'vivir',      sort_order: 1 },
        { left_text: 'werken',   right_text: 'trabajar',   sort_order: 2 },
        { left_text: 'spreken',  right_text: 'hablar',     sort_order: 3 },
        { left_text: 'studeren', right_text: 'estudiar',   sort_order: 4 },
        { left_text: 'begrijpen',right_text: 'comprender', sort_order: 5 },
        { left_text: 'schrijven',right_text: 'escribir',   sort_order: 6 },
      ],
    },
  ],
};

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const lessonSlug = process.argv[2];
  if (!lessonSlug) {
    console.error('Usage: node scripts/seed-practice.mjs <lesson-slug>');
    process.exit(1);
  }

  const exercises = LESSONS[lessonSlug];
  if (!exercises) {
    console.error(`No exercise data found for "${lessonSlug}". Add it to LESSONS in this script.`);
    process.exit(1);
  }

  // 1. Resolve lesson DB id
  console.log(`Looking up lesson "${lessonSlug}"...`);
  const [lessonRow] = await get('lessons', `slug=eq.${lessonSlug}&select=id`);
  if (!lessonRow) {
    console.error(`Lesson "${lessonSlug}" not found in DB.`);
    process.exit(1);
  }
  const lessonId = lessonRow.id;
  console.log(`  → lesson id = ${lessonId}`);

  // 2. Delete existing practice items (cascades to practice_options and match_pair_items)
  console.log('Deleting existing practice items...');
  await del('practice_items', `lesson_id=eq.${lessonId}`);
  console.log('  → done');

  // 3. Insert exercises one by one (to get their new ids for options/pairs)
  console.log(`Inserting ${exercises.length} exercises...`);
  for (const ex of exercises) {
    const { options, pairs, ...itemFields } = ex;

    const [inserted] = await post('practice_items', {
      lesson_id: lessonId,
      sort_order: itemFields.sort_order,
      type: itemFields.type,
      question_text: itemFields.question_text,
      correct_answer: itemFields.correct_answer ?? '',
      hint: itemFields.hint ?? null,
      explanation: itemFields.explanation ?? null,
    });

    console.log(`  [${inserted.id}] ${itemFields.type}: ${itemFields.question_text.slice(0, 60)}`);

    // Insert options if any
    if (options?.length) {
      await post('practice_options', options.map(o => ({
        practice_item_id: inserted.id,
        sort_order: o.sort_order,
        option_text: o.option_text,
        is_correct: o.is_correct,
      })));
      console.log(`    → ${options.length} options`);
    }

    // Insert match pairs if any
    if (pairs?.length) {
      try {
        await post('match_pair_items', pairs.map(p => ({
          practice_item_id: inserted.id,
          sort_order: p.sort_order,
          left_text: p.left_text,
          right_text: p.right_text,
        })));
        console.log(`    → ${pairs.length} pairs`);
      } catch (e) {
        console.warn(`    ⚠ match_pair_items insert failed (table exists?): ${e.message}`);
        console.warn('    Run scripts/create-match-pairs-table.sql in Supabase SQL Editor first.');
      }
    }
  }

  console.log('\nDone! ✓');
}

main().catch(e => { console.error(e); process.exit(1); });
