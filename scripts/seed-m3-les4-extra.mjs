/**
 * seed-m3-les4-extra.mjs
 *
 * Añade vocabulario extra + frases adicionales a la Lección 4 del Módulo 3.
 * NO borra el contenido existente — usa sort_order >= 100 para no colisionar.
 * Idempotente: borra los registros extra (sort_order >= 100) antes de insertar.
 *
 * Uso: node scripts/seed-m3-les4-extra.mjs
 *      (ejecutar DESPUÉS de seed-m3-les4.mjs)
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
  console.error('Faltan variables de entorno en .env.local');
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

async function main() {
  console.log('🌱  Extra content — M3 Les 4 | Voegwoorden\n');

  // ── Obtener lección ───────────────────────────────────────────────────────
  const [lesson] = await get('lessons', 'slug=eq.m3-les-4-voegwoorden&select=id');
  if (!lesson) throw new Error('Lección m3-les-4-voegwoorden no encontrada. Ejecuta seed-m3-les4.mjs primero.');
  const lessonId = lesson.id;
  console.log(`✅ Lección ID: ${lessonId}`);

  // ── Limpiar extra anterior (sort_order >= 100) ────────────────────────────
  const extraPractice = await get('practice_items', `lesson_id=eq.${lessonId}&sort_order=gte.200&select=id`);
  if (extraPractice.length > 0) {
    const ids = extraPractice.map(r => r.id).join(',');
    await del('match_pair_items', `practice_item_id=in.(${ids})`);
    await del('practice_options', `practice_item_id=in.(${ids})`);
  }
  await del('practice_items',   `lesson_id=eq.${lessonId}&sort_order=gte.200`);
  await del('phrases',          `lesson_id=eq.${lessonId}&sort_order=gte.100`);
  await del('vocabulary_items', `lesson_id=eq.${lessonId}&sort_order=gte.100`);
  console.log('✅ Extra anterior limpiado\n');

  // ══════════════════════════════════════════════════════════════════════════
  // VOCABULARIO EXTRA (sort_order 100–112)
  //
  // 🎓 Director Académico: Estas 13 palabras aparecen directamente en el
  //    diálogo y el texto de lectura de esta lección pero no están en el
  //    vocabulario base (sort_order 1-18). Son A1 puro, altamente frecuentes
  //    en conversación cotidiana, y esenciales en una formación premium.
  //    Notas especiales:
  //    · "graag" y "alsjeblieft" son las dos herramientas de cortesía básica
  //      en neerlandés — imprescindibles desde el primer día.
  //    · "nog" es una de las partículas más frecuentes del neerlandés
  //      (todavía, más, aún) y confunde mucho a hispanohablantes.
  //    · "al" (ya) vs "nog" (todavía) es un par que hay que aprender juntos.
  //    · "blij" es el adjetivo de emoción más básico del idioma.
  // ══════════════════════════════════════════════════════════════════════════
  await post('vocabulary_items', [
    // Cortesía y función — imprescindibles A1
    { lesson_id: lessonId, sort_order: 100, article: null,  word_nl: 'graag',        translation_es: 'con gusto, gustosamente (cortés)',    audio_url: null },
    { lesson_id: lessonId, sort_order: 101, article: null,  word_nl: 'alsjeblieft',  translation_es: 'por favor (informal)',                 audio_url: null },
    { lesson_id: lessonId, sort_order: 102, article: null,  word_nl: 'alstublieft',  translation_es: 'por favor (formal) / aquí tiene',      audio_url: null },
    // Partículas de tiempo — muy frecuentes
    { lesson_id: lessonId, sort_order: 103, article: null,  word_nl: 'nog',          translation_es: 'todavía, más, aún',                   audio_url: null },
    { lesson_id: lessonId, sort_order: 104, article: null,  word_nl: 'al',           translation_es: 'ya (indica que algo ha ocurrido)',     audio_url: null },
    { lesson_id: lessonId, sort_order: 105, article: null,  word_nl: 'laat',         translation_es: 'tarde',                               audio_url: null },
    { lesson_id: lessonId, sort_order: 106, article: null,  word_nl: 'vroeg',        translation_es: 'temprano',                            audio_url: null },
    // Contexto de la lección
    { lesson_id: lessonId, sort_order: 107, article: null,  word_nl: 'thuis',        translation_es: 'en casa',                             audio_url: null },
    { lesson_id: lessonId, sort_order: 108, article: null,  word_nl: 'buiten',       translation_es: 'fuera, afuera',                       audio_url: null },
    { lesson_id: lessonId, sort_order: 109, article: 'de',  word_nl: 'honger',       translation_es: 'el hambre (ik heb honger = tengo hambre)', audio_url: null },
    { lesson_id: lessonId, sort_order: 110, article: 'de',  word_nl: 'taart',        translation_es: 'la tarta, el pastel',                 audio_url: null },
    { lesson_id: lessonId, sort_order: 111, article: null,  word_nl: 'blij',         translation_es: 'contento/a, alegre',                  audio_url: null },
    { lesson_id: lessonId, sort_order: 112, article: null,  word_nl: 'goedkoop',     translation_es: 'barato/a',                            audio_url: null },
  ]);
  console.log('✅ Vocabulario extra: 13 palabras (sort_order 100–112)');

  // ══════════════════════════════════════════════════════════════════════════
  // FRASES EXTRA (sort_order 100–109)
  //
  // 🎓 Director Académico: 10 frases que ilustran usos naturales de las
  //    conjunciones en contexto de la lección. Combinan el vocabulario nuevo
  //    (graag, nog, al, thuis, honger, taart...) con las conjunciones
  //    aprendidas. Estas son frases que un alumno de nivel A1+ usará
  //    en conversación real desde la primera semana.
  // ══════════════════════════════════════════════════════════════════════════
  await post('phrases', [
    { lesson_id: lessonId, sort_order: 100, phrase_nl: 'Ik wil graag koffie en een koekje.',                translation_es: 'Me gustaría un café y una galleta.',             audio_url: null },
    { lesson_id: lessonId, sort_order: 101, phrase_nl: 'Wil je nog iets eten of drinken?',                 translation_es: '¿Quieres comer o beber algo más?',                audio_url: null },
    { lesson_id: lessonId, sort_order: 102, phrase_nl: 'Ik heb honger, maar ik wil niet koken.',           translation_es: 'Tengo hambre, pero no quiero cocinar.',           audio_url: null },
    { lesson_id: lessonId, sort_order: 103, phrase_nl: 'Eet je thuis of ga je naar het restaurant?',       translation_es: '¿Comes en casa o vas al restaurante?',            audio_url: null },
    { lesson_id: lessonId, sort_order: 104, phrase_nl: 'De soep is goedkoop, maar ook lekker.',            translation_es: 'La sopa es barata, pero también está rica.',      audio_url: null },
    { lesson_id: lessonId, sort_order: 105, phrase_nl: 'Ik wil vroeg eten, want ik ben moe.',              translation_es: 'Quiero comer temprano porque estoy cansado/a.',   audio_url: null },
    { lesson_id: lessonId, sort_order: 106, phrase_nl: 'Mag ik de rekening, alsjeblieft?',                 translation_es: '¿Me trae la cuenta, por favor?',                  audio_url: null },
    { lesson_id: lessonId, sort_order: 107, phrase_nl: 'Ik neem een stuk taart en een koffie.',            translation_es: 'Tomo un trozo de tarta y un café.',               audio_url: null },
    { lesson_id: lessonId, sort_order: 108, phrase_nl: 'Hij is blij, want het eten is lekker.',            translation_es: 'Está contento porque la comida está rica.',       audio_url: null },
    { lesson_id: lessonId, sort_order: 109, phrase_nl: 'Ik eet niet buiten, want het is koud.',            translation_es: 'No como fuera porque hace frío.',                 audio_url: null },
  ]);
  console.log('✅ Frases extra: 10 frases (sort_order 100–109)');

  // ══════════════════════════════════════════════════════════════════════════
  // EJERCICIOS EXTRA (sort_order 200–212)
  //
  // 🎓 Director Académico: 13 ejercicios adicionales que consolidan
  //    el vocabulario nuevo (graag, nog, al, thuis, honger...) y refuerzan
  //    las conjunciones en contextos más variados y naturales.
  //    Mix: fill_blank sobre vocab nuevo + MC sobre usos de "nog" y "al"
  //    + order_sentence con frases del nuevo vocabulario + match_pairs.
  // ══════════════════════════════════════════════════════════════════════════
  let id;

  // ─── E200–204: fill_blank — vocabulario nuevo (graag, nog, al, thuis, honger) ─
  for (const d of [
    { s: 200, q: 'Ik wil ___ koffie en een koekje. (pide de forma cortés)',                    a: 'graag',      h: '"Graag" suaviza la petición — como "me gustaría"',          e: '"Graag" hace la petición más educada. Ik wil graag koffie. No tiene traducción directa exacta; equivale a "con gusto" o "me gustaría".' },
    { s: 201, q: 'Wil je ___ iets eten? (¿quieres comer algo más?)',                           a: 'nog',        h: '"Nog" + iets = algo más',                                   e: '"Nog iets" = algo más. Wil je nog iets eten? = ¿Quieres comer algo más? "Nog" añade la idea de "adicionalmente" o "todavía".' },
    { s: 202, q: 'Het is ___ laat. Ik wil thee, want ik drink geen koffie meer. (ya es tarde)', a: 'al',        h: '"Al" = ya — indica que algo ha ocurrido antes de lo esperado', e: '"Al" = ya. Het is al laat = ya es tarde. Contrasta con "nog" (todavía): Ik heb nog geen koffie vs. Ik heb al koffie.' },
    { s: 203, q: 'Ik eet niet uit, want ik wil ___ eten. (en casa)',                           a: 'thuis',      h: '"Thuis" = en casa (sin preposición en neerlandés)',           e: '"Thuis" = en casa. No necesita preposición: Ik eet thuis (no "bij thuis"). Ik eet thuis, want ik wil niet uiteten.' },
    { s: 204, q: 'Ik heb ___. Ik ga naar de supermarkt, want we hebben niets meer. (hambre)',  a: 'honger',     h: '"Honger" = hambre. "Ik heb honger" — se usa con "hebben"',   e: '"Honger" = hambre. En neerlandés: ik HEB honger (tengo hambre), igual que en inglés "I have hunger". No se dice "ik ben honger".' },
  ]) { await insertItem(lessonId, { sort_order: d.s, type: 'fill_blank', question_text: d.q, correct_answer: d.a, hint: d.h, explanation: d.e }); }
  console.log('✅ E200–204 fill_blank — vocabulario nuevo (5)');

  // ─── E205–207: multiple_choice — nog vs al ────────────────────────────────
  for (const d of [
    {
      s: 205,
      q: '¿Cuál es la diferencia entre "nog" y "al"?',
      a: '"Nog" = todavía / más; "al" = ya',
      opts: ['"Nog" = todavía / más; "al" = ya', '"Nog" = ya; "al" = todavía', '"Nog" = nunca; "al" = siempre', 'Son sinónimos'],
      e: '"Nog" (todavía/más): Ik heb nog honger. "Al" (ya): Ik heb al gegeten. Son opuestos temporales muy frecuentes en neerlandés.',
    },
    {
      s: 206,
      q: '"Wil je ___ iets?" — ¿cuál funciona para ofrecer algo más?',
      a: 'nog',
      opts: ['nog', 'al', 'niet', 'geen'],
      e: '"Wil je nog iets?" = ¿Quieres algo más? "Nog" añade la idea de algo adicional. "Al" sería "¿ya quieres algo?", que tiene otro sentido.',
    },
    {
      s: 207,
      q: '¿Cómo se dice "ya es tarde" en neerlandés?',
      a: 'Het is al laat.',
      opts: ['Het is al laat.', 'Het is nog laat.', 'Het is niet laat.', 'Het is meer laat.'],
      e: '"Het is al laat" = ya es tarde. "Al" indica que algo ha ocurrido antes de lo esperado o ha llegado un momento anticipado.',
    },
  ]) {
    id = await insertItem(lessonId, { sort_order: d.s, type: 'multiple_choice', question_text: d.q, correct_answer: d.a, explanation: d.e });
    await post('practice_options', d.opts.map((o, idx) => ({
      practice_item_id: id, sort_order: idx + 1, option_text: o, is_correct: o === d.a,
    })));
  }
  console.log('✅ E205–207 multiple_choice — nog vs al (3)');

  // ─── E208–210: order_sentence — frases con vocabulario extra ─────────────
  id = await insertItem(lessonId, {
    sort_order: 208, type: 'order_sentence',
    question_text: 'Ordena: "Quiero comer en casa porque estoy cansado/a." → ik / eten / thuis / want / moe / ik / wil / ben',
    correct_answer: 'Ik wil thuis eten, want ik ben moe.',
    hint: 'Estructura: Ik wil + lugar + infinitivo, want + razón',
    explanation: 'Ik wil thuis eten, want ik ben moe. "Thuis" va después del verbo auxiliar y antes del infinitivo. "Want" introduce la razón.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'ik',    is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'eten',  is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'thuis', is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'want',  is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'moe',   is_correct: false },
    { practice_item_id: id, sort_order: 6, option_text: 'ik',    is_correct: false },
    { practice_item_id: id, sort_order: 7, option_text: 'wil',   is_correct: false },
    { practice_item_id: id, sort_order: 8, option_text: 'ben',   is_correct: false },
  ]);

  id = await insertItem(lessonId, {
    sort_order: 209, type: 'order_sentence',
    question_text: 'Ordena: "¿Quieres comer aquí o para llevar?" → eten / hier / of / wil / meenemen / je',
    correct_answer: 'Wil je hier eten of meenemen?',
    hint: '"Wil je" empieza la pregunta; "hier eten" y "meenemen" son las opciones con "of"',
    explanation: 'Wil je hier eten of meenemen? Estructura de pregunta con alternativa: verbo + sujeto + opción 1 + of + opción 2.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'eten',     is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'hier',     is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'of',       is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'wil',      is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'meenemen', is_correct: false },
    { practice_item_id: id, sort_order: 6, option_text: 'je',       is_correct: false },
  ]);

  id = await insertItem(lessonId, {
    sort_order: 210, type: 'order_sentence',
    question_text: 'Ordena: "Él está contento porque la sopa está rica." → blij / hij / want / lekker / is / de / soep / is',
    correct_answer: 'Hij is blij, want de soep is lekker.',
    hint: 'Estructura: hij + is + adj + want + frase de razón',
    explanation: 'Hij is blij, want de soep is lekker. "Want" introduce la razón. "Blij" = contento.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'blij',  is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'hij',   is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'want',  is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'lekker',is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'is',    is_correct: false },
    { practice_item_id: id, sort_order: 6, option_text: 'de',    is_correct: false },
    { practice_item_id: id, sort_order: 7, option_text: 'soep',  is_correct: false },
    { practice_item_id: id, sort_order: 8, option_text: 'is',    is_correct: false },
  ]);
  console.log('✅ E208–210 order_sentence — frases con vocabulario nuevo (3)');

  // ─── E211: match_pairs — vocabulario nuevo ───────────────────────────────
  id = await insertItem(lessonId, {
    sort_order: 211, type: 'match_pairs',
    question_text: 'Une cada palabra nueva con su significado en español',
    correct_answer: '',
  });
  await post('match_pair_items', [
    { practice_item_id: id, sort_order: 1, left_text: 'graag',      right_text: 'con gusto / me gustaría' },
    { practice_item_id: id, sort_order: 2, left_text: 'nog',        right_text: 'todavía / más' },
    { practice_item_id: id, sort_order: 3, left_text: 'al',         right_text: 'ya' },
    { practice_item_id: id, sort_order: 4, left_text: 'thuis',      right_text: 'en casa' },
    { practice_item_id: id, sort_order: 5, left_text: 'goedkoop',   right_text: 'barato/a' },
  ]);
  console.log('✅ E211 match_pairs — vocabulario nuevo (1, 5 pares)');

  // ─── E212: write_answer — producción libre con vocabulario nuevo ──────────
  await insertItem(lessonId, {
    sort_order: 212, type: 'write_answer',
    question_text: 'Crea una frase usando "want" y al menos una de estas palabras: honger / thuis / goedkoop / blij / laat',
    correct_answer: 'Ik eet thuis, want het is laat.',
    hint: 'Estructura: frase 1 + want + razón (usando una de las palabras clave)',
    explanation: 'Ejemplo: Ik eet thuis, want het is laat. O también: Hij is blij, want de soep is goedkoop. O: Ik ga naar huis, want ik heb honger.',
  });
  console.log('✅ E212 write_answer — producción libre (1)');

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ EXTRA COMPLETADO — M3 Les 4 | Voegwoorden');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Lesson ID  : ${lessonId}`);
  console.log('   📚 Vocabulario extra: 13 palabras (sort_order 100–112)');
  console.log('      graag, alsjeblieft, alstublieft, nog, al, laat, vroeg,');
  console.log('      thuis, buiten, honger, taart, blij, goedkoop');
  console.log('   💬 Frases extra:      10 frases (sort_order 100–109)');
  console.log('   🎯 Ejercicios extra:  13 (sort_order 200–212)');
  console.log('      • fill_blank:      5  (vocabulario nuevo)');
  console.log('      • multiple_choice: 3  (nog vs al)');
  console.log('      • order_sentence:  3  (frases naturales)');
  console.log('      • match_pairs:     1  (5 pares)');
  console.log('      • write_answer:    1  (producción libre)');
  console.log('');
  console.log('   📊 TOTALES LECCIÓN COMPLETA (base + extra):');
  console.log('      Vocabulario: 31 palabras | Frases: 20 | Ejercicios: 43');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
