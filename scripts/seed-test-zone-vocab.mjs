/**
 * seed-test-zone-vocab.mjs
 *
 * Crea la lección "🧪 Test Zone — Vocabulario" con muestras de varios
 * formatos de ejercicio centrados en vocabulario (palabras sueltas).
 *
 * Objetivo: que puedas probar cada formato y decidir cuál es mejor
 * pedagógicamente para tus alumnos.
 *
 * Formatos incluidos:
 *   1. Artículo correcto (de/het) × 3
 *   2. Traducción NL→ES (multiple choice) × 2
 *   3. Traducción ES→NL (multiple choice) × 2
 *   4. Completa la frase con la palabra correcta × 2
 *   5. Emparejar palabra con traducción × 1
 *   6. Emparejar palabra con emoji × 1
 *   7. Deletrear palabra × 2
 *   8. Escribir traducción × 2
 *
 * Total: 15 ejercicios, 8 formatos distintos.
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
    // Vocabulary items también se limpian para recrear desde cero
    await del('vocabulary_items', `lesson_id=eq.${lessonId}`);
    console.log(`✅  Lección existente, ID: ${lessonId} — limpiada\n`);
  } else {
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
  // Necesarios para que la sección "Vocabulario" aparezca en el LessonViewer.
  // La app solo muestra sección si hay vocabulary_items, lezen_texts o dialogues.
  // Los practice_items se renderizan DENTRO de la sección de vocabulario.
  // Vocabulario reducido: 8 palabras, todas usadas en los ejercicios de abajo.
  await post('vocabulary_items', [
    { lesson_id: lessonId, sort_order: 1, word_nl: 'water',  translation_es: 'agua',   article: 'het' },
    { lesson_id: lessonId, sort_order: 2, word_nl: 'koffie', translation_es: 'café',   article: 'de'  },
    { lesson_id: lessonId, sort_order: 3, word_nl: 'melk',   translation_es: 'leche',  article: 'de'  },
    { lesson_id: lessonId, sort_order: 4, word_nl: 'kat',    translation_es: 'gato',   article: 'de'  },
    { lesson_id: lessonId, sort_order: 5, word_nl: 'hond',   translation_es: 'perro',  article: 'de'  },
    { lesson_id: lessonId, sort_order: 6, word_nl: 'vogel',  translation_es: 'pájaro', article: 'de'  },
    { lesson_id: lessonId, sort_order: 7, word_nl: 'boek',   translation_es: 'libro',  article: 'het' },
    { lesson_id: lessonId, sort_order: 8, word_nl: 'huis',   translation_es: 'casa',   article: 'het' },
  ]);
  console.log('✅  vocabulary_items × 10 (necesarios para que la sección aparezca)');

  let id;

  // ══════════════════════════════════════════════════════════════════════════
  // 1 ─ ARTÍCULO CORRECTO (de / het) × 3
  //     Para cada sustantivo, elige el artículo
  // ══════════════════════════════════════════════════════════════════════════

  id = await insertItem(lessonId, {
    sort_order: 10,
    type: 'multiple_choice',
    question_text: '¿Qué artículo lleva "boek" (libro)?',
    correct_answer: 'het',
    explanation:
      '"Het boek" — los sustantivos neutros (diminutivos, palabras que acaban en -je, -um, muchas palabras abstractas) suelen llevar "het".',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'het', is_correct: true },
    { practice_item_id: id, sort_order: 2, option_text: 'de', is_correct: false },
  ]);

  id = await insertItem(lessonId, {
    sort_order: 11,
    type: 'multiple_choice',
    question_text: '¿Qué artículo lleva "tafel" (mesa)?',
    correct_answer: 'de',
    explanation:
      '"De tafel" — la mayoría de sustantivos en neerlandés llevan "de" (aproximadamente el 75%).',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'de', is_correct: true },
    { practice_item_id: id, sort_order: 2, option_text: 'het', is_correct: false },
  ]);

  console.log('✅  artículo de/het × 2');

  // ══════════════════════════════════════════════════════════════════════════
  // 2 ─ TRADUCCIÓN NL → ES (multiple choice) × 2
  // ══════════════════════════════════════════════════════════════════════════

  id = await insertItem(lessonId, {
    sort_order: 20,
    type: 'multiple_choice',
    question_text: '¿Qué significa "het boek"?',
    correct_answer: 'el libro',
    hint: 'Piensa en palabras parecidas en alemán o inglés.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'el libro', is_correct: true },
    { practice_item_id: id, sort_order: 2, option_text: 'el perro', is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'el agua', is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'la mesa', is_correct: false },
  ]);

  console.log('✅  traducción NL→ES × 1');

  // ══════════════════════════════════════════════════════════════════════════
  // 3 ─ TRADUCCIÓN ES → NL (multiple choice) × 2
  // ══════════════════════════════════════════════════════════════════════════

  id = await insertItem(lessonId, {
    sort_order: 30,
    type: 'multiple_choice',
    question_text: '¿Cómo se dice "agua" en neerlandés?',
    correct_answer: 'water',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'water', is_correct: true },
    { practice_item_id: id, sort_order: 2, option_text: 'melk', is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'koffie', is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'brood', is_correct: false },
  ]);

  console.log('✅  traducción ES→NL × 1');

  // ══════════════════════════════════════════════════════════════════════════
  // 4 ─ COMPLETA LA FRASE CON LA PALABRA CORRECTA × 2
  // ══════════════════════════════════════════════════════════════════════════

  await insertItem(lessonId, {
    sort_order: 40,
    type: 'fill_blank',
    question_text: '☕ Ik drink _____ in de ochtend.',
    correct_answer: 'koffie',
    hint: 'Una bebida oscura y amarga muy común.',
    explanation: '"Koffie" = café. "In de ochtend" = por la mañana.',
  });

  await insertItem(lessonId, {
    sort_order: 41,
    type: 'fill_blank',
    question_text: '🐾 De _____ slaapt op de bank.',
    correct_answer: 'kat',
    hint: 'Felino doméstico.',
    explanation: '"De kat" = el gato. "Op de bank" = en el sofá.',
  });
  console.log('✅  completa frase × 2');

  // ══════════════════════════════════════════════════════════════════════════
  // 5 ─ EMPAREJAR PALABRA CON TRADUCCIÓN × 1
  // ══════════════════════════════════════════════════════════════════════════

  id = await insertItem(lessonId, {
    sort_order: 50,
    type: 'match_pairs',
    question_text: 'Une cada bebida con su traducción. Todas son bebidas, ¡ojo!',
    correct_answer: '',
  });
  await post('match_pair_items', [
    { practice_item_id: id, sort_order: 1, left_text: 'water',  right_text: 'agua'  },
    { practice_item_id: id, sort_order: 2, left_text: 'koffie', right_text: 'café'  },
    { practice_item_id: id, sort_order: 3, left_text: 'melk',   right_text: 'leche' },
  ]);
  console.log('✅  emparejar bebidas × 1 (3 pares)');

  // ══════════════════════════════════════════════════════════════════════════
  // 6 ─ EMPAREJAR PALABRA CON EMOJI × 1
  //     Versión visual — memoria asociativa
  // ══════════════════════════════════════════════════════════════════════════

  id = await insertItem(lessonId, {
    sort_order: 51,
    type: 'match_pairs',
    question_text: 'Une cada animal con su emoji. Todos son animales.',
    correct_answer: '',
  });
  await post('match_pair_items', [
    { practice_item_id: id, sort_order: 1, left_text: 'kat',   right_text: '🐈' },
    { practice_item_id: id, sort_order: 2, left_text: 'hond',  right_text: '🐕' },
    { practice_item_id: id, sort_order: 3, left_text: 'vogel', right_text: '🐦' },
  ]);
  console.log('✅  emparejar animales × 1 (3 pares)');

  // ══════════════════════════════════════════════════════════════════════════
  // 7 ─ DELETREAR PALABRA × 2
  // ══════════════════════════════════════════════════════════════════════════

  await insertItem(lessonId, {
    sort_order: 60,
    type: 'word_scramble',
    question_text:
      'Ordena estas letras para formar una bebida:\nI - F - K - E - O - F',
    correct_answer: 'koffie',
    hint: 'Empieza por "k". Bebida oscura muy popular.',
    explanation: '"De koffie" — artículo "de".',
  });

  await insertItem(lessonId, {
    sort_order: 61,
    type: 'word_scramble',
    question_text:
      'Ordena las letras para formar una persona:\nE - D - R - V - N - I',
    correct_answer: 'vriend',
    hint: 'Relación cercana fuera de la familia.',
    explanation: '"De vriend" — artículo "de". Femenino: "de vriendin".',
  });
  console.log('✅  deletrear × 2');

  // ══════════════════════════════════════════════════════════════════════════
  // 8 ─ ESCRIBIR TRADUCCIÓN × 2
  //     Producción libre — más difícil, exige memoria activa
  // ══════════════════════════════════════════════════════════════════════════

  await insertItem(lessonId, {
    sort_order: 70,
    type: 'write_answer',
    question_text: 'Escribe en neerlandés (con artículo):\n"el libro"',
    correct_answer: 'het boek',
    hint: 'Recuerda incluir el artículo correcto.',
    explanation: '"Het boek" — los sustantivos neutros llevan "het".',
  });

  await insertItem(lessonId, {
    sort_order: 71,
    type: 'write_answer',
    question_text: 'Escribe en neerlandés (con artículo):\n"la casa"',
    correct_answer: 'het huis',
    hint: 'No olvides el artículo. Ojo: en neerlandés puede ser distinto al español.',
    explanation:
      '"Het huis" — aunque en español es femenino, en neerlandés es neutro.',
  });
  console.log('✅  escribir traducción × 2');

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('🎉  TEST ZONE — VOCABULARIO — listo');
  console.log('════════════════════════════════════════════════════════════');
  console.log('   • vocabulary_items  × 8');
  console.log('   • artículo de/het   × 2');
  console.log('   • traducción NL→ES  × 1');
  console.log('   • traducción ES→NL  × 1');
  console.log('   • completa frase    × 2');
  console.log('   • emparejar bebidas × 1 (3 pares)');
  console.log('   • emparejar animales× 1 (3 pares)');
  console.log('   • deletrear         × 2');
  console.log('   • escribir          × 2');
  console.log('════════════════════════════════════════════════════════════');
  console.log('   Total: 12 ejercicios, máx 2 por tipo.');
  console.log('════════════════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error('❌ ERROR:', e.message);
  process.exit(1);
});
