/**
 * seed-m3-les4.mjs
 *
 * Inserta el Módulo 3 Lección 4 "Zinnen verbinden | Voegwoorden" en Supabase.
 * Idempotente: borra datos previos antes de insertar.
 *
 * Uso: node scripts/seed-m3-les4.mjs
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
  console.log('🌱  Seeding M3 Les 4 — Zinnen verbinden | Voegwoorden\n');

  // ── 1. Obtener módulo ────────────────────────────────────────────────────
  const [mod] = await get('modules', 'slug=eq.boodschappen&select=id');
  if (!mod) throw new Error('Módulo "boodschappen" no encontrado');
  const moduleId = mod.id;
  console.log(`✅ Módulo ID: ${moduleId}`);

  // ── 2. Upsert lección ────────────────────────────────────────────────────
  let lessonId;
  const existing = await get('lessons', 'slug=eq.m3-les-4-voegwoorden&select=id');
  if (existing.length > 0) {
    lessonId = existing[0].id;
    await patch('lessons', `id=eq.${lessonId}`, {
      module_id: moduleId, slug: 'm3-les-4-voegwoorden',
      title_nl:  'Les 4 — Zinnen verbinden | Voegwoorden',
      title_es:  'Conectar frases con conjunciones',
      sort_order: 4, is_extra: false,
    });
    console.log(`✅ Lección actualizada, ID: ${lessonId}`);
  } else {
    const [lesson] = await post('lessons', {
      module_id: moduleId, slug: 'm3-les-4-voegwoorden',
      title_nl:  'Les 4 — Zinnen verbinden | Voegwoorden',
      title_es:  'Conectar frases con conjunciones',
      sort_order: 4, is_extra: false,
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
  await del('practice_items',   `lesson_id=eq.${lessonId}`);
  await del('phrases',          `lesson_id=eq.${lessonId}`);
  await del('vocabulary_items', `lesson_id=eq.${lessonId}`);

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

  // ── 4. Vocabulario (18 palabras) ─────────────────────────────────────────
  //
  // 🎓 Director Académico: Esta es una lección de gramática pura sobre
  //    conjunciones. El vocabulario incluye las 4 conjunciones como ítems
  //    principales, más palabras nuevas de los ejemplos del PPTX que no
  //    estaban en Les 1-3 (koekje, pizza, soep, salade, dorst, lekker, duur,
  //    koud, koken, uiteten, restaurant). Elke dag es muy útil para A1.
  //
  await post('vocabulary_items', [
    // Las 4 conjunciones — el corazón de la lección
    { lesson_id: lessonId, sort_order:  1, article: null,  word_nl: 'en',         translation_es: 'y (conjunción)',                   audio_url: null },
    { lesson_id: lessonId, sort_order:  2, article: null,  word_nl: 'maar',       translation_es: 'pero (conjunción)',                audio_url: null },
    { lesson_id: lessonId, sort_order:  3, article: null,  word_nl: 'of',         translation_es: 'o (conjunción)',                   audio_url: null },
    { lesson_id: lessonId, sort_order:  4, article: null,  word_nl: 'want',       translation_es: 'porque (conjunción)',              audio_url: null },
    // Gramática
    { lesson_id: lessonId, sort_order:  5, article: 'het', word_nl: 'voegwoord',  translation_es: 'la conjunción',                    audio_url: null },
    { lesson_id: lessonId, sort_order:  6, article: null,  word_nl: 'verbinden',  translation_es: 'conectar, unir',                   audio_url: null },
    // Vocabulario de contexto nuevo (del PPTX + enriquecimiento A1)
    { lesson_id: lessonId, sort_order:  7, article: 'het', word_nl: 'koekje',     translation_es: 'la galleta',                       audio_url: null },
    { lesson_id: lessonId, sort_order:  8, article: 'de',  word_nl: 'pizza',      translation_es: 'la pizza',                         audio_url: null },
    { lesson_id: lessonId, sort_order:  9, article: 'de',  word_nl: 'soep',       translation_es: 'la sopa',                          audio_url: null },
    { lesson_id: lessonId, sort_order: 10, article: 'de',  word_nl: 'salade',     translation_es: 'la ensalada',                      audio_url: null },
    { lesson_id: lessonId, sort_order: 11, article: null,  word_nl: 'lekker',     translation_es: 'rico/a, delicioso/a, agradable',   audio_url: null },
    { lesson_id: lessonId, sort_order: 12, article: null,  word_nl: 'duur',       translation_es: 'caro/a',                           audio_url: null },
    { lesson_id: lessonId, sort_order: 13, article: null,  word_nl: 'koud',       translation_es: 'frío/a',                           audio_url: null },
    { lesson_id: lessonId, sort_order: 14, article: 'de',  word_nl: 'dorst',      translation_es: 'la sed',                           audio_url: null },
    { lesson_id: lessonId, sort_order: 15, article: null,  word_nl: 'koken',      translation_es: 'cocinar',                          audio_url: null },
    { lesson_id: lessonId, sort_order: 16, article: null,  word_nl: 'uiteten',    translation_es: 'cenar fuera, salir a comer',       audio_url: null },
    { lesson_id: lessonId, sort_order: 17, article: 'het', word_nl: 'restaurant', translation_es: 'el restaurante',                   audio_url: null },
    { lesson_id: lessonId, sort_order: 18, article: null,  word_nl: 'elke dag',   translation_es: 'cada día, todos los días',         audio_url: null },
  ]);
  console.log('✅ Vocabulario: 18 palabras');

  // ── 5. Frases (10) ───────────────────────────────────────────────────────
  //
  // 🎓 Director Académico: Las 4 frases del PPTX son perfectas, pero
  //    necesitamos frases que muestren los distintos matices de cada
  //    conjunción. Añado 6 frases extra que ilustran usos variados, incluyendo
  //    el falso cognado maar/want que los hispanohablantes confunden.
  //
  await post('phrases', [
    { lesson_id: lessonId, sort_order:  1, phrase_nl: 'Ik drink koffie en ik eet een koekje.',              translation_es: 'Bebo café y como una galleta.',                      audio_url: null },
    { lesson_id: lessonId, sort_order:  2, phrase_nl: 'Ik hou van pizza, maar ik eet niet elke dag pizza.', translation_es: 'Me gusta la pizza, pero no la como todos los días.',  audio_url: null },
    { lesson_id: lessonId, sort_order:  3, phrase_nl: 'Wil je thee of koffie?',                              translation_es: '¿Quieres té o café?',                                audio_url: null },
    { lesson_id: lessonId, sort_order:  4, phrase_nl: 'Ik ga naar de supermarkt, want ik heb geen brood.',  translation_es: 'Voy al supermercado porque no tengo pan.',             audio_url: null },
    { lesson_id: lessonId, sort_order:  5, phrase_nl: 'Ik drink water, want ik heb dorst.',                 translation_es: 'Bebo agua porque tengo sed.',                         audio_url: null },
    { lesson_id: lessonId, sort_order:  6, phrase_nl: 'Wij eten soep, want het is koud.',                   translation_es: 'Comemos sopa porque hace frío.',                      audio_url: null },
    { lesson_id: lessonId, sort_order:  7, phrase_nl: 'Ik wil koffie, maar ik neem thee.',                  translation_es: 'Quiero café, pero tomo té.',                          audio_url: null },
    { lesson_id: lessonId, sort_order:  8, phrase_nl: 'Hij eet vlees, maar zij eet vis.',                   translation_es: 'Él come carne, pero ella come pescado.',              audio_url: null },
    { lesson_id: lessonId, sort_order:  9, phrase_nl: 'Ik eet thuis, want het restaurant is dicht.',        translation_es: 'Como en casa porque el restaurante está cerrado.',    audio_url: null },
    { lesson_id: lessonId, sort_order: 10, phrase_nl: 'Ik wil koken of uiteten vanavond.',                  translation_es: 'Quiero cocinar o salir a cenar esta noche.',          audio_url: null },
  ]);
  console.log('✅ Frases: 10 frases');

  // ── 6. Lezen ─────────────────────────────────────────────────────────────
  //
  // 🎓 Director Académico: El texto usa las 4 conjunciones de forma natural
  //    y repetida en un contexto A1/A2 (ir al súper, comida en casa). Las
  //    preguntas de comprensión incluyen 5 MC + 2 fill_blank que piden
  //    identificar qué conjunción corresponde — refuerza la discriminación.
  //
  try {
    const textNl = `Tom heeft honger en dorst. Hij wil pizza, maar er is geen pizza thuis. Ana zegt: "Ik ga naar de supermarkt, want we hebben niets meer."

In de supermarkt ziet Ana pizza en soep. De pizza is lekker, maar ook duur. Ze koopt soep, want soep is goedkoop. Ze koopt ook melk en brood.

Thuis eten Tom en Ana soep. "Wil je koffie of thee?" vraagt Ana. "Ik wil thee, want het is al laat," zegt Tom. Ze drinken thee en eten koekjes. Tom is blij!`;

    const textEs = `Tom tiene hambre y sed. Quiere pizza, pero no hay pizza en casa. Ana dice: "Voy al supermercado porque no tenemos nada más."

En el supermercado, Ana ve pizza y sopa. La pizza está rica, pero también es cara. Compra sopa porque la sopa es barata. También compra leche y pan.

En casa, Tom y Ana comen sopa. "¿Quieres café o té?" pregunta Ana. "Quiero té porque ya es tarde," dice Tom. Beben té y comen galletas. ¡Tom está contento!`;

    const [lt] = await post('lezen_texts', { lesson_id: lessonId, sort_order: 1, text_nl: textNl, text_es: textEs });
    const ltId = lt.id;

    const lezenQs = [
      {
        sort: 1, type: 'multiple_choice',
        prompt: 'Wat wil Tom aan het begin?',
        correct: 'pizza',
        opts: ['pizza', 'soep', 'thee', 'brood'],
        exp: 'Tom heeft honger en dorst. Hij wil pizza, maar er is geen pizza thuis.',
      },
      {
        sort: 2, type: 'multiple_choice',
        prompt: 'Waarom gaat Ana naar de supermarkt?',
        correct: 'want ze hebben niets meer',
        opts: ['want ze niets meer hebben', 'want ze pizza wil kopen', 'want het koud is', 'want ze soep wil maken'],
        exp: 'Ana zegt: "Ik ga naar de supermarkt, want we hebben niets meer."',
      },
      {
        sort: 3, type: 'multiple_choice',
        prompt: 'Waarom koopt Ana geen pizza?',
        correct: 'De pizza is duur',
        opts: ['De pizza is duur', 'De pizza is niet lekker', 'Er is geen pizza', 'Tom wil geen pizza'],
        exp: 'De pizza is lekker, maar ook duur. Ze koopt soep, want soep is goedkoop.',
      },
      {
        sort: 4, type: 'multiple_choice',
        prompt: 'Wat koopt Ana in de supermarkt?',
        correct: 'soep, melk en brood',
        opts: ['pizza en soep', 'soep, melk en brood', 'melk en brood', 'soep en koekjes'],
        exp: 'Ze koopt soep. Ze koopt ook melk en brood.',
      },
      {
        sort: 5, type: 'multiple_choice',
        prompt: 'Wat drinken Tom en Ana thuis?',
        correct: 'thee',
        opts: ['koffie', 'thee', 'water', 'melk'],
        exp: '"Ik wil thee, want het is al laat." Ze drinken thee en eten koekjes.',
      },
      {
        sort: 6, type: 'fill_blank',
        prompt: 'Tom heeft honger ___ dorst. (Completa con la conjunción correcta)',
        correct: 'en',
        opts: null,
        exp: 'Tom heeft honger EN dorst. "En" une dos sustantivos — los dos son verdaderos a la vez.',
      },
      {
        sort: 7, type: 'fill_blank',
        prompt: 'Ze koopt soep, ___ soep is goedkoop. (Completa con la conjunción correcta)',
        correct: 'want',
        opts: null,
        exp: 'Ze koopt soep, WANT soep is goedkoop. "Want" introduce la razón de la compra.',
      },
    ];

    for (const q of lezenQs) {
      const [le] = await post('lezen_exercises', {
        lezen_text_id: ltId,
        sort_order:    q.sort,
        type:          q.type,
        prompt:        q.prompt,
        correct_answer: q.correct,
        hint:          null,
        explanation:   q.exp,
      });
      if (q.type === 'multiple_choice' && q.opts) {
        await post('lezen_exercise_options', q.opts.map((o, idx) => ({
          lezen_exercise_id: le.id, sort_order: idx + 1, option_text: o,
        })));
      }
    }
    console.log('✅ Lezen: 1 texto + 7 preguntas de comprensión');
  } catch (e) {
    console.warn('⚠️  Lezen no insertado:', e.message);
  }

  // ── 7. Diálogo (10 líneas) ───────────────────────────────────────────────
  //
  // 🎓 Director Académico: Diálogo entre Tom y Ana en un café. Usa las 4
  //    conjunciones de forma natural y orgánica —no forzada— dentro de una
  //    situación real: decidir qué pedir y si quedarse o irse.
  //
  const [dlg] = await post('dialogues', {
    lesson_id: lessonId,
    title:     'Dialoog – In het café',
    audio_normal_url: null, audio_slow_url: null,
  });
  await post('dialogue_lines', [
    { dialogue_id: dlg.id, sort_order:  1, speaker: 'Tom',  text_nl: 'Ik wil koffie en ik wil een koekje.',                     text_es: 'Quiero café y quiero una galleta.',                         audio_url: null },
    { dialogue_id: dlg.id, sort_order:  2, speaker: 'Ana',  text_nl: 'Ik wil ook iets drinken, maar ik neem thee.',             text_es: 'Yo también quiero beber algo, pero tomo té.',               audio_url: null },
    { dialogue_id: dlg.id, sort_order:  3, speaker: 'Tom',  text_nl: 'Wil je een koekje of een stuk taart?',                    text_es: '¿Quieres una galleta o un trozo de tarta?',                 audio_url: null },
    { dialogue_id: dlg.id, sort_order:  4, speaker: 'Ana',  text_nl: 'Ik neem een koekje, maar geen suiker in mijn thee.',      text_es: 'Tomo una galleta, pero sin azúcar en mi té.',              audio_url: null },
    { dialogue_id: dlg.id, sort_order:  5, speaker: 'Tom',  text_nl: 'Wil je hier eten of naar huis gaan?',                     text_es: '¿Quieres comer aquí o ir a casa?',                          audio_url: null },
    { dialogue_id: dlg.id, sort_order:  6, speaker: 'Ana',  text_nl: 'Ik wil hier eten, want ik heb honger.',                   text_es: 'Quiero comer aquí porque tengo hambre.',                    audio_url: null },
    { dialogue_id: dlg.id, sort_order:  7, speaker: 'Tom',  text_nl: 'Prima. Ik neem soep en een broodje.',                     text_es: 'Perfecto. Tomo sopa y un bocadillo.',                       audio_url: null },
    { dialogue_id: dlg.id, sort_order:  8, speaker: 'Ana',  text_nl: 'Ik ook. De soep is lekker hier, maar wel duur.',          text_es: 'Yo también. La sopa está rica aquí, pero es cara.',         audio_url: null },
    { dialogue_id: dlg.id, sort_order:  9, speaker: 'Tom',  text_nl: 'Dat geeft niet. Ik betaal, want jij hebt gisteren betaald.', text_es: 'No importa. Pago yo porque tú pagaste ayer.',            audio_url: null },
    { dialogue_id: dlg.id, sort_order: 10, speaker: 'Ana',  text_nl: 'Dank je! Jij bent lief en heel aardig!',                  text_es: '¡Gracias! ¡Eres amable y muy agradable!',                   audio_url: null },
  ]);
  console.log('✅ Diálogo: 10 líneas\n');

  // ── 8. Ejercicios de práctica ─────────────────────────────────────────────

  let id;

  // ─── GRUPO 1: Kies de juiste voegwoord — fill_blank (1–6) ────────────────
  // 🎓 El ejercicio más importante de la lección: discriminar en contexto
  //    entre en/maar/of/want. Un ejercicio por cada uso + dos de refuerzo.
  for (const d of [
    { s:  1, q: 'Ik drink koffie ___ ik eet een koekje. (dos acciones juntas)',          a: 'en',   h: '"en" = y — une dos elementos positivos',            e: '"En" conecta dos acciones. Ik drink koffie EN ik eet een koekje. No hay contraste ni razón.' },
    { s:  2, q: 'Ik hou van pizza, ___ ik eet niet elke dag pizza. (contraste)',         a: 'maar', h: '"maar" = pero — introduce un contraste o excepción', e: '"Maar" expresa contraste. Me gusta, PERO no lo como a diario. Hay una excepción a lo esperado.' },
    { s:  3, q: 'Wil je thee ___ koffie? (dos alternativas)',                            a: 'of',   h: '"of" = o — presenta dos opciones excluyentes',       e: '"Of" presenta alternativas. Solo puedes elegir una: Wil je thee OF koffie?' },
    { s:  4, q: 'Ik ga naar de supermarkt, ___ ik heb geen brood. (razón del viaje)',   a: 'want', h: '"want" = porque — introduce la razón',               e: '"Want" introduce siempre la razón o explicación. La segunda frase explica la primera.' },
    { s:  5, q: 'Ik wil koffie, ___ ik neem thee. (cambia de opción)',                  a: 'maar', h: '"maar" también aparece cuando cambias de preferencia', e: '"Maar" también sirve cuando corriges o cambias de opinión. Quiero X, PERO tomo Y.' },
    { s:  6, q: 'Wij eten soep, ___ het is koud. (explica por qué comen sopa)',         a: 'want', h: '"want" = porque — siempre explica la razón',          e: '"Want" introduce la razón. Comemos sopa PORQUE hace frío. La segunda frase explica la primera.' },
  ]) { await insertItem(lessonId, { sort_order: d.s, type: 'fill_blank', question_text: d.q, correct_answer: d.a, hint: d.h, explanation: d.e }); }
  console.log('✅ GRUPO 1 fill_blank — kies de voegwoord (6)');

  // ─── GRUPO 2: Verbind de zinnen — order_sentence (10–13) ─────────────────
  // 🎓 Ordenar las palabras de una frase compuesta. El desafío es que el
  //    estudiante debe saber qué token es la conjunción y colocarla
  //    correctamente. Se usan frases del diálogo y del lezen.
  id = await insertItem(lessonId, {
    sort_order: 10, type: 'order_sentence',
    question_text: 'Ordena: "Bebo café y como una galleta." → ik / drink / koffie / en / ik / eet / een / koekje',
    correct_answer: 'Ik drink koffie en ik eet een koekje.',
    hint: '"En" va en el centro, entre las dos frases. El orden no cambia.',
    explanation: 'Con "en", el orden es igual en ambas partes: sujeto + verbo + complemento EN sujeto + verbo + complemento.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'ik',     is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'drink',  is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'koffie', is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'en',     is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'ik',     is_correct: false },
    { practice_item_id: id, sort_order: 6, option_text: 'eet',    is_correct: false },
    { practice_item_id: id, sort_order: 7, option_text: 'een',    is_correct: false },
    { practice_item_id: id, sort_order: 8, option_text: 'koekje', is_correct: false },
  ]);

  id = await insertItem(lessonId, {
    sort_order: 11, type: 'order_sentence',
    question_text: 'Ordena: "Quiero café, pero tomo té." → ik / wil / koffie / maar / ik / neem / thee',
    correct_answer: 'Ik wil koffie, maar ik neem thee.',
    hint: '"Maar" va en el centro, entre las dos frases con contraste.',
    explanation: 'Con "maar", el orden sigue igual: Ik wil koffie, MAAR ik neem thee. No cambia la estructura.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'ik',    is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'wil',   is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'koffie',is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'maar',  is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'ik',    is_correct: false },
    { practice_item_id: id, sort_order: 6, option_text: 'neem',  is_correct: false },
    { practice_item_id: id, sort_order: 7, option_text: 'thee',  is_correct: false },
  ]);

  id = await insertItem(lessonId, {
    sort_order: 12, type: 'order_sentence',
    question_text: 'Ordena: "¿Quieres té o café?" → wil / je / thee / of / koffie',
    correct_answer: 'Wil je thee of koffie?',
    hint: '"Of" aparece entre las dos opciones. La pregunta mantiene su orden normal.',
    explanation: 'Estructura con "of" en pregunta: verbo + sujeto + opción 1 + of + opción 2.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'wil',   is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'je',    is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'thee',  is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'of',    is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'koffie',is_correct: false },
  ]);

  id = await insertItem(lessonId, {
    sort_order: 13, type: 'order_sentence',
    question_text: 'Ordena: "Bebo agua porque tengo sed." → ik / drink / water / want / ik / heb / dorst',
    correct_answer: 'Ik drink water, want ik heb dorst.',
    hint: '"Want" introduce la segunda frase que explica la razón.',
    explanation: 'Con "want": frase principal + want + razón. Ik drink water, WANT ik heb dorst.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'ik',    is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'drink', is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'water', is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'want',  is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'ik',    is_correct: false },
    { practice_item_id: id, sort_order: 6, option_text: 'heb',   is_correct: false },
    { practice_item_id: id, sort_order: 7, option_text: 'dorst', is_correct: false },
  ]);
  console.log('✅ GRUPO 2 order_sentence — verbind de zinnen (4)');

  // ─── GRUPO 3: Kies de juiste conjunctie — multiple_choice (20–23) ─────────
  // 🎓 Opción múltiple con 4 opciones (en/maar/of/want). Cada ejercicio
  //    pone a prueba un uso diferente para practicar la discriminación.
  for (const d of [
    { s: 20, q: 'De pizza is lekker, ___ ook duur.',                    a: 'maar', e: '"Maar" introduce el contraste: rica PERO cara. Si dices "want", estás dando una razón, no un contraste.' },
    { s: 21, q: 'Wil je soep ___ salade?',                              a: 'of',   e: '"Of" presenta dos alternativas. Wil je soep OF salade? — solo puedes elegir una.' },
    { s: 22, q: 'Ik koop melk, ___ ik heb geen melk meer.',             a: 'want', e: '"Want" introduce la razón. Compro leche PORQUE no me queda. La segunda frase explica la compra.' },
    { s: 23, q: 'Ik drink koffie ___ ik eet een koekje.',               a: 'en',   e: '"En" une dos acciones positivas sin contraste ni razón. Bebo café Y como una galleta.' },
  ]) {
    id = await insertItem(lessonId, { sort_order: d.s, type: 'multiple_choice', question_text: d.q, correct_answer: d.a, explanation: d.e });
    await post('practice_options', [
      { practice_item_id: id, sort_order: 1, option_text: 'en',   is_correct: d.a === 'en'   },
      { practice_item_id: id, sort_order: 2, option_text: 'maar', is_correct: d.a === 'maar' },
      { practice_item_id: id, sort_order: 3, option_text: 'of',   is_correct: d.a === 'of'   },
      { practice_item_id: id, sort_order: 4, option_text: 'want', is_correct: d.a === 'want' },
    ]);
  }
  console.log('✅ GRUPO 3 multiple_choice — kies de conjunctie (4)');

  // ─── GRUPO 4: Verdadero o falso — múltiple_choice (24–27) ────────────────
  // 🎓 Preguntas sobre las REGLAS gramaticales. Especialmente importante
  //    la confusión maar/want, y el hecho de que el orden no cambia.
  for (const d of [
    { s: 24, q: '¿Es correcto? "Maar" expresa un contraste o excepción.',                           a: 'Verdadero', e: 'Verdadero. "Maar" = pero — expresa contraste. Ej: Ik hou van pizza, maar ik eet het niet elke dag.' },
    { s: 25, q: '¿Es correcto? Con "en", "maar", "of" y "want" el orden de palabras cambia.',       a: 'Falso',     e: 'Falso. El orden NO cambia. Ambas partes mantienen: sujeto + verbo + complemento. Esta es su ventaja frente a otras conjunciones.' },
    { s: 26, q: '¿Es correcto? "Want" equivale a "pero" en español.',                               a: 'Falso',     e: 'Falso. "Want" = porque. "Maar" = pero. ¡Error muy común! "Want" introduce la RAZÓN; "maar" el CONTRASTE.' },
    { s: 27, q: '¿Es correcto? "Of" se usa para presentar alternativas: "o esto o aquello".',        a: 'Verdadero', e: 'Verdadero. "Of" = o — presenta dos opciones excluyentes. Wil je thee of koffie? = ¿Té o café?' },
  ]) {
    id = await insertItem(lessonId, { sort_order: d.s, type: 'multiple_choice', question_text: d.q, correct_answer: d.a, explanation: d.e });
    await post('practice_options', [
      { practice_item_id: id, sort_order: 1, option_text: 'Verdadero', is_correct: d.a === 'Verdadero' },
      { practice_item_id: id, sort_order: 2, option_text: 'Falso',     is_correct: d.a === 'Falso'     },
    ]);
  }
  console.log('✅ GRUPO 4 multiple_choice — verdadero/falso gramática (4)');

  // ─── GRUPO 5: Match pairs — conjunciones ↔ español (30) ──────────────────
  // 🎓 Une las 4 conjunciones con su traducción. Sencillo pero esencial
  //    para fijar las equivalencias antes de pasar a ejercicios de producción.
  id = await insertItem(lessonId, {
    sort_order: 30, type: 'match_pairs',
    question_text: 'Une cada conjunción neerlandesa con su equivalente en español',
    correct_answer: '',
  });
  await post('match_pair_items', [
    { practice_item_id: id, sort_order: 1, left_text: 'en',   right_text: 'y' },
    { practice_item_id: id, sort_order: 2, left_text: 'maar', right_text: 'pero' },
    { practice_item_id: id, sort_order: 3, left_text: 'of',   right_text: 'o' },
    { practice_item_id: id, sort_order: 4, left_text: 'want', right_text: 'porque' },
  ]);
  console.log('✅ GRUPO 5 match_pairs — conjunciones (1 ejercicio, 4 pares)');

  // ─── GRUPO 6: Word scramble — vocabulario nuevo (35–37) ──────────────────
  // 🎓 Tres palabras clave de 5-6 letras introducidas en esta lección.
  for (const d of [
    { s: 35, q: 'Descifra la palabra (6 letras): la galleta en neerlandés',  a: 'koekje', e: '"Koekje" = la galleta. Es het koekje (neutro). Ik eet een koekje en ik drink koffie.' },
    { s: 36, q: 'Descifra la palabra (6 letras): la ensalada en neerlandés', a: 'salade', e: '"Salade" = la ensalada. Es de salade. Wil je soep of salade?' },
    { s: 37, q: 'Descifra la palabra (5 letras): la sed en neerlandés',      a: 'dorst',  e: '"Dorst" = la sed. Es de dorst. Ik heb dorst — Ik drink water, want ik heb dorst.' },
  ]) { await insertItem(lessonId, { sort_order: d.s, type: 'word_scramble', question_text: d.q, correct_answer: d.a, hint: null, explanation: d.e }); }
  console.log('✅ GRUPO 6 word_scramble — vocabulario nuevo (3)');

  // ─── GRUPO 7: Corrige los errores — fill_blank (40–44) ───────────────────
  // 🎓 Ejercicio de análisis de errores, igual que en el PPTX (slides 15-16).
  //    El estudiante identifica qué conjunción es incorrecta y da la correcta.
  for (const d of [
    { s: 40, q: 'Error: "Ik drink koffie want ik eet een koekje." → ¿cuál es la conjunción correcta?',         a: 'en',   h: '"Want" es "porque"; aquí no hay razón, solo dos acciones',      e: 'Correcto: EN. Ik drink koffie EN ik eet een koekje. Son dos acciones juntas, sin razón ni contraste.' },
    { s: 41, q: 'Error: "Ik hou van pizza, want ik eet niet elke dag pizza." → ¿conjunción correcta?',         a: 'maar', h: '"Want" = porque; aquí hay contraste, no razón',                 e: 'Correcto: MAAR. Ik hou van pizza, MAAR ik eet niet elke dag. La segunda frase es contraste, no razón.' },
    { s: 42, q: 'Error: "Wil je thee en koffie?" (dos alternativas, no las dos) → ¿conjunción correcta?',     a: 'of',   h: '"En" junta dos cosas; "of" presenta alternativas excluyentes',  e: 'Correcto: OF. Wil je thee OF koffie? — Solo puedes elegir una. "En" las uniría como si quisieras las dos.' },
    { s: 43, q: 'Error: "Ik ga naar de supermarkt, maar ik heb geen brood." → ¿conjunción correcta?',         a: 'want', h: '"Maar" = contraste; aquí la segunda frase da la razón',         e: 'Correcto: WANT. Ik ga naar de supermarkt, WANT ik heb geen brood. La segunda frase explica la razón.' },
    { s: 44, q: 'Error: "Ik eet pizza maar ik vind deze pizza niet lekker." → ¿conjunción correcta?',         a: 'maar', h: '¡Esta es correcta! Revisa bien el contraste',                   e: '¡Correcto: MAAR! Ik eet pizza MAAR ik vind deze pizza niet lekker. Hay un contraste real — como pizza PERO no me gusta esta pizza.' },
  ]) { await insertItem(lessonId, { sort_order: d.s, type: 'fill_blank', question_text: d.q, correct_answer: d.a, hint: d.h, explanation: d.e }); }
  console.log('✅ GRUPO 7 fill_blank — corrige los errores (5)');

  // ─── GRUPO 8: Traduce ES → NL — write_answer (50–52) ─────────────────────
  // 🎓 Producción libre: el máximo nivel de dificultad. El estudiante debe
  //    elegir la conjunción correcta Y construir la frase completa en NL.
  for (const d of [
    { s: 50, q: 'Traduce al neerlandés: "Como pizza y bebo cola."',                          a: 'Ik eet pizza en ik drink cola.',               h: 'Usa "en" para unir dos acciones afirmativas',      e: 'Correcto: Ik eet pizza en ik drink cola. "En" (y) une dos acciones sin contraste ni razón.' },
    { s: 51, q: 'Traduce al neerlandés: "Quiero café, pero tomo té."',                       a: 'Ik wil koffie, maar ik neem thee.',             h: 'Usa "maar" para el contraste entre querer y elegir', e: 'Correcto: Ik wil koffie, maar ik neem thee. "Maar" expresa que la segunda elección contradice la preferencia.' },
    { s: 52, q: 'Traduce al neerlandés: "Voy al supermercado porque no tengo leche."',       a: 'Ik ga naar de supermarkt, want ik heb geen melk.', h: 'Usa "want" para la razón. No olvides "geen" para la negación del sustantivo', e: 'Correcto: Ik ga naar de supermarkt, want ik heb geen melk. "Want" introduce la razón; "geen" niega el sustantivo.' },
  ]) { await insertItem(lessonId, { sort_order: d.s, type: 'write_answer', question_text: d.q, correct_answer: d.a, hint: d.h, explanation: d.e }); }
  console.log('✅ GRUPO 8 write_answer — traduce ES→NL (3)');

  // ─────────────────────────────────────────────────────────────────────────
  // TOTALES:
  // Grupo 1: 6 fill_blank (elegir conjunción)
  // Grupo 2: 4 order_sentence (ordenar frases compuestas)
  // Grupo 3: 4 multiple_choice (elegir conjunción en contexto)
  // Grupo 4: 4 multiple_choice (verdadero/falso gramática)
  // Grupo 5: 1 match_pairs (4 pares)
  // Grupo 6: 3 word_scramble
  // Grupo 7: 5 fill_blank (corregir errores)
  // Grupo 8: 3 write_answer (traducción producción libre)
  // TOTAL: 30 ejercicios
  // ─────────────────────────────────────────────────────────────────────────

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ LECCIÓN COMPLETADA — Les 4 — Zinnen verbinden | Voegwoorden');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Lesson ID  : ${lessonId}`);
  console.log('   📚 Vocabulario: 18 palabras');
  console.log('      • Del PPTX:      6 (en, maar, of, want, voegwoord, verbinden)');
  console.log('      • Enriquecidas: 12 (koekje, pizza, soep, salade, lekker, duur,');
  console.log('                          koud, dorst, koken, uiteten, restaurant, elke dag)');
  console.log('   💬 Frases:      10 (4 del PPTX + 6 enriquecimiento)');
  console.log('   🗣️  Diálogo:   "In het café" — 10 líneas');
  console.log('                  Usa EN (×3), MAAR (×3), OF (×2), WANT (×2)');
  console.log('   📖 Lezen:       1 texto + 7 preguntas (5 MC + 2 fill_blank)');
  console.log('   🎯 Ejercicios:  30 total');
  console.log('      • fill_blank:      11  (grupos 1 + 7)');
  console.log('      • order_sentence:   4  (grupo 2)');
  console.log('      • multiple_choice:  8  (grupos 3 + 4)');
  console.log('      • match_pairs:      1  (grupo 5, 4 pares)');
  console.log('      • word_scramble:    3  (grupo 6)');
  console.log('      • write_answer:     3  (grupo 8)');
  console.log('');
  console.log('   ⚠️  Pendiente:');
  console.log('      • Audio URLs para diálogo y vocabulario');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
