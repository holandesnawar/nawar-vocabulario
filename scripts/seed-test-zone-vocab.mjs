/**
 * seed-test-zone-vocab.mjs
 *
 * Crea la lección "🧪 Test Zone — Vocabulario" con UN ejercicio por formato
 * para que se pueda valorar cada uno sin repetición. Algunos formatos tienen
 * 2 si el contenido es claramente diferente (p.ej. emparejar bebidas vs
 * emparejar animales).
 *
 * Idempotente — borra y recrea si ya existe.
 *
 * Uso: node scripts/seed-test-zone-vocab.mjs
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
const SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Faltan variables de entorno en .env.local');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${SERVICE_KEY}`,
  apikey: SERVICE_KEY,
  Prefer: 'return=representation',
};

async function get(table, params = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers });
  if (!r.ok) throw new Error(`GET ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function post(table, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function patch(table, params, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function del(table, params) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'DELETE',
    headers,
  });
  if (!r.ok) throw new Error(`DELETE ${table}: ${r.status} ${await r.text()}`);
}

async function insertItem(lessonId, data) {
  const [item] = await post('practice_items', {
    lesson_id: lessonId,
    sort_order: data.sort_order,
    type: data.type,
    question_text: data.question_text,
    correct_answer: data.correct_answer,
    hint: data.hint ?? null,
    explanation: data.explanation ?? null,
  });
  return item.id;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧪  Creando Test Zone — Vocabulario\n');

  // ── 1. Módulo ─────────────────────────────────────────────────────────────
  const [mod] = await get('modules', 'slug=eq.boodschappen&select=id');
  if (!mod) throw new Error('Módulo "boodschappen" no encontrado');
  const moduleId = mod.id;

  // ── 2. Upsert lección ─────────────────────────────────────────────────────
  let lessonId;
  const existing = await get('lessons', 'slug=eq.test-zone-vocab&select=id');
  if (existing.length > 0) {
    lessonId = existing[0].id;
    await patch('lessons', `id=eq.${lessonId}`, {
      module_id: moduleId,
      slug: 'test-zone-vocab',
      title_nl: '🧪 Test Zone — Vocabulario',
      title_es: 'Prueba formatos de ejercicio de vocabulario',
      sort_order: 100,
      is_extra: true,
    });
    const prev = await get('practice_items', `lesson_id=eq.${lessonId}&select=id`);
    if (prev.length > 0) {
      const ids = prev.map((i) => i.id).join(',');
      await del('match_pair_items', `practice_item_id=in.(${ids})`);
      await del('practice_options', `practice_item_id=in.(${ids})`);
      await del('practice_items', `lesson_id=eq.${lessonId}`);
    }
    // PRESERVAR audio_url por word_nl antes de borrar — para no perder
    // los MP3 generados por scripts/generate-audio.mjs.
    const oldVocab = await get('vocabulary_items', `lesson_id=eq.${lessonId}&select=word_nl,audio_url`);
    globalThis.__preservedAudioByWord = Object.fromEntries(
      oldVocab.filter(v => v.audio_url).map(v => [v.word_nl, v.audio_url])
    );
    const preservedCount = Object.keys(globalThis.__preservedAudioByWord).length;
    if (preservedCount > 0) console.log(`💾  Preservados ${preservedCount} audio_url por palabra`);

    await del('vocabulary_items', `lesson_id=eq.${lessonId}`);
    console.log(`✅  Lección existente, ID: ${lessonId} — limpiada\n`);
  } else {
    globalThis.__preservedAudioByWord = {};
    const [lesson] = await post('lessons', {
      module_id: moduleId,
      slug: 'test-zone-vocab',
      title_nl: '🧪 Test Zone — Vocabulario',
      title_es: 'Prueba formatos de ejercicio de vocabulario',
      sort_order: 100,
      is_extra: true,
    });
    lessonId = lesson.id;
    console.log(`✅  Lección creada, ID: ${lessonId}\n`);
  }

  // ── 3. Vocabulary items ───────────────────────────────────────────────────
  const preserved = globalThis.__preservedAudioByWord ?? {};
  const vocabRows = [
    { lesson_id: lessonId, sort_order: 1, word_nl: 'water',  translation_es: 'agua',   article: 'het', audio_url: preserved['water']  ?? null },
    { lesson_id: lessonId, sort_order: 2, word_nl: 'koffie', translation_es: 'café',   article: 'de',  audio_url: preserved['koffie'] ?? null },
    { lesson_id: lessonId, sort_order: 3, word_nl: 'melk',   translation_es: 'leche',  article: 'de',  audio_url: preserved['melk']   ?? null },
    { lesson_id: lessonId, sort_order: 4, word_nl: 'kat',    translation_es: 'gato',   article: 'de',  audio_url: preserved['kat']    ?? null },
    { lesson_id: lessonId, sort_order: 5, word_nl: 'hond',   translation_es: 'perro',  article: 'de',  audio_url: preserved['hond']   ?? null },
    { lesson_id: lessonId, sort_order: 6, word_nl: 'vogel',  translation_es: 'pájaro', article: 'de',  audio_url: preserved['vogel']  ?? null },
    { lesson_id: lessonId, sort_order: 7, word_nl: 'boek',   translation_es: 'libro',  article: 'het', audio_url: preserved['boek']   ?? null },
    { lesson_id: lessonId, sort_order: 8, word_nl: 'huis',   translation_es: 'casa',   article: 'het', audio_url: preserved['huis']   ?? null },
  ];
  await post('vocabulary_items', vocabRows);
  const restored = vocabRows.filter(v => v.audio_url).length;
  console.log(`✅  vocabulary_items × 8 (audio_url restaurado en ${restored})`);

  let id;

  // ══════════════════════════════════════════════════════════════════════════
  // 1 ─ ESCUCHA Y ELIGE  (TTS, sin revelar la palabra en el prompt)
  //     El componente lee la palabra entre comillas pero la oculta del texto
  //     visible. Por eso el prompt incluye "hond" (TTS la usa).
  // ══════════════════════════════════════════════════════════════════════════
  id = await insertItem(lessonId, {
    sort_order: 10,
    type: 'listen_and_choose',
    question_text: 'Escucha y elige el animal correcto: "hond"',
    correct_answer: 'perro',
    explanation: '"De hond" = el perro.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'perro',  is_correct: true  },
    { practice_item_id: id, sort_order: 2, option_text: 'gato',   is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'pájaro', is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'pez',    is_correct: false },
  ]);
  console.log('✅  listen_and_choose × 1');

  // ══════════════════════════════════════════════════════════════════════════
  // 1bis ─ ESCUCHA Y TRADUCE (listen_translate) — NUEVO
  //        Frase NL grande + botón escuchar (TTS). El alumno compone la
  //        traducción ES tocando chips. Las comillas en el prompt marcan la
  //        parte que TTS debe leer (oculta del texto visible).
  // ══════════════════════════════════════════════════════════════════════════
  id = await insertItem(lessonId, {
    sort_order: 11,
    type: 'listen_translate',
    question_text: 'Escucha esta frase en neerlandés y compón la traducción en español: "Ik drink water in de ochtend"',
    correct_answer: 'Bebo agua por la mañana',
    explanation: '"Ik drink water in de ochtend" = "Bebo agua por la mañana".',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'Bebo',    is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'agua',    is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'por',     is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'la',      is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'mañana',  is_correct: false },
    { practice_item_id: id, sort_order: 6, option_text: 'café',    is_correct: false }, // distractor
    { practice_item_id: id, sort_order: 7, option_text: 'noche',   is_correct: false }, // distractor
  ]);
  console.log('✅  listen_translate × 1 (NUEVO)');

  // ══════════════════════════════════════════════════════════════════════════
  // 2 ─ VERDADERO / FALSO
  // ══════════════════════════════════════════════════════════════════════════
  await insertItem(lessonId, {
    sort_order: 20,
    type: 'true_false',
    question_text: '"De kat" significa "el gato"',
    correct_answer: 'verdadero',
    explanation: '"De kat" = "el gato". Correcto.',
  });
  console.log('✅  true_false × 1');

  // ══════════════════════════════════════════════════════════════════════════
  // 3 ─ SELECCIONA LA CORRECTA (multiple_choice — 3 sub-preguntas distintas)
  // ══════════════════════════════════════════════════════════════════════════
  id = await insertItem(lessonId, {
    sort_order: 30,
    type: 'multiple_choice',
    question_text: '¿Qué artículo lleva "boek" (libro)?',
    correct_answer: 'het',
    explanation: '"Het boek" — los sustantivos neutros suelen llevar "het".',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'het', is_correct: true  },
    { practice_item_id: id, sort_order: 2, option_text: 'de',  is_correct: false },
  ]);

  id = await insertItem(lessonId, {
    sort_order: 31,
    type: 'multiple_choice',
    question_text: '¿Qué significa "het boek"?',
    correct_answer: 'el libro',
    hint: 'Piensa en palabras parecidas en alemán o inglés.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'el libro', is_correct: true  },
    { practice_item_id: id, sort_order: 2, option_text: 'el perro', is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'el agua',  is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'la mesa',  is_correct: false },
  ]);

  id = await insertItem(lessonId, {
    sort_order: 32,
    type: 'multiple_choice',
    question_text: '¿Cómo se dice "agua" en neerlandés?',
    correct_answer: 'water',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'water',  is_correct: true  },
    { practice_item_id: id, sort_order: 2, option_text: 'melk',   is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'koffie', is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'brood',  is_correct: false },
  ]);
  console.log('✅  multiple_choice × 3');

  // ══════════════════════════════════════════════════════════════════════════
  // 4 ─ COMPLETA LA FRASE (fill_blank con opciones)
  //     4 botones de palabras NL — click escucha la pronunciación (TTS) +
  //     selecciona. "Comprobar" valida.
  // ══════════════════════════════════════════════════════════════════════════
  id = await insertItem(lessonId, {
    sort_order: 40,
    type: 'fill_blank',
    question_text: '☕ Ik drink ___ in de ochtend.',
    correct_answer: 'koffie',
    explanation: '"Koffie" = café. "In de ochtend" = por la mañana.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'koffie', is_correct: true  },
    { practice_item_id: id, sort_order: 2, option_text: 'water',  is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'melk',   is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'kat',    is_correct: false },
  ]);
  console.log('✅  fill_blank × 1 (con opciones + TTS)');

  // ══════════════════════════════════════════════════════════════════════════
  // 5 ─ ORDENA LAS PALABRAS (order_sentence) — NUEVO en el Test Zone
  //     Tap-to-build estilo Duolingo. correct_answer = frase completa.
  //     Las opciones contienen las palabras correctas + algunos distractores.
  // ══════════════════════════════════════════════════════════════════════════
  id = await insertItem(lessonId, {
    sort_order: 50,
    type: 'order_sentence',
    question_text: 'Forma la frase: "Bebo agua por la mañana."',
    correct_answer: 'Ik drink water in de ochtend',
    explanation: '"Ik drink water in de ochtend" = "Bebo agua por la mañana".',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'Ik',       is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'drink',    is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'water',    is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'in',       is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'de',       is_correct: false },
    { practice_item_id: id, sort_order: 6, option_text: 'ochtend',  is_correct: false },
    { practice_item_id: id, sort_order: 7, option_text: 'koffie',   is_correct: false }, // distractor
    { practice_item_id: id, sort_order: 8, option_text: 'avond',    is_correct: false }, // distractor
  ]);
  console.log('✅  order_sentence × 1 (NUEVO)');

  // ── write_answer eliminado: muy "tipo examen" (escribir a mano).
  //    El alumno tiene letterdash + word_scramble que cubren el aspecto
  //    de producción activa con menos fricción.

  // ══════════════════════════════════════════════════════════════════════════
  // 7 ─ DELETREA LA PALABRA (word_scramble)
  // ══════════════════════════════════════════════════════════════════════════
  await insertItem(lessonId, {
    sort_order: 70,
    type: 'word_scramble',
    question_text:
      'Ordena estas letras para formar una bebida:\nI - F - K - E - O - F',
    correct_answer: 'koffie',
    hint: 'Empieza por "k". Bebida oscura muy popular.',
    explanation: '"De koffie" — artículo "de".',
  });
  console.log('✅  word_scramble × 1');

  // ══════════════════════════════════════════════════════════════════════════
  // 8 ─ LETRAS QUE FALTAN (letter_dash) — NUEVO
  //     correct_answer = palabra completa. El componente decide qué letras
  //     ocultar mostrando "_" en su lugar (k_ff_e). El alumno escribe la
  //     palabra entera en el input.
  // ══════════════════════════════════════════════════════════════════════════
  await insertItem(lessonId, {
    sort_order: 80,
    type: 'letter_dash',
    question_text: 'Bebida oscura y amarga muy popular en los Países Bajos.',
    correct_answer: 'koffie',
    hint: 'Empieza por "k".',
    explanation: '"De koffie" = el café. Pronunciado "kófi".',
  });
  console.log('✅  letter_dash × 1 (NUEVO)');

  // ══════════════════════════════════════════════════════════════════════════
  // 9 ─ EMPAREJA — bebidas (match_pairs)
  // ══════════════════════════════════════════════════════════════════════════
  id = await insertItem(lessonId, {
    sort_order: 90,
    type: 'match_pairs',
    question_text: 'Une cada bebida con su traducción.',
    correct_answer: '',
  });
  await post('match_pair_items', [
    { practice_item_id: id, sort_order: 1, left_text: 'water',  right_text: 'agua'  },
    { practice_item_id: id, sort_order: 2, left_text: 'koffie', right_text: 'café'  },
    { practice_item_id: id, sort_order: 3, left_text: 'melk',   right_text: 'leche' },
  ]);
  console.log('✅  match_pairs × 1');

  // pair_memory eliminado por feedback del usuario (no encajaba).

  // ══════════════════════════════════════════════════════════════════════════
  // 11 ─ TOCA EL EMOJI (emoji_choice) — sin pista (explanation), tal cual
  //      pidió el usuario; el ejercicio es fácil y la "pista" sobraba.
  // ══════════════════════════════════════════════════════════════════════════
  id = await insertItem(lessonId, {
    sort_order: 110,
    type: 'emoji_choice',
    question_text: 'koffie',
    correct_answer: '☕',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: '☕', is_correct: true  },
    { practice_item_id: id, sort_order: 2, option_text: '🥛', is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: '💧', is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: '🍵', is_correct: false },
  ]);
  console.log('✅  emoji_choice × 1 (sin pista)');

  // ══════════════════════════════════════════════════════════════════════════
  // 12 ─ ELIGE LA INTRUSA (odd_one_out)
  // ══════════════════════════════════════════════════════════════════════════
  id = await insertItem(lessonId, {
    sort_order: 120,
    type: 'odd_one_out',
    question_text: 'Tres de estas palabras son bebidas. Una no. Toca la intrusa.',
    correct_answer: 'kat',
    explanation: '"Kat" = gato. Las otras son water (agua), koffie (café) y melk (leche).',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'water',  is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'koffie', is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'kat',    is_correct: true  },
    { practice_item_id: id, sort_order: 4, option_text: 'melk',   is_correct: false },
  ]);
  console.log('✅  odd_one_out × 1');

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('🎉  TEST ZONE — VOCABULARIO — listo');
  console.log('════════════════════════════════════════════════════════════');
  console.log('   • vocabulary_items     × 8');
  console.log('   • listen_and_choose    × 1');
  console.log('   • listen_translate     × 1   (NUEVO)');
  console.log('   • true_false           × 1');
  console.log('   • multiple_choice      × 3');
  console.log('   • fill_blank           × 1   (mejorado: opciones + TTS)');
  console.log('   • order_sentence       × 1');
  console.log('   • word_scramble        × 1');
  console.log('   • letter_dash          × 1');
  console.log('   • match_pairs          × 1');
  console.log('   • emoji_choice         × 1   (sin pista)');
  console.log('   • odd_one_out          × 1');
  console.log('════════════════════════════════════════════════════════════');
  console.log('   Total: 12 tarjetas en 11 formatos distintos.');
  console.log('════════════════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error('❌ ERROR:', e.message);
  process.exit(1);
});
