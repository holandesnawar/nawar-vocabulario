/**
 * seed-m3-les2-test.mjs
 *
 * Añade una sección de TEST a Lección 2 ("Ik wil… / Mag ik…?")
 * con exactamente 2 ejercicios de cada tipo:
 *   • multiple_choice  × 2  (sort_order 501–502)
 *   • fill_blank       × 2  (sort_order 511–512)
 *   • order_sentence   × 2  (sort_order 521–522)
 *   • word_scramble    × 2  (sort_order 531–532)
 *   • match_pairs      × 2  (sort_order 541–542)
 *   • write_answer     × 2  (sort_order 551–552)
 *
 * NO borra datos existentes — sólo inserta en sort_order ≥ 500.
 * Es idempotente: si ya existen ejercicios con esos sort_order, los borra
 * primero y los vuelve a crear.
 *
 * Uso: node scripts/seed-m3-les2-test.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(resolve(__dir, '../.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY'];
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Faltan variables de entorno en .env.local');
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

async function insertItem(lessonId, data) {
  const [item] = await post('practice_items', {
    lesson_id:      lessonId,
    sort_order:     data.sort_order,
    type:           data.type,
    question_text:  data.question_text,
    correct_answer: data.correct_answer,
    hint:           data.hint        ?? null,
    explanation:    data.explanation ?? null,
  });
  return item.id;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧪  Seeding TEST section for M3 Les 2 — Ik wil… / Mag ik…?\n');
  console.log('    2 ejercicios × 6 tipos = 12 ejercicios en total\n');

  // ── 1. Obtener lección ────────────────────────────────────────────────────
  const lessons = await get('lessons', 'slug=eq.m3-les-2-grammatica&select=id');
  if (!lessons.length) throw new Error('Lección "m3-les-2-grammatica" no encontrada. ¿Ran seed-m3-les2.sql?');
  const lessonId = lessons[0].id;
  console.log(`✅  Lección encontrada, ID: ${lessonId}`);

  // ── 2. Limpiar sort_order ≥ 500 (idempotente) ────────────────────────────
  const existing = await get('practice_items', `lesson_id=eq.${lessonId}&sort_order=gte.500&select=id`);
  if (existing.length > 0) {
    const ids = existing.map(i => i.id).join(',');
    await del('match_pair_items', `practice_item_id=in.(${ids})`);
    await del('practice_options',  `practice_item_id=in.(${ids})`);
    await del('practice_items',    `lesson_id=eq.${lessonId}&sort_order=gte.500`);
    console.log(`🗑   Borrados ${existing.length} ejercicios de test previos\n`);
  }

  let id;

  // ══════════════════════════════════════════════════════════════════════════
  // BLOQUE A — multiple_choice (501–502)
  // Tema: vocabulario "ik wil / mag ik" + café/snackbar
  // ══════════════════════════════════════════════════════════════════════════

  // 501 — ¿Qué significa "Mag ik een koffie"?
  id = await insertItem(lessonId, {
    sort_order:     501,
    type:           'multiple_choice',
    question_text:  '¿Qué significa "Mag ik een koffie, alstublieft?"',
    correct_answer: '¿Me pone un café, por favor?',
    explanation:    '"Mag ik" = ¿me pone / puedo tener? Es la forma formal de pedir algo.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: '¿Me pone un café, por favor?',  is_correct: true  },
    { practice_item_id: id, sort_order: 2, option_text: '¿Quieres un café?',              is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'Yo bebo café.',                  is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'No hay café.',                   is_correct: false },
  ]);

  // 502 — Elige la traducción correcta de "Ik wil een broodje"
  id = await insertItem(lessonId, {
    sort_order:     502,
    type:           'multiple_choice',
    question_text:  '¿Cuál es la traducción de "Ik wil een broodje, graag"?',
    correct_answer: 'Quiero un bocadillo, por favor.',
    explanation:    '"Ik wil" = Quiero. "graag" suaviza la petición (= por favor / con gusto).',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'Quiero un bocadillo, por favor.', is_correct: true  },
    { practice_item_id: id, sort_order: 2, option_text: 'Tengo un bocadillo.',              is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: '¿Hay bocadillos?',                 is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'El bocadillo es caro.',            is_correct: false },
  ]);
  console.log('✅  BLOQUE A — multiple_choice (501–502)');

  // ══════════════════════════════════════════════════════════════════════════
  // BLOQUE B — fill_blank (511–512)
  // ══════════════════════════════════════════════════════════════════════════

  // 511 — Completa con "wil" o "mag"
  await insertItem(lessonId, {
    sort_order:     511,
    type:           'fill_blank',
    question_text:  'Completa: "_____ ik een glas water, alstublieft?" (petición formal)',
    correct_answer: 'Mag',
    hint:           'Cuando pides algo a un desconocido o en un establecimiento, usa "Mag ik".',
    explanation:    '"Mag ik" es la forma correcta para pedir permiso o hacer un pedido educadamente.',
  });

  // 512 — Completa la frase con "graag" o "alstublieft"
  await insertItem(lessonId, {
    sort_order:     512,
    type:           'fill_blank',
    question_text:  'Completa: "Ik wil een kopje thee, _____." (forma tuteo, informal)',
    correct_answer: 'graag',
    hint:           '"graag" es el equivalente informal de "por favor" al añadirse a "ik wil".',
    explanation:    '"Graag" significa literalmente "con gusto" y se usa tras "ik wil" para suavizar la petición.',
  });
  console.log('✅  BLOQUE B — fill_blank (511–512)');

  // ══════════════════════════════════════════════════════════════════════════
  // BLOQUE C — order_sentence (521–522)
  // ══════════════════════════════════════════════════════════════════════════

  // 521 — "Mag ik een cola, alstublieft?"
  id = await insertItem(lessonId, {
    sort_order:     521,
    type:           'order_sentence',
    question_text:  'Ordena las palabras para formar: "¿Me pone una cola, por favor?"',
    correct_answer: 'Mag ik een cola alstublieft',
    hint:           'El verbo va primero en preguntas con "mag".',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'Mag',         is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'ik',          is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'een',         is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'cola',        is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'alstublieft', is_correct: false },
    { practice_item_id: id, sort_order: 6, option_text: 'graag',       is_correct: false },
  ]);

  // 522 — "Ik wil een broodje met kaas"
  id = await insertItem(lessonId, {
    sort_order:     522,
    type:           'order_sentence',
    question_text:  'Ordena: "Quiero un bocadillo con queso."',
    correct_answer: 'Ik wil een broodje met kaas',
    hint:           'Empieza por el sujeto "Ik".',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'Ik',      is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'wil',     is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'een',     is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'broodje', is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'met',     is_correct: false },
    { practice_item_id: id, sort_order: 6, option_text: 'kaas',    is_correct: false },
  ]);
  console.log('✅  BLOQUE C — order_sentence (521–522)');

  // ══════════════════════════════════════════════════════════════════════════
  // BLOQUE D — word_scramble (531–532)
  // Encuentra la palabra a partir de letras desordenadas
  // ══════════════════════════════════════════════════════════════════════════

  await insertItem(lessonId, {
    sort_order:     531,
    type:           'word_scramble',
    question_text:  'Unjumble: G - R - A - A - G   →   (= con gusto / por favor)',
    correct_answer: 'graag',
    hint:           '5 letras, dos "a".',
    explanation:    '"Graag" = con gusto, se usa para pedir algo de forma educada.',
  });

  await insertItem(lessonId, {
    sort_order:     532,
    type:           'word_scramble',
    question_text:  'Unjumble: B - R - O - O - D - J - E   →   (= bocadillo / panecillo)',
    correct_answer: 'broodje',
    hint:           '7 letras, contiene "oo".',
    explanation:    '"Een broodje" = un bocadillo. Muy común en cafeterías neerlandesas.',
  });
  console.log('✅  BLOQUE D — word_scramble (531–532)');

  // ══════════════════════════════════════════════════════════════════════════
  // BLOQUE E — match_pairs (541–542)
  // ══════════════════════════════════════════════════════════════════════════

  // 541 — Une neerlandés con español
  id = await insertItem(lessonId, {
    sort_order:     541,
    type:           'match_pairs',
    question_text:  'Une cada expresión neerlandesa con su traducción en español.',
    correct_answer: '',
  });
  await post('match_pair_items', [
    { practice_item_id: id, sort_order: 1, left_text: 'Mag ik…?',       right_text: '¿Me pone…? / ¿Puedo tener…?' },
    { practice_item_id: id, sort_order: 2, left_text: 'Ik wil…',         right_text: 'Quiero…' },
    { practice_item_id: id, sort_order: 3, left_text: 'graag',            right_text: 'por favor / con gusto' },
    { practice_item_id: id, sort_order: 4, left_text: 'alstublieft',      right_text: 'por favor (formal)' },
  ]);

  // 542 — Une bebidas/comidas con su artículo correcto
  id = await insertItem(lessonId, {
    sort_order:     542,
    type:           'match_pairs',
    question_text:  'Une cada artículo (de / het) con la palabra correcta.',
    correct_answer: '',
  });
  await post('match_pair_items', [
    { practice_item_id: id, sort_order: 1, left_text: 'de koffie',   right_text: 'el café' },
    { practice_item_id: id, sort_order: 2, left_text: 'het water',   right_text: 'el agua' },
    { practice_item_id: id, sort_order: 3, left_text: 'de thee',     right_text: 'el té' },
    { practice_item_id: id, sort_order: 4, left_text: 'het broodje', right_text: 'el bocadillo' },
  ]);
  console.log('✅  BLOQUE E — match_pairs (541–542)');

  // ══════════════════════════════════════════════════════════════════════════
  // BLOQUE F — write_answer (551–552)
  // ══════════════════════════════════════════════════════════════════════════

  await insertItem(lessonId, {
    sort_order:     551,
    type:           'write_answer',
    question_text:  'Traduce al neerlandés: "Quiero un café con leche, por favor." (informal)',
    correct_answer: 'Ik wil een koffie met melk, graag.',
    hint:           'Usa "Ik wil" + artículo + bebida + "met melk, graag".',
    explanation:    '"Koffie met melk" = café con leche. "graag" al final = por favor en registro informal.',
  });

  await insertItem(lessonId, {
    sort_order:     552,
    type:           'write_answer',
    question_text:  'Traduce al neerlandés: "¿Me pone una tarta de manzana, por favor?" (formal)',
    correct_answer: 'Mag ik een appeltaart, alstublieft?',
    hint:           'Usa "Mag ik" + artículo + producto + "alstublieft?".',
    explanation:    '"Appeltaart" = tarta de manzana, es un clásico neerlandés. "Alstublieft" = por favor formal.',
  });
  console.log('✅  BLOQUE F — write_answer (551–552)');

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('🎉  SECCIÓN DE TEST insertada correctamente en Lección 2');
  console.log('════════════════════════════════════════════════════════════');
  console.log('   Lección:         m3-les-2-grammatica');
  console.log('   Ejercicios TEST: sort_order 501–552 (12 ejercicios)');
  console.log('');
  console.log('   Tipos insertados:');
  console.log('      • multiple_choice  × 2  (501–502)');
  console.log('      • fill_blank       × 2  (511–512)');
  console.log('      • order_sentence   × 2  (521–522)');
  console.log('      • word_scramble    × 2  (531–532)');
  console.log('      • match_pairs      × 2  (541–542)');
  console.log('      • write_answer     × 2  (551–552)');
  console.log('════════════════════════════════════════════════════════════\n');
}

main().catch(e => { console.error('❌ ERROR:', e.message); process.exit(1); });
