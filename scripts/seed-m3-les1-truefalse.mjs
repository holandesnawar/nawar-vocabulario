/**
 * seed-m3-les1-truefalse.mjs
 *
 * Añade ejercicios verdadero/falso al Módulo 3 Lección 1.
 * Se insertan como multiple_choice con opciones ['Verdadero', 'Falso'].
 * sort_order 200-206 (no colisiona con nada existente).
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

const TF_EXERCISES = [
  {
    sort_order: 200,
    question_text: '"De melk" se usa con el verbo "drinken", no con "eten".',
    correct_answer: 'Verdadero',
    hint: 'La leche es un líquido.',
    explanation: 'Correcto. "Ik drink melk." — Los líquidos usan "drinken". Excepción: soep → eten.',
  },
  {
    sort_order: 201,
    question_text: '"Het ontbijt" significa "la cena".',
    correct_answer: 'Falso',
    hint: 'Hay tres momentos del día para comer.',
    explanation: '"Het ontbijt" = el desayuno. "La cena" es "het avondeten".',
  },
  {
    sort_order: 202,
    question_text: 'En neerlandés, "de soep" usa el verbo "drinken" porque es líquida.',
    correct_answer: 'Falso',
    hint: 'Piensa: ¿se come con cuchara?',
    explanation: '"Ik eet soep." — En neerlandés la sopa se "come" aunque sea líquida. Si se toma con cuchara → "eten".',
  },
  {
    sort_order: 203,
    question_text: '"Pinnen" significa pagar con tarjeta en los Países Bajos.',
    correct_answer: 'Verdadero',
    hint: 'Es un término muy típico del neerlandés cotidiano.',
    explanation: '"Pinnen" = pagar con tarjeta (PIN). En NL casi todo se paga con tarjeta, es muy habitual.',
  },
  {
    sort_order: 204,
    question_text: '"Staan" y "liggen" son sinónimos que significan "estar".',
    correct_answer: 'Falso',
    hint: 'Piensa en una botella (vertical) vs un libro (plano).',
    explanation: '"Staan" = estar de pie/vertical (botellas, cajas). "Liggen" = estar tumbado/plano (libros, bolsas). No son sinónimos.',
  },
  {
    sort_order: 205,
    question_text: '"De ingang" es la salida del supermercado.',
    correct_answer: 'Falso',
    hint: 'In- viene del prefijo de entrada.',
    explanation: '"De ingang" = la entrada. "De uitgang" = la salida. "In" = dentro, "uit" = fuera.',
  },
  {
    sort_order: 206,
    question_text: 'En neerlandés, cuando un adverbio de tiempo va al principio de la frase, el sujeto va después del verbo.',
    correct_answer: 'Verdadero',
    hint: 'Ej: "Als ontbijt eet ik brood." — ¿quién va después del verbo?',
    explanation: 'Regla de inversión: "Als ontbijt eet ik brood." (ik va después de eet). El verbo siempre ocupa la 2ª posición.',
  },
];

async function main() {
  console.log('🔍 Buscando lección...');
  const modules = await get('modules', 'slug=eq.boodschappen&select=id');
  if (!modules.length) throw new Error('Módulo boodschappen no encontrado.');
  const lessons = await get('lessons', `module_id=eq.${modules[0].id}&slug=eq.m3-les-1-eten-en-drinken&select=id`);
  if (!lessons.length) throw new Error('Lección no encontrada.');
  const lessonId = lessons[0].id;
  console.log(`✅ Lección id: ${lessonId}`);

  // Limpiar verdadero/falso anteriores (sort_order 200-206)
  const existing = await get('practice_items', `lesson_id=eq.${lessonId}&sort_order=gte.200&sort_order=lte.206&select=id`);
  for (const r of existing) {
    try { await del('practice_options', `practice_item_id=eq.${r.id}`); } catch {}
  }
  if (existing.length) await del('practice_items', `lesson_id=eq.${lessonId}&sort_order=gte.200&sort_order=lte.206`);

  console.log('🧩 Insertando verdadero/falso...');
  for (const ex of TF_EXERCISES) {
    const [item] = await post('practice_items', {
      lesson_id:      lessonId,
      sort_order:     ex.sort_order,
      type:           'multiple_choice',
      question_text:  ex.question_text,
      correct_answer: ex.correct_answer,
      hint:           ex.hint,
      explanation:    ex.explanation,
    });
    await post('practice_options', [
      { practice_item_id: item.id, sort_order: 1, option_text: 'Verdadero', is_correct: ex.correct_answer === 'Verdadero' },
      { practice_item_id: item.id, sort_order: 2, option_text: 'Falso',     is_correct: ex.correct_answer === 'Falso' },
    ]);
    console.log(`   ✅ [${ex.sort_order}] ${ex.question_text.slice(0, 50)}...`);
  }

  console.log(`\n🎉 ${TF_EXERCISES.length} ejercicios verdadero/falso insertados.`);
}

main().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });
