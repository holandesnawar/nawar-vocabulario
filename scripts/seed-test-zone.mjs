/**
 * seed-test-zone.mjs
 *
 * Crea la lección "🧪 Test Zone" con 2 ejercicios de cada tipo.
 * Idempotente — borra y recrea si ya existe.
 *
 * Uso: node scripts/seed-test-zone.mjs
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

async function patch(table, params, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH', headers, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${table}: ${r.status} ${await r.text()}`);
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
  console.log('🧪  Recreando Test Zone con ejercicios mejorados\n');

  // ── 1. Módulo ─────────────────────────────────────────────────────────────
  const [mod] = await get('modules', 'slug=eq.boodschappen&select=id');
  if (!mod) throw new Error('Módulo "boodschappen" no encontrado');
  const moduleId = mod.id;

  // ── 2. Upsert lección ─────────────────────────────────────────────────────
  let lessonId;
  const existing = await get('lessons', 'slug=eq.test-zone&select=id');
  if (existing.length > 0) {
    lessonId = existing[0].id;
    await patch('lessons', `id=eq.${lessonId}`, {
      module_id: moduleId, slug: 'test-zone',
      title_nl: '🧪 Test Zone', title_es: 'Prueba todos los tipos de ejercicio',
      sort_order: 99, is_extra: true,
    });
    // Limpiar ejercicios previos
    const prev = await get('practice_items', `lesson_id=eq.${lessonId}&select=id`);
    if (prev.length > 0) {
      const ids = prev.map(i => i.id).join(',');
      await del('match_pair_items', `practice_item_id=in.(${ids})`);
      await del('practice_options',  `practice_item_id=in.(${ids})`);
      await del('practice_items',    `lesson_id=eq.${lessonId}`);
    }
    console.log(`✅  Lección existente, ID: ${lessonId} — limpiada\n`);
  } else {
    const [lesson] = await post('lessons', {
      module_id: moduleId, slug: 'test-zone',
      title_nl: '🧪 Test Zone', title_es: 'Prueba todos los tipos de ejercicio',
      sort_order: 99, is_extra: true,
    });
    lessonId = lesson.id;
    console.log(`✅  Lección creada, ID: ${lessonId}\n`);
  }

  let id;

  // ══════════════════════════════════════════════════════════════════════════
  // 1 ─ MULTIPLE CHOICE × 2
  //     Contexto real: ¿qué dices en situaciones del día a día?
  // ══════════════════════════════════════════════════════════════════════════

  // En un café — ¿cuál es la frase correcta para pedir?
  id = await insertItem(lessonId, {
    sort_order: 10,
    type: 'multiple_choice',
    question_text: 'Estás en un café. El camarero te mira. ¿Qué dices para pedir un café?',
    correct_answer: 'Mag ik een koffie, alstublieft?',
    explanation: '"Mag ik…" es la forma estándar y educada de pedir en establecimientos. "Kan ik…" también es correcto pero menos frecuente.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'Mag ik een koffie, alstublieft?', is_correct: true  },
    { practice_item_id: id, sort_order: 2, option_text: 'Ik moet een koffie.',             is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'Geef mij koffie.',                is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'Koffie is lekker.',               is_correct: false },
  ]);

  // ¿Qué significa "graag" en contexto?
  id = await insertItem(lessonId, {
    sort_order: 11,
    type: 'multiple_choice',
    question_text: 'Tu amigo te ofrece ayuda y responde: "Ja, graag!" ¿Qué quiere decir?',
    correct_answer: 'Sí, ¡con mucho gusto!',
    explanation: '"Graag" expresa disposición positiva. Se usa tanto para aceptar una oferta como para pedir algo cortésmente.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'Sí, ¡con mucho gusto!',    is_correct: true  },
    { practice_item_id: id, sort_order: 2, option_text: 'No, gracias.',              is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'No lo sé.',                 is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'Por favor, más despacio.', is_correct: false },
  ]);
  console.log('✅  multiple_choice × 2');

  // ══════════════════════════════════════════════════════════════════════════
  // 2 ─ FILL BLANK × 2
  //     Oraciones completas con hueco semántico claro
  // ══════════════════════════════════════════════════════════════════════════

  await insertItem(lessonId, {
    sort_order: 20,
    type: 'fill_blank',
    question_text: 'Het brood is op. Ik ga naar de _____ om brood te kopen.',
    correct_answer: 'supermarkt',
    hint: 'Es el lugar donde compras comida. En neerlandés tiene el mismo origen que en español.',
    explanation: '"Supermarkt" = supermercado. "Op" significa "agotado / acabado".',
  });

  await insertItem(lessonId, {
    sort_order: 21,
    type: 'fill_blank',
    question_text: 'Ik heb _____ . Mag ik iets eten? (Tengo hambre)',
    correct_answer: 'honger',
    hint: '"Honger" rima con "hunger" en inglés.',
    explanation: '"Honger hebben" = tener hambre. "Dorst hebben" = tener sed.',
  });
  console.log('✅  fill_blank × 2');

  // ══════════════════════════════════════════════════════════════════════════
  // 3 ─ ORDER SENTENCE × 2
  //     Frases reales con estructura V2 (verbo en segunda posición)
  // ══════════════════════════════════════════════════════════════════════════

  id = await insertItem(lessonId, {
    sort_order: 30,
    type: 'order_sentence',
    question_text: 'Ordena para decir: "Esta noche quiero cocinar en casa."',
    correct_answer: 'Vanavond wil ik thuis koken',
    hint: 'En neerlandés, cuando un complemento de tiempo va primero, el verbo ocupa la segunda posición.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'Vanavond', is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'wil',      is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'ik',       is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'thuis',    is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'koken',    is_correct: false },
    { practice_item_id: id, sort_order: 6, option_text: 'eten',     is_correct: false },
  ]);

  id = await insertItem(lessonId, {
    sort_order: 31,
    type: 'order_sentence',
    question_text: 'Ordena: "Ella bebe té porque tiene frío."',
    correct_answer: 'Zij drinkt thee want zij heeft het koud',
    hint: '"Want" = porque. Une dos frases independientes.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'Zij',     is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'drinkt',  is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'thee',    is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'want',    is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'zij',     is_correct: false },
    { practice_item_id: id, sort_order: 6, option_text: 'heeft',   is_correct: false },
    { practice_item_id: id, sort_order: 7, option_text: 'het',     is_correct: false },
    { practice_item_id: id, sort_order: 8, option_text: 'koud',    is_correct: false },
  ]);
  console.log('✅  order_sentence × 2');

  // ══════════════════════════════════════════════════════════════════════════
  // 4 ─ WORD SCRAMBLE × 2
  //     Palabras clave del módulo con pistas de contexto
  // ══════════════════════════════════════════════════════════════════════════

  await insertItem(lessonId, {
    sort_order: 40,
    type: 'word_scramble',
    question_text: 'Descifra esta palabra neerlandesa:\nS - U - P - E - R - M - A - R - K - T\n¿Dónde vas a comprar comida?',
    correct_answer: 'supermarkt',
    hint: '10 letras. Es casi igual en español.',
    explanation: '"De supermarkt" — artículo "de". Por ejemplo: "Ik ga naar de supermarkt."',
  });

  await insertItem(lessonId, {
    sort_order: 41,
    type: 'word_scramble',
    question_text: 'Descifra:\nR - E - S - T - A - U - R - A - N - T\n¿Dónde sales a cenar?',
    correct_answer: 'restaurant',
    hint: '10 letras. Igual que en español, sin la "e" final.',
    explanation: '"Het restaurant" — artículo "het". "Uiteten in een restaurant" = cenar fuera.',
  });
  console.log('✅  word_scramble × 2');

  // ══════════════════════════════════════════════════════════════════════════
  // 5 ─ MATCH PAIRS × 2
  //     Par 1: expresiones de cantidad / necesidad
  //     Par 2: opuestos / antónimos de comida
  // ══════════════════════════════════════════════════════════════════════════

  id = await insertItem(lessonId, {
    sort_order: 50,
    type: 'match_pairs',
    question_text: 'Une cada frase neerlandesa con su equivalente en español.',
    correct_answer: '',
  });
  await post('match_pair_items', [
    { practice_item_id: id, sort_order: 1, left_text: 'Ik heb honger.',     right_text: 'Tengo hambre.' },
    { practice_item_id: id, sort_order: 2, left_text: 'Ik heb dorst.',      right_text: 'Tengo sed.' },
    { practice_item_id: id, sort_order: 3, left_text: 'Het is lekker.',     right_text: 'Está rico.' },
    { practice_item_id: id, sort_order: 4, left_text: 'Het is duur.',       right_text: 'Es caro.' },
  ]);

  id = await insertItem(lessonId, {
    sort_order: 51,
    type: 'match_pairs',
    question_text: 'Une cada palabra con su opuesto.',
    correct_answer: '',
  });
  await post('match_pair_items', [
    { practice_item_id: id, sort_order: 1, left_text: 'lekker (rico)',   right_text: 'vies (asqueroso)' },
    { practice_item_id: id, sort_order: 2, left_text: 'duur (caro)',     right_text: 'goedkoop (barato)' },
    { practice_item_id: id, sort_order: 3, left_text: 'warm (caliente)', right_text: 'koud (frío)' },
    { practice_item_id: id, sort_order: 4, left_text: 'honger (hambre)', right_text: 'dorst (sed)' },
  ]);
  console.log('✅  match_pairs × 2');

  // ══════════════════════════════════════════════════════════════════════════
  // 6 ─ WRITE ANSWER × 2
  //     Producción libre — traducción con contexto real
  // ══════════════════════════════════════════════════════════════════════════

  await insertItem(lessonId, {
    sort_order: 60,
    type: 'write_answer',
    question_text: 'Estás en un supermercado y no encuentras el pan. Pregunta a un empleado:\n"¿Dónde está el pan, por favor?"',
    correct_answer: 'Waar is het brood, alstublieft?',
    hint: 'Empieza por "Waar" (dónde). Recuerda que "brood" lleva artículo "het".',
    explanation: '"Waar is…?" = ¿Dónde está…? Muy útil en tiendas. "Alstublieft" al final para ser educado.',
  });

  await insertItem(lessonId, {
    sort_order: 61,
    type: 'write_answer',
    question_text: 'Dile a tu amigo que no quieres pizza porque no tienes hambre.\n"No quiero pizza porque no tengo hambre."',
    correct_answer: 'Ik wil geen pizza want ik heb geen honger.',
    hint: 'Usa "want" para unir las dos ideas. "geen" niega el sustantivo.',
    explanation: '"Geen" se usa para negar sustantivos (ik heb geen honger). "Niet" niega verbos/adjetivos.',
  });
  console.log('✅  write_answer × 2');

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('🎉  TEST ZONE actualizada — 12 ejercicios listos');
  console.log('════════════════════════════════════════════════════════════');
  console.log('   • multiple_choice  × 2  (situaciones reales del café)');
  console.log('   • fill_blank       × 2  (huecos semánticos)');
  console.log('   • order_sentence   × 2  (estructura V2 + want)');
  console.log('   • word_scramble    × 2  (vocabulario del módulo)');
  console.log('   • match_pairs      × 2  (frases + antónimos)');
  console.log('   • write_answer     × 2  (producción en contexto real)');
  console.log('════════════════════════════════════════════════════════════\n');
}

main().catch(e => { console.error('❌ ERROR:', e.message); process.exit(1); });
