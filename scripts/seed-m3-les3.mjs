/**
 * seed-m3-les3.mjs
 *
 * Inserta el Módulo 3 Lección 3 "Grammatica | Vragende woorden" en Supabase.
 * Idempotente: borra datos previos antes de insertar.
 *
 * Uso: node scripts/seed-m3-les3.mjs
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
    lesson_id:     lessonId,
    sort_order:    data.sort_order,
    type:          data.type,
    question_text: data.question_text,
    correct_answer:data.correct_answer,
    hint:          data.hint   ?? null,
    explanation:   data.explanation ?? null,
  });
  return item.id;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱  Seeding M3 Les 3 — Grammatica | Vragende woorden\n');

  // ── 1. Obtener módulo ────────────────────────────────────────────────────
  const [mod] = await get('modules', 'slug=eq.boodschappen&select=id');
  if (!mod) throw new Error('Módulo "boodschappen" no encontrado');
  const moduleId = mod.id;
  console.log(`✅ Módulo ID: ${moduleId}`);

  // ── 2. Upsert lección ────────────────────────────────────────────────────
  let lessonId;
  const existing = await get('lessons', 'slug=eq.m3-les-3-grammatica&select=id');
  if (existing.length > 0) {
    lessonId = existing[0].id;
    await patch('lessons', `id=eq.${lessonId}`, {
      module_id: moduleId, slug: 'm3-les-3-grammatica',
      title_nl: 'Les 3 — Grammatica | Vragende woorden',
      title_es: 'Hacer preguntas en neerlandés',
      sort_order: 3, is_extra: false,
    });
    console.log(`✅ Lección actualizada, ID: ${lessonId}`);
  } else {
    const [lesson] = await post('lessons', {
      module_id: moduleId, slug: 'm3-les-3-grammatica',
      title_nl: 'Les 3 — Grammatica | Vragende woorden',
      title_es: 'Hacer preguntas en neerlandés',
      sort_order: 3, is_extra: false,
    });
    lessonId = lesson.id;
    console.log(`✅ Lección creada, ID: ${lessonId}`);
  }

  // ── 3. Limpiar datos existentes (idempotente) ────────────────────────────
  const practiceRows = await get('practice_items', `lesson_id=eq.${lessonId}&select=id`);
  if (practiceRows.length > 0) {
    const ids = practiceRows.map(r => r.id).join(',');
    await del('match_pair_items', `practice_item_id=in.(${ids})`);
    await del('practice_options',  `practice_item_id=in.(${ids})`);
  }
  await del('practice_items',  `lesson_id=eq.${lessonId}`);
  await del('phrases',         `lesson_id=eq.${lessonId}`);
  await del('vocabulary_items',`lesson_id=eq.${lessonId}`);

  const dialogueRows = await get('dialogues', `lesson_id=eq.${lessonId}&select=id`);
  if (dialogueRows.length > 0) {
    const ids = dialogueRows.map(r => r.id).join(',');
    await del('dialogue_lines', `dialogue_id=in.(${ids})`);
  }
  await del('dialogues', `lesson_id=eq.${lessonId}`);

  try {
    const ltRows = await get('lezen_texts', `lesson_id=eq.${lessonId}&select=id`);
    if (ltRows.length > 0) {
      const textIds = ltRows.map(r => r.id).join(',');
      const leRows = await get('lezen_exercises', `lezen_text_id=in.(${textIds})&select=id`);
      if (leRows.length > 0) {
        const exIds = leRows.map(r => r.id).join(',');
        await del('lezen_exercise_options', `lezen_exercise_id=in.(${exIds})`);
      }
      await del('lezen_exercises', `lezen_text_id=in.(${textIds})`);
    }
    await del('lezen_texts', `lesson_id=eq.${lessonId}`);
  } catch (e) {
    console.warn('⚠️  lezen tables not found — skipping lezen cleanup');
  }
  console.log('✅ Datos anteriores limpiados\n');

  // ── 4. Vocabulario (17 palabras) ─────────────────────────────────────────
  await post('vocabulary_items', [
    { lesson_id: lessonId, sort_order:  1, article: null,  word_nl: 'wat',        translation_es: 'qué',                       audio_url: null },
    { lesson_id: lessonId, sort_order:  2, article: null,  word_nl: 'waar',       translation_es: 'dónde',                     audio_url: null },
    { lesson_id: lessonId, sort_order:  3, article: null,  word_nl: 'wanneer',    translation_es: 'cuándo',                    audio_url: null },
    { lesson_id: lessonId, sort_order:  4, article: null,  word_nl: 'wie',        translation_es: 'quién',                     audio_url: null },
    { lesson_id: lessonId, sort_order:  5, article: null,  word_nl: 'hoeveel',    translation_es: 'cuánto / cuánta / cuántos', audio_url: null },
    { lesson_id: lessonId, sort_order:  6, article: 'de',  word_nl: 'de koffie',  translation_es: 'el café',                   audio_url: null },
    { lesson_id: lessonId, sort_order:  7, article: 'de',  word_nl: 'de thee',    translation_es: 'el té',                     audio_url: null },
    { lesson_id: lessonId, sort_order:  8, article: 'het', word_nl: 'het water',  translation_es: 'el agua',                   audio_url: null },
    { lesson_id: lessonId, sort_order:  9, article: 'het', word_nl: 'het broodje',translation_es: 'el bocadillo',              audio_url: null },
    { lesson_id: lessonId, sort_order: 10, article: 'de',  word_nl: 'de suiker',  translation_es: 'el azúcar',                 audio_url: null },
    { lesson_id: lessonId, sort_order: 11, article: 'het', word_nl: 'het vlees',  translation_es: 'la carne',                  audio_url: null },
    { lesson_id: lessonId, sort_order: 12, article: 'de',  word_nl: 'de vis',     translation_es: 'el pescado',                audio_url: null },
    { lesson_id: lessonId, sort_order: 13, article: null,  word_nl: 'drinken',    translation_es: 'beber',                     audio_url: null },
    { lesson_id: lessonId, sort_order: 14, article: null,  word_nl: 'eten',       translation_es: 'comer',                     audio_url: null },
    { lesson_id: lessonId, sort_order: 15, article: null,  word_nl: 'willen',     translation_es: 'querer',                    audio_url: null },
    { lesson_id: lessonId, sort_order: 16, article: null,  word_nl: 'komen',      translation_es: 'venir',                     audio_url: null },
    { lesson_id: lessonId, sort_order: 17, article: null,  word_nl: 'geen',       translation_es: 'no / ningún / ninguna',     audio_url: null },
  ]);
  console.log('✅ Vocabulario: 17 palabras');

  // ── 5. Frases (10) ───────────────────────────────────────────────────────
  await post('phrases', [
    { lesson_id: lessonId, sort_order:  1, phrase_nl: 'Drink je koffie?',           translation_es: '¿Bebes café?',              audio_url: null },
    { lesson_id: lessonId, sort_order:  2, phrase_nl: 'Wil je thee?',               translation_es: '¿Quieres té?',              audio_url: null },
    { lesson_id: lessonId, sort_order:  3, phrase_nl: 'Wat drink je?',              translation_es: '¿Qué bebes?',               audio_url: null },
    { lesson_id: lessonId, sort_order:  4, phrase_nl: 'Waar eet je?',               translation_es: '¿Dónde comes?',             audio_url: null },
    { lesson_id: lessonId, sort_order:  5, phrase_nl: 'Wanneer eten we?',            translation_es: '¿Cuándo comemos?',          audio_url: null },
    { lesson_id: lessonId, sort_order:  6, phrase_nl: 'Wie komt er?',               translation_es: '¿Quién viene?',             audio_url: null },
    { lesson_id: lessonId, sort_order:  7, phrase_nl: 'Hoeveel suiker wil je?',     translation_es: '¿Cuánta azúcar quieres?',   audio_url: null },
    { lesson_id: lessonId, sort_order:  8, phrase_nl: 'Nee, ik drink geen koffie.', translation_es: 'No, no bebo café.',         audio_url: null },
    { lesson_id: lessonId, sort_order:  9, phrase_nl: 'Ja, ik wil thee.',           translation_es: 'Sí, quiero té.',            audio_url: null },
    { lesson_id: lessonId, sort_order: 10, phrase_nl: 'Ik eet geen vlees.',         translation_es: 'No como carne.',            audio_url: null },
  ]);
  console.log('✅ Frases: 10 frases');

  // ── 6. Lezen ─────────────────────────────────────────────────────────────
  try {
    const textNl = 'Ana en Tom zitten in een café. Het is gezellig.\n\nAna drinkt koffie en Tom drinkt thee. Ze eten ook iets. Tom eet een broodje kaas. Ana eet geen broodje – ze neemt een salade.\n\nDe ober vraagt: "Hoeveel suiker wilt u?" Ana wil twee suiker in haar koffie. Tom wil geen suiker.\n\nLater stuurt Sam een bericht: "Wie is er in het café? En wanneer eten jullie vanavond? Ik wil ook komen!" Tom antwoordt: "Wij eten om zeven uur thuis. Kom je ook?"';
    const textEs = 'Ana y Tom están sentados en un café. Es muy agradable.\n\nAna bebe café y Tom bebe té. También comen algo. Tom come un bocadillo de queso. Ana no come bocadillo — toma una ensalada.\n\nEl camarero pregunta: "¿Cuánta azúcar quiere?" Ana quiere dos azúcares en su café. Tom no quiere azúcar.\n\nMás tarde Sam envía un mensaje: "¿Quién está en el café? ¿Y cuándo coméis esta noche? ¡Yo también quiero venir!" Tom responde: "Comemos a las siete en casa. ¿Vienes también?"';

    const [lt] = await post('lezen_texts', { lesson_id: lessonId, sort_order: 1, text_nl: textNl, text_es: textEs });

    const lezenQs = [
      { prompt: 'Wat drinkt Ana?',           correct: 'koffie',           opts: ['koffie', 'thee', 'water'],                      exp: 'Ana drinkt koffie. Tom drinkt thee.' },
      { prompt: 'Wat drinkt Tom?',           correct: 'thee',             opts: ['koffie', 'thee', 'sap'],                        exp: 'Tom drinkt thee. Ana drinkt koffie.' },
      { prompt: 'Eet Ana een broodje?',      correct: 'Nee',              opts: ['Ja', 'Nee'],                                    exp: 'Ana eet geen broodje — ze neemt een salade.' },
      { prompt: 'Wat eet Tom?',              correct: 'een broodje kaas', opts: ['een salade', 'een broodje kaas', 'soep'],       exp: 'Tom eet een broodje kaas.' },
      { prompt: 'Hoeveel suiker wil Ana?',   correct: 'twee suiker',      opts: ['één suiker', 'twee suiker', 'geen suiker'],     exp: 'Ana wil twee suiker in haar koffie.' },
      { prompt: 'Wil Tom suiker?',           correct: 'Nee',              opts: ['Ja', 'Nee'],                                    exp: 'Tom wil geen suiker.' },
      { prompt: 'Wie stuurt een bericht?',   correct: 'Sam',              opts: ['Ana', 'Tom', 'Sam'],                            exp: 'Sam stuurt een bericht aan Tom.' },
      { prompt: 'Wanneer eten ze vanavond?', correct: 'om zeven uur',     opts: ['om zes uur', 'om zeven uur', 'om acht uur'],   exp: 'Tom antwoordt: "Wij eten om zeven uur thuis."' },
    ];

    for (let i = 0; i < lezenQs.length; i++) {
      const q = lezenQs[i];
      const [le] = await post('lezen_exercises', {
        lezen_text_id: lt.id, sort_order: i + 1, type: 'multiple_choice',
        prompt: q.prompt, correct_answer: q.correct, hint: null, explanation: q.exp,
      });
      await post('lezen_exercise_options', q.opts.map((o, idx) => ({
        lezen_exercise_id: le.id, sort_order: idx + 1, option_text: o,
      })));
    }
    console.log('✅ Lezen: 1 texto + 8 preguntas de comprensión');
  } catch (e) {
    console.warn('⚠️  Lezen no insertado (tablas pueden no existir):', e.message);
  }

  // ── 7. Diálogo (12 líneas) ───────────────────────────────────────────────
  const [dlg] = await post('dialogues', {
    lesson_id: lessonId,
    title: 'Dialoog – In een café',
    audio_normal_url: null, audio_slow_url: null,
  });
  await post('dialogue_lines', [
    { dialogue_id: dlg.id, sort_order:  1, speaker: 'Ober',  text_nl: 'Goedemiddag! Wat wilt u drinken?',             text_es: 'Buenas tardes. ¿Qué quiere beber?',          audio_url: null },
    { dialogue_id: dlg.id, sort_order:  2, speaker: 'Klant', text_nl: 'Ik wil graag een koffie.',                      text_es: 'Quiero un café.',                            audio_url: null },
    { dialogue_id: dlg.id, sort_order:  3, speaker: 'Ober',  text_nl: 'Hoeveel suiker wilt u?',                        text_es: '¿Cuánta azúcar quiere?',                     audio_url: null },
    { dialogue_id: dlg.id, sort_order:  4, speaker: 'Klant', text_nl: 'Twee suiker, alstublieft.',                     text_es: 'Dos azúcares, por favor.',                   audio_url: null },
    { dialogue_id: dlg.id, sort_order:  5, speaker: 'Ober',  text_nl: 'Wilt u ook iets eten?',                         text_es: '¿Quiere también algo de comer?',             audio_url: null },
    { dialogue_id: dlg.id, sort_order:  6, speaker: 'Klant', text_nl: 'Ja. Wat heeft u?',                              text_es: 'Sí. ¿Qué tienen?',                           audio_url: null },
    { dialogue_id: dlg.id, sort_order:  7, speaker: 'Ober',  text_nl: 'Wij hebben broodjes, soep en salade.',          text_es: 'Tenemos bocadillos, sopa y ensalada.',       audio_url: null },
    { dialogue_id: dlg.id, sort_order:  8, speaker: 'Klant', text_nl: 'Ik neem een broodje kaas.',                     text_es: 'Tomo un bocadillo de queso.',                audio_url: null },
    { dialogue_id: dlg.id, sort_order:  9, speaker: 'Ober',  text_nl: 'Prima. Wilt u nog iets?',                       text_es: 'Perfecto. ¿Quiere algo más?',                audio_url: null },
    { dialogue_id: dlg.id, sort_order: 10, speaker: 'Klant', text_nl: 'Nee, dat is alles. Mag ik pinnen?',             text_es: 'No, eso es todo. ¿Puedo pagar con tarjeta?', audio_url: null },
    { dialogue_id: dlg.id, sort_order: 11, speaker: 'Ober',  text_nl: 'Ja, natuurlijk. Dat is €7,50.',                 text_es: 'Sí, claro. Son 7,50 €.',                    audio_url: null },
    { dialogue_id: dlg.id, sort_order: 12, speaker: 'Klant', text_nl: 'Dank u wel.',                                   text_es: 'Gracias.',                                   audio_url: null },
  ]);
  console.log('✅ Diálogo: 12 líneas\n');

  // ── 8. Ejercicios ────────────────────────────────────────────────────────

  // EJ. 1 — Kies het vragende woord (fill_blank, 100–106)
  for (const d of [
    { s: 100, q: '______ drink je? (¿qué bebes?)',                        a: 'Wat',      h: '"Wat" = qué',      e: '"Wat" se usa para preguntar por una cosa. Wat drink je? = ¿Qué bebes?' },
    { s: 101, q: '______ eet je? (¿dónde comes?)',                        a: 'Waar',     h: '"Waar" = dónde',   e: '"Waar" se usa para preguntar por un lugar. Waar eet je? = ¿Dónde comes?' },
    { s: 102, q: '______ eten we? (¿cuándo comemos?)',                    a: 'Wanneer',  h: '"Wanneer" = cuándo',e: '"Wanneer" se usa para preguntar por el momento. Wanneer eten we? = ¿Cuándo comemos?' },
    { s: 103, q: '______ komt er? (¿quién viene?)',                       a: 'Wie',      h: '"Wie" = quién',    e: '"Wie" se usa para preguntar por una persona. Wie komt er? = ¿Quién viene?' },
    { s: 104, q: '______ suiker wil je? (¿cuánta azúcar quieres?)',       a: 'Hoeveel',  h: '"Hoeveel" = cuánto / cuánta', e: '"Hoeveel" se usa para preguntar por cantidad. Hoeveel suiker wil je? = ¿Cuánta azúcar quieres?' },
    { s: 105, q: 'Nee, ik drink ______ koffie. (respuesta negativa)',     a: 'geen',     h: '"Geen" para negar un sustantivo', e: '"Geen" + sustantivo = negación. Ik drink geen koffie = No bebo café.' },
    { s: 106, q: '______ wil thee? (¿quién quiere té?)',                  a: 'Wie',      h: '"Wie" se usa para personas', e: '"Wie wil thee?" = ¿Quién quiere té? "Wie" pregunta siempre por una persona.' },
  ]) { await insertItem(lessonId, { sort_order: d.s, type: 'fill_blank', question_text: d.q, correct_answer: d.a, hint: d.h, explanation: d.e }); }
  console.log('✅ EJ.1 fill_blank — kies het vragende woord (7)');

  // EJ. 2 — Maak een vraag (order_sentence, 110–114)
  let id;
  id = await insertItem(lessonId, { sort_order: 110, type: 'order_sentence', question_text: 'Ordena: "¿Qué bebes?" → drink / jij / wat', correct_answer: 'Wat drink jij?', hint: 'La palabra interrogativa va primero, después verbo + sujeto', explanation: 'Estructura W-vraag: palabra interrogativa + verbo + sujeto. Wat drink jij?' });
  await post('practice_options', [{ practice_item_id: id, sort_order: 1, option_text: 'drink', is_correct: false }, { practice_item_id: id, sort_order: 2, option_text: 'jij', is_correct: false }, { practice_item_id: id, sort_order: 3, option_text: 'wat', is_correct: false }]);

  id = await insertItem(lessonId, { sort_order: 111, type: 'order_sentence', question_text: 'Ordena: "¿Bebes café?" → koffie / drink / jij', correct_answer: 'Drink jij koffie?', hint: 'Las preguntas de sí/no empiezan con el verbo', explanation: 'Ja/nee-vraag: verbo + sujeto + complemento. Drink jij koffie?' });
  await post('practice_options', [{ practice_item_id: id, sort_order: 1, option_text: 'koffie', is_correct: false }, { practice_item_id: id, sort_order: 2, option_text: 'drink', is_correct: false }, { practice_item_id: id, sort_order: 3, option_text: 'jij', is_correct: false }]);

  id = await insertItem(lessonId, { sort_order: 112, type: 'order_sentence', question_text: 'Ordena: "¿Cuánta azúcar quieres?" → suiker / hoeveel / wil / je', correct_answer: 'Hoeveel suiker wil je?', hint: '"Hoeveel" va primero, luego el complemento, después verbo + sujeto', explanation: 'Estructura: hoeveel + sustantivo + verbo + sujeto. Hoeveel suiker wil je?' });
  await post('practice_options', [{ practice_item_id: id, sort_order: 1, option_text: 'suiker', is_correct: false }, { practice_item_id: id, sort_order: 2, option_text: 'hoeveel', is_correct: false }, { practice_item_id: id, sort_order: 3, option_text: 'wil', is_correct: false }, { practice_item_id: id, sort_order: 4, option_text: 'je', is_correct: false }]);

  id = await insertItem(lessonId, { sort_order: 113, type: 'order_sentence', question_text: 'Ordena: "¿Cuándo comemos?" → wanneer / eten / we', correct_answer: 'Wanneer eten we?', hint: '"Wanneer" va primero, después verbo + sujeto', explanation: 'Estructura W-vraag: wanneer + verbo + sujeto. Wanneer eten we?' });
  await post('practice_options', [{ practice_item_id: id, sort_order: 1, option_text: 'wanneer', is_correct: false }, { practice_item_id: id, sort_order: 2, option_text: 'eten', is_correct: false }, { practice_item_id: id, sort_order: 3, option_text: 'we', is_correct: false }]);

  id = await insertItem(lessonId, { sort_order: 114, type: 'order_sentence', question_text: 'Ordena: "¿Quién viene?" → er / wie / komt', correct_answer: 'Wie komt er?', hint: '"Wie" va primero, después verbo + sujeto', explanation: 'Estructura W-vraag: wie + verbo + er. "Er" es una partícula muy común en esta frase.' });
  await post('practice_options', [{ practice_item_id: id, sort_order: 1, option_text: 'er', is_correct: false }, { practice_item_id: id, sort_order: 2, option_text: 'wie', is_correct: false }, { practice_item_id: id, sort_order: 3, option_text: 'komt', is_correct: false }]);
  console.log('✅ EJ.2 order_sentence — maak een vraag (5)');

  // EJ. 3 — Waar of niet waar? (multiple_choice, 120–127)
  for (const d of [
    { s: 120, q: '¿Es correcto? Una pregunta de sí/no suele empezar con el verbo.',                                              a: 'Verdadero', e: 'Verdadero. Ja/nee-vragen: verbo + sujeto + resto. Ejemplo: Drink je koffie?' },
    { s: 121, q: '¿Es correcto? "Wat drink jij?" es una estructura correcta.',                                                    a: 'Verdadero', e: 'Verdadero. W-vraag: palabra interrogativa + verbo + sujeto. Wat drink jij? = ¿Qué bebes?' },
    { s: 122, q: '¿Es correcto? "Jij drinkt koffie?" es la forma estándar de hacer una pregunta.',                               a: 'Falso',     e: 'Falso. La forma correcta es "Drink jij koffie?" — el verbo va antes del sujeto en las preguntas.' },
    { s: 123, q: '¿Es correcto? "Geen" se usa para negar un sustantivo.',                                                         a: 'Verdadero', e: 'Verdadero. "Geen" + sustantivo = negación. Nee, ik drink geen koffie.' },
    { s: 124, q: '¿Es correcto? "Hoeveel" significa "cuánto / cuánta".',                                                          a: 'Verdadero', e: 'Verdadero. "Hoeveel" = cuánto / cuánta / cuántos. Se usa para preguntar por cantidad.' },
    { s: 125, q: '¿Es correcto? "Waar" significa "cuándo".',                                                                      a: 'Falso',     e: 'Falso. "Waar" = dónde. "Wanneer" = cuándo. No las confundas.' },
    { s: 126, q: '¿Es correcto? "Wie komt er?" significa "¿Quién viene?".',                                                       a: 'Verdadero', e: 'Verdadero. "Wie komt er?" = ¿Quién viene? "Er" es una partícula de lugar muy frecuente.' },
    { s: 127, q: '¿Es correcto? En preguntas con "jij", el verbo pierde la -t: "Drinkt jij" → "Drink jij".',                     a: 'Verdadero', e: 'Verdadero. Cuando "jij" sigue al verbo en una pregunta, la -t desaparece. Drinkt → drink.' },
  ]) {
    id = await insertItem(lessonId, { sort_order: d.s, type: 'multiple_choice', question_text: d.q, correct_answer: d.a, explanation: d.e });
    await post('practice_options', [
      { practice_item_id: id, sort_order: 1, option_text: 'Verdadero', is_correct: d.a === 'Verdadero' },
      { practice_item_id: id, sort_order: 2, option_text: 'Falso',     is_correct: d.a === 'Falso' },
    ]);
  }
  console.log('✅ EJ.3 multiple_choice — waar of niet waar (8)');

  // EJ. 4 — Match pairs (130)
  id = await insertItem(lessonId, { sort_order: 130, type: 'match_pairs', question_text: 'Une cada palabra interrogativa con su significado en español', correct_answer: '' });
  await post('match_pair_items', [
    { practice_item_id: id, sort_order: 1, left_text: 'wat',     right_text: 'qué' },
    { practice_item_id: id, sort_order: 2, left_text: 'waar',    right_text: 'dónde' },
    { practice_item_id: id, sort_order: 3, left_text: 'wanneer', right_text: 'cuándo' },
    { practice_item_id: id, sort_order: 4, left_text: 'wie',     right_text: 'quién' },
    { practice_item_id: id, sort_order: 5, left_text: 'hoeveel', right_text: 'cuánto / cuánta' },
  ]);
  console.log('✅ EJ.4 match_pairs — koppel vraagwoorden (1)');

  // EJ. 5 — Negatie met "geen" (fill_blank, 140–144)
  for (const d of [
    { s: 140, q: 'Drink je koffie? → Nee, ik drink ______ koffie.',    a: 'geen', h: '"Geen" para negar un sustantivo', e: '"Geen" + sustantivo = negación. Ik drink geen koffie = No bebo café.' },
    { s: 141, q: 'Wil je thee? → Nee, ik wil ______ thee.',            a: 'geen', h: '"Geen" para negar un sustantivo', e: '"Geen" + sustantivo = negación. Ik wil geen thee = No quiero té.' },
    { s: 142, q: 'Eet je vlees? → Nee, ik eet ______ vlees.',          a: 'geen', h: '"Geen" se usa siempre antes del sustantivo', e: '"Geen" + sustantivo = negación. Ik eet geen vlees = No como carne.' },
    { s: 143, q: 'Wil je suiker? → Nee, ik wil ______ suiker.',        a: 'geen', h: '"Geen" para negar un sustantivo', e: '"Geen" + sustantivo = negación. Ik wil geen suiker = No quiero azúcar.' },
    { s: 144, q: 'Neem je een broodje? → Nee, ik neem ______ broodje.',a: 'geen', h: '"Geen" se usa delante de "broodje" (sustantivo)', e: '"Geen" + sustantivo = negación. Ik neem geen broodje = No tomo bocadillo.' },
  ]) { await insertItem(lessonId, { sort_order: d.s, type: 'fill_blank', question_text: d.q, correct_answer: d.a, hint: d.h, explanation: d.e }); }
  console.log('✅ EJ.5 fill_blank — negatie met geen (5)');

  // EJ. 6 — Verbeter de zinnen (fill_blank, 150–155)
  for (const d of [
    { s: 150, q: 'Error: "Jij drinkt koffie?" → ¿cuál es la forma correcta?',                              a: 'Drink jij koffie?',        h: 'En preguntas, el verbo va antes del sujeto', e: 'Correcto: Drink jij koffie? Las preguntas invierten el orden: verbo + sujeto.' },
    { s: 151, q: 'Error: "Wat jij drinkt?" → ¿cuál es el orden correcto?',                                 a: 'Wat drink jij?',           h: 'Después de la palabra interrogativa va el verbo', e: 'Correcto: Wat drink jij? Estructura W-vraag: wat + verbo + sujeto.' },
    { s: 152, q: 'Error: "Drinkt jij thee?" → ¿cuál es la forma correcta? (la -t desaparece)',             a: 'Drink jij thee?',          h: 'La -t desaparece cuando jij sigue al verbo', e: 'Correcto: Drink jij thee? La -t de "drinkt" desaparece porque "jij" sigue al verbo.' },
    { s: 153, q: 'Error: "Hoeveel jij wil suiker?" → ¿cuál es el orden correcto?',                         a: 'Hoeveel suiker wil jij?',  h: 'Estructura: hoeveel + sustantivo + verbo + sujeto', e: 'Correcto: Hoeveel suiker wil jij? El sustantivo sigue a "hoeveel", luego verbo + sujeto.' },
    { s: 154, q: 'Error: "Ik drink geen koffie ja." → ¿cómo queda la respuesta negativa correcta?',        a: 'Nee, ik drink geen koffie.',h: 'Una respuesta negativa empieza con "Nee"', e: 'Correcto: Nee, ik drink geen koffie. Las respuestas negativas empiezan con "Nee".' },
    { s: 155, q: 'Error: "Waar jij eet?" → ¿cuál es el orden correcto?',                                   a: 'Waar eet jij?',            h: 'Después de la palabra interrogativa va el verbo', e: 'Correcto: Waar eet jij? Estructura W-vraag: waar + verbo + sujeto.' },
  ]) { await insertItem(lessonId, { sort_order: d.s, type: 'fill_blank', question_text: d.q, correct_answer: d.a, hint: d.h, explanation: d.e }); }
  console.log('✅ EJ.6 fill_blank — verbeter de zinnen (6)');

  // EJ. 7 — Vertaal naar het Nederlands (fill_blank, 160–165)
  for (const d of [
    { s: 160, q: '¿Bebes café? → ______ (en neerlandés)',       a: 'Drink jij koffie?',         h: 'Ja/nee-vraag: verbo + sujeto + complemento', e: 'Correcto: Drink jij koffie? Estructura de pregunta sí/no.' },
    { s: 161, q: '¿Qué bebes? → ______ (en neerlandés)',        a: 'Wat drink jij?',            h: '"Wat" = qué. W-vraag: wat + verbo + sujeto', e: 'Correcto: Wat drink jij? Estructura W-vraag con "wat".' },
    { s: 162, q: '¿Dónde comes? → ______ (en neerlandés)',      a: 'Waar eet jij?',             h: '"Waar" = dónde. W-vraag: waar + verbo + sujeto', e: 'Correcto: Waar eet jij? Estructura W-vraag con "waar".' },
    { s: 163, q: '¿Cuándo comemos? → ______ (en neerlandés)',   a: 'Wanneer eten we?',          h: '"Wanneer" = cuándo. W-vraag: wanneer + verbo + sujeto', e: 'Correcto: Wanneer eten we? Estructura W-vraag con "wanneer".' },
    { s: 164, q: 'No, no bebo café. → ______ (en neerlandés)',  a: 'Nee, ik drink geen koffie.',h: '"Nee" + "geen" + sustantivo = respuesta negativa', e: 'Correcto: Nee, ik drink geen koffie. Estructura de respuesta negativa.' },
    { s: 165, q: '¿Quién viene? → ______ (en neerlandés)',      a: 'Wie komt er?',              h: '"Wie" = quién. W-vraag: wie + verbo + er', e: 'Correcto: Wie komt er? "Er" es muy frecuente con "wie komt".' },
  ]) { await insertItem(lessonId, { sort_order: d.s, type: 'fill_blank', question_text: d.q, correct_answer: d.a, hint: d.h, explanation: d.e }); }
  console.log('✅ EJ.7 fill_blank — vertaal ES→NL (6)');

  // EJ. 8 — Completa el diálogo (fill_blank, 170–173)
  for (const d of [
    { s: 170, q: 'Ober: "______ wilt u drinken?" (completa la pregunta del camarero)',                   a: 'Wat',     h: '"Wat" = qué — pregunta por una cosa', e: 'El camarero pregunta: Wat wilt u drinken? = ¿Qué quiere beber?' },
    { s: 171, q: 'Klant: "Ik wil ______ een koffie." (completa con la palabra que suaviza la petición)', a: 'graag',   h: '"Graag" hace la petición más amable y natural', e: '"Graag" = con gusto / por favor. Ik wil graag een koffie.' },
    { s: 172, q: 'Ober: "______ suiker wilt u?" (pregunta por cantidad)',                                 a: 'Hoeveel', h: '"Hoeveel" = cuánto / cuánta — pregunta por cantidad', e: 'Hoeveel suiker wilt u? = ¿Cuánta azúcar quiere?' },
    { s: 173, q: 'Klant: "Nee, ______ is alles." (completa la frase de cierre)',                         a: 'dat',     h: '"Dat is alles" = eso es todo', e: 'Nee, dat is alles. = No, eso es todo. Frase muy útil para cerrar un pedido.' },
  ]) { await insertItem(lessonId, { sort_order: d.s, type: 'fill_blank', question_text: d.q, correct_answer: d.a, hint: d.h, explanation: d.e }); }
  console.log('✅ EJ.8 fill_blank — completa el diálogo (4)');

  console.log('\n🎉 ¡Lección M3 Les 3 cargada correctamente!');
  console.log(`   Lesson ID : ${lessonId}`);
  console.log('   Vocabulario: 17  |  Frases: 10  |  Lezen: 1 texto + 8 preguntas');
  console.log('   Diálogo: 12 líneas  |  Ejercicios: 41 items');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
