/**
 * seed-m4-les1.mjs
 *
 * Crea Módulo 4 "Het werk" + Lección 1 "Werk & Beroep" en Supabase.
 * Contenido basado en el PPTX: vocabulario, frases, diálogo en uitzendbureau,
 * texto de lectura (Lezen) y 16+ ejercicios de práctica variados.
 *
 * Idempotente: si el módulo/lección ya existen los reusa y limpia ejercicios
 * previos para volver a insertar.
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
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('❌  Missing env'); process.exit(1); }

const H = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${SERVICE_KEY}`,
  apikey: SERVICE_KEY,
  Prefer: 'return=representation',
};

async function get(table, params = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: H });
  if (!r.ok) throw new Error(`GET ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function post(table, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`POST ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function patch(table, params, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { method: 'PATCH', headers: H, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`PATCH ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function del(table, params) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { method: 'DELETE', headers: H });
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
  console.log('💼  Seed M4 L1 — Het werk\n');

  // 1. Módulo (id explícito para evitar desync de sequence)
  let [mod] = await get('modules', 'slug=eq.het-werk&select=*');
  if (!mod) {
    // Buscar próximo id libre
    const existing = await get('modules', 'select=id&order=id.desc&limit=1');
    const nextId = (existing[0]?.id ?? 0) + 1;
    [mod] = await post('modules', {
      id: nextId,
      slug: 'het-werk',
      title_nl: 'Het werk',
      title_es: 'El trabajo',
      sort_order: 4,
    });
    console.log(`✅  Módulo creado: het-werk (id=${mod.id})`);
  } else {
    console.log(`↳  Módulo existente: het-werk (id=${mod.id})`);
  }

  // 2. Lección
  let [lesson] = await get('lessons', `slug=eq.m4-les-1-werk-beroep&select=*`);
  if (!lesson) {
    [lesson] = await post('lessons', {
      module_id: mod.id,
      slug: 'm4-les-1-werk-beroep',
      title_nl: 'Les 1 — Woordenschat | Werk & Beroep',
      title_es: 'Vocabulario de trabajo y profesiones',
      sort_order: 1,
      is_extra: false,
    });
    console.log(`✅  Lección creada: id=${lesson.id}`);
  } else {
    console.log(`↳  Lección existente: id=${lesson.id} — limpiando ejercicios y re-insertando`);
  }
  const L = lesson.id;

  // Limpia TODO lo anterior (idempotente)
  const prevItems = await get('practice_items', `lesson_id=eq.${L}&select=id`);
  if (prevItems.length > 0) {
    const ids = prevItems.map(i => i.id).join(',');
    await del('match_pair_items', `practice_item_id=in.(${ids})`);
    await del('practice_options', `practice_item_id=in.(${ids})`);
    await del('practice_items', `lesson_id=eq.${L}`);
  }
  await del('vocabulary_items', `lesson_id=eq.${L}`);
  await del('phrases', `lesson_id=eq.${L}`);
  const prevDlgs = await get('dialogues', `lesson_id=eq.${L}&select=id`);
  for (const d of prevDlgs) await del('dialogue_lines', `dialogue_id=eq.${d.id}`);
  await del('dialogues', `lesson_id=eq.${L}`);
  const prevLezen = await get('lezen_texts', `lesson_id=eq.${L}&select=id`);
  for (const lz of prevLezen) {
    const exs = await get('lezen_exercises', `lezen_text_id=eq.${lz.id}&select=id`);
    for (const e of exs) await del('lezen_exercise_options', `lezen_exercise_id=eq.${e.id}`);
    await del('lezen_exercises', `lezen_text_id=eq.${lz.id}`);
  }
  await del('lezen_texts', `lesson_id=eq.${L}`);

  // ─── VOCABULARY (16 palabras clave) ──────────────────────────────────────
  const vocab = [
    // Sectores / sustantivos clave
    { sort_order: 1,  article: 'de',  word_nl: 'baan',             translation_es: 'empleo, puesto de trabajo' },
    { sort_order: 2,  article: 'de',  word_nl: 'vacature',         translation_es: 'vacante, puesto vacante' },
    { sort_order: 3,  article: 'het', word_nl: 'sollicitatiegesprek', translation_es: 'entrevista de trabajo' },
    { sort_order: 4,  article: 'de',  word_nl: 'werkervaring',     translation_es: 'experiencia laboral' },
    { sort_order: 5,  article: 'de',  word_nl: 'collega',          translation_es: 'compañero/a de trabajo' },
    { sort_order: 6,  article: 'de',  word_nl: 'baas',             translation_es: 'jefe, jefa' },
    { sort_order: 7,  article: 'de',  word_nl: 'leidinggevende',   translation_es: 'superior, responsable' },
    { sort_order: 8,  article: 'het', word_nl: 'bedrijf',          translation_es: 'empresa' },
    { sort_order: 9,  article: 'de',  word_nl: 'gemeente',         translation_es: 'ayuntamiento' },
    { sort_order: 10, article: 'het', word_nl: 'contract',         translation_es: 'contrato' },
    { sort_order: 11, article: 'het', word_nl: 'uitzendbureau',    translation_es: 'empresa de trabajo temporal' },
    { sort_order: 12, article: 'de',  word_nl: 'werkgever',        translation_es: 'empleador' },
    { sort_order: 13, article: 'de',  word_nl: 'werknemer',        translation_es: 'empleado' },
    // Sectores
    { sort_order: 14, article: 'de',  word_nl: 'zorg',             translation_es: 'sanidad, sector de cuidados' },
    { sort_order: 15, article: 'de',  word_nl: 'horeca',           translation_es: 'hostelería' },
    { sort_order: 16, article: 'het', word_nl: 'onderwijs',        translation_es: 'educación, enseñanza' },
    // Verbos (sin artículo)
    { sort_order: 17, article: null,  word_nl: 'werken',           translation_es: 'trabajar' },
    { sort_order: 18, article: null,  word_nl: 'solliciteren',     translation_es: 'postularse a un trabajo' },
    { sort_order: 19, article: null,  word_nl: 'reageren',         translation_es: 'reaccionar, responder' },
    { sort_order: 20, article: null,  word_nl: 'zoeken',           translation_es: 'buscar' },
  ];
  await post('vocabulary_items', vocab.map(v => ({ ...v, lesson_id: L })));
  console.log(`✅  vocabulary_items × ${vocab.length}`);

  // ─── PHRASES (12 frases útiles) ──────────────────────────────────────────
  const phrases = [
    { sort_order: 1,  phrase_nl: 'Ik werk in de zorg.',                 translation_es: 'Trabajo en sanidad.' },
    { sort_order: 2,  phrase_nl: 'Ik werk in de horeca.',               translation_es: 'Trabajo en hostelería.' },
    { sort_order: 3,  phrase_nl: 'Ik werk in het onderwijs.',           translation_es: 'Trabajo en educación.' },
    { sort_order: 4,  phrase_nl: 'Ik werk met mijn collega\u0027s.',    translation_es: 'Trabajo con mis compañeros.' },
    { sort_order: 5,  phrase_nl: 'Ik werk in een team.',                translation_es: 'Trabajo en un equipo.' },
    { sort_order: 6,  phrase_nl: 'Ik werk voor een bedrijf.',           translation_es: 'Trabajo para una empresa.' },
    { sort_order: 7,  phrase_nl: 'Ik werk voor de Gemeente.',           translation_es: 'Trabajo para el Ayuntamiento.' },
    { sort_order: 8,  phrase_nl: 'Ik werk voor mezelf.',                translation_es: 'Trabajo por cuenta propia.' },
    { sort_order: 9,  phrase_nl: 'Ik zoek een baan.',                   translation_es: 'Busco un empleo.' },
    { sort_order: 10, phrase_nl: 'Ik heb een sollicitatiegesprek.',     translation_es: 'Tengo una entrevista de trabajo.' },
    { sort_order: 11, phrase_nl: 'Ik heb een vast contract.',           translation_es: 'Tengo un contrato fijo.' },
    { sort_order: 12, phrase_nl: 'In welke sector werk je?',            translation_es: '¿En qué sector trabajas?' },
  ];
  await post('phrases', phrases.map(p => ({ ...p, lesson_id: L })));
  console.log(`✅  phrases × ${phrases.length}`);

  // ─── DIALOGUE — Gesprek bij het uitzendbureau ────────────────────────────
  const [dlg] = await post('dialogues', {
    lesson_id: L,
    title: 'Gesprek bij het uitzendbureau',
  });
  const lines = [
    { speaker: 'Medewerker', text_nl: 'Goedemorgen! Kom binnen. Zoek je werk?',
      text_es: '¡Buenos días! Pasa. ¿Buscas trabajo?' },
    { speaker: 'Klant',      text_nl: 'Ja, ik zoek een baan. Ik heb werkervaring in de horeca.',
      text_es: 'Sí, busco un empleo. Tengo experiencia en hostelería.' },
    { speaker: 'Medewerker', text_nl: 'Oké, mooi. Zoek je fulltime of parttime?',
      text_es: 'Bien, perfecto. ¿Buscas tiempo completo o parcial?' },
    { speaker: 'Klant',      text_nl: 'Parttime, drie dagen per week.',
      text_es: 'Tiempo parcial, tres días por semana.' },
    { speaker: 'Medewerker', text_nl: 'Wil je een vast of tijdelijk contract?',
      text_es: '¿Quieres un contrato fijo o temporal?' },
    { speaker: 'Klant',      text_nl: 'Eerst een tijdelijk contract, alsjeblieft.',
      text_es: 'Primero un contrato temporal, por favor.' },
    { speaker: 'Medewerker', text_nl: 'Perfect. We hebben een vacature in een restaurant. Is dat goed?',
      text_es: 'Perfecto. Tenemos una vacante en un restaurante. ¿Te va bien?' },
    { speaker: 'Klant',      text_nl: 'Ja, heel goed. Dank u wel!',
      text_es: 'Sí, muy bien. ¡Muchas gracias!' },
  ];
  await post('dialogue_lines', lines.map((l, i) => ({ ...l, dialogue_id: dlg.id, sort_order: i + 1 })));
  console.log(`✅  dialogue + ${lines.length} lines`);

  // ─── LEZEN TEXT ──────────────────────────────────────────────────────────
  const [lz] = await post('lezen_texts', {
    lesson_id: L,
    sort_order: 1,
    text_nl: `Mijn naam is Sara en ik ben uit Spanje. Ik woon nu in Nederland en ik zoek een baan. Ik heb werkervaring in de horeca — ik heb drie jaar in een restaurant in Madrid gewerkt.

Vandaag heb ik een sollicitatiegesprek bij een uitzendbureau. Ze hebben een vacature voor een parttime baan in een café. Het is een tijdelijk contract van zes maanden. Ik werk met vier andere collega's en mijn baas heet Peter.

Ik ben heel blij. Het is mijn eerste baan in Nederland!`,
    text_es: `Me llamo Sara y soy de España. Ahora vivo en los Países Bajos y estoy buscando un empleo. Tengo experiencia en hostelería — he trabajado tres años en un restaurante en Madrid.

Hoy tengo una entrevista de trabajo en una empresa de trabajo temporal. Tienen una vacante para un puesto a tiempo parcial en un café. Es un contrato temporal de seis meses. Trabajaré con otros cuatro compañeros y mi jefe se llama Peter.

Estoy muy contenta. ¡Es mi primer empleo en los Países Bajos!`,
  });

  const lezenExs = [
    {
      type: 'multiple_choice',
      prompt: '¿De dónde es Sara?',
      correct_answer: 'Van Spanje',
      explanation: '"Ik ben uit Spanje" = "soy de España".',
      opts: ['Van Spanje', 'Van Nederland', 'Van Italië', 'Van Frankrijk'],
    },
    {
      type: 'multiple_choice',
      prompt: '¿En qué sector tiene experiencia?',
      correct_answer: 'Horeca',
      explanation: '"Ik heb werkervaring in de horeca" = hostelería.',
      opts: ['Horeca', 'Zorg', 'Onderwijs', 'ICT'],
    },
    {
      type: 'multiple_choice',
      prompt: '¿Dónde tiene la entrevista?',
      correct_answer: 'Bij een uitzendbureau',
      explanation: 'El texto dice: "Ik heb een sollicitatiegesprek bij een uitzendbureau".',
      opts: ['Bij een uitzendbureau', 'In een restaurant', 'Bij de Gemeente', 'In een café'],
    },
    {
      type: 'multiple_choice',
      prompt: '¿Qué tipo de contrato le ofrecen?',
      correct_answer: 'Een tijdelijk contract van zes maanden',
      explanation: '"Een tijdelijk contract van zes maanden" = un contrato temporal de 6 meses.',
      opts: [
        'Een tijdelijk contract van zes maanden',
        'Een vast contract',
        'Een contract van één jaar',
        'Geen contract',
      ],
    },
    {
      type: 'multiple_choice',
      prompt: '¿Cuántos compañeros tendrá?',
      correct_answer: 'Vier',
      explanation: '"Ik werk met vier andere collega\u0027s" = con 4 otros compañeros.',
      opts: ['Vier', 'Drie', 'Vijf', 'Zes'],
    },
    {
      type: 'fill_blank',
      prompt: 'Sara zoekt een ______.',
      correct_answer: 'baan',
      explanation: '"Een baan" = un empleo/puesto de trabajo.',
    },
    {
      type: 'fill_blank',
      prompt: 'Ze heeft werkervaring in de ______.',
      correct_answer: 'horeca',
      explanation: 'Hostelería = "de horeca" en NL.',
    },
  ];

  for (let i = 0; i < lezenExs.length; i++) {
    const ex = lezenExs[i];
    const [row] = await post('lezen_exercises', {
      lezen_text_id: lz.id,
      sort_order: i,
      type: ex.type,
      prompt: ex.prompt,
      correct_answer: ex.correct_answer,
      hint: null,
      explanation: ex.explanation,
    });
    if (ex.type === 'multiple_choice' && ex.opts) {
      await post('lezen_exercise_options', ex.opts.map((o, j) => ({
        lezen_exercise_id: row.id, sort_order: j, option_text: o,
      })));
    }
  }
  console.log(`✅  lezen_text + ${lezenExs.length} exercises`);

  // ─── PRACTICE EXERCISES (16 mezclados) ───────────────────────────────────
  let id;

  // 1. Multiple choice (4) — sectores/profesiones
  id = await insertItem(L, {
    sort_order: 1, type: 'multiple_choice',
    question_text: '¿Qué significa "de baan"?',
    correct_answer: 'el empleo',
    explanation: '"De baan" = el empleo / puesto de trabajo.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'el empleo',    is_correct: true },
    { practice_item_id: id, sort_order: 2, option_text: 'el banco',     is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'la empresa',   is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'el contrato',  is_correct: false },
  ]);

  id = await insertItem(L, {
    sort_order: 2, type: 'multiple_choice',
    question_text: '¿Cómo se dice "hostelería" en neerlandés?',
    correct_answer: 'horeca',
    explanation: 'HO-RE-CA: Hotel, Restaurant, Café.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'horeca',    is_correct: true },
    { practice_item_id: id, sort_order: 2, option_text: 'zorg',      is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'landbouw',  is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'onderwijs', is_correct: false },
  ]);

  id = await insertItem(L, {
    sort_order: 3, type: 'multiple_choice',
    question_text: '¿Qué artículo lleva "sollicitatiegesprek"?',
    correct_answer: 'het',
    explanation: '"Het sollicitatiegesprek" — neutro.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'het', is_correct: true },
    { practice_item_id: id, sort_order: 2, option_text: 'de',  is_correct: false },
  ]);

  id = await insertItem(L, {
    sort_order: 4, type: 'multiple_choice',
    question_text: 'Trabajo para el Ayuntamiento. ¿Cuál es la frase correcta en NL?',
    correct_answer: 'Ik werk voor de Gemeente',
    explanation: '"Voor" + sujeto/institución. "Gemeente" = ayuntamiento.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'Ik werk voor de Gemeente', is_correct: true },
    { practice_item_id: id, sort_order: 2, option_text: 'Ik werk in de Gemeente',   is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'Ik werk met de Gemeente',  is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'Ik werk bij de Gemeente',  is_correct: false },
  ]);

  // 2. Fill blank con opciones (3)
  id = await insertItem(L, {
    sort_order: 10, type: 'fill_blank',
    question_text: 'Ik ___ in de horeca.',
    correct_answer: 'werk',
    explanation: '"Ik werk" = yo trabajo.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'werk',  is_correct: true },
    { practice_item_id: id, sort_order: 2, option_text: 'ben',   is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'heb',   is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'zoek',  is_correct: false },
  ]);

  id = await insertItem(L, {
    sort_order: 11, type: 'fill_blank',
    question_text: 'Ik werk ___ mijn collega\u0027s.',
    correct_answer: 'met',
    explanation: '"Met" = con.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'met',  is_correct: true },
    { practice_item_id: id, sort_order: 2, option_text: 'voor', is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'in',   is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'bij',  is_correct: false },
  ]);

  id = await insertItem(L, {
    sort_order: 12, type: 'fill_blank',
    question_text: 'Ik zoek een ___ in de zorg.',
    correct_answer: 'baan',
    explanation: '"Een baan zoeken" = buscar un empleo.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'baan',     is_correct: true },
    { practice_item_id: id, sort_order: 2, option_text: 'contract', is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'vacature', is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'collega',  is_correct: false },
  ]);

  // 3. True/false (2)
  await insertItem(L, {
    sort_order: 20, type: 'true_false',
    question_text: '"Ik werk voor mezelf" significa "soy trabajador autónomo"',
    correct_answer: 'verdadero',
    explanation: '"Voor mezelf werken" = trabajar por cuenta propia (zzp\u0027er).',
  });
  await insertItem(L, {
    sort_order: 21, type: 'true_false',
    question_text: '"De werkgever" significa "el empleado"',
    correct_answer: 'falso',
    explanation: '"De werkgever" = el empleador. "De werknemer" = el empleado.',
  });

  // 4. Order sentence (2)
  id = await insertItem(L, {
    sort_order: 30, type: 'order_sentence',
    question_text: 'Ordena: "Trabajo en el sector sanitario."',
    correct_answer: 'Ik werk in de zorg',
    explanation: '"Ik werk in de zorg" = trabajo en sanidad.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'Ik',    is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'werk',  is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'in',    is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'de',    is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'zorg',  is_correct: false },
    { practice_item_id: id, sort_order: 6, option_text: 'bij',   is_correct: false }, // distractor
  ]);

  id = await insertItem(L, {
    sort_order: 31, type: 'order_sentence',
    question_text: 'Ordena: "Tengo una entrevista de trabajo."',
    correct_answer: 'Ik heb een sollicitatiegesprek',
    explanation: '"Een sollicitatiegesprek" es una palabra larga pero muy útil.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'Ik',                  is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'heb',                 is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'een',                 is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'sollicitatiegesprek', is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'werkervaring',        is_correct: false }, // distractor
  ]);

  // 5. Word scramble (1)
  await insertItem(L, {
    sort_order: 40, type: 'word_scramble',
    question_text: 'Ordena las letras para formar "vacante":\nV - C - T - A - A - U - R - E',
    correct_answer: 'vacature',
    explanation: '"De vacature" = el puesto vacante.',
  });

  // 6. Letter dash (1)
  await insertItem(L, {
    sort_order: 50, type: 'letter_dash',
    question_text: 'Experiencia laboral en NL.',
    correct_answer: 'werkervaring',
    explanation: '"De werkervaring" = la experiencia laboral.',
  });

  // 7. Match pairs (1 — vocabulario clave)
  id = await insertItem(L, {
    sort_order: 60, type: 'match_pairs',
    question_text: 'Une cada palabra con su traducción.',
    correct_answer: '',
  });
  await post('match_pair_items', [
    { practice_item_id: id, sort_order: 1, left_text: 'baan',        right_text: 'empleo' },
    { practice_item_id: id, sort_order: 2, left_text: 'baas',        right_text: 'jefe' },
    { practice_item_id: id, sort_order: 3, left_text: 'werkervaring', right_text: 'experiencia laboral' },
    { practice_item_id: id, sort_order: 4, left_text: 'vacature',    right_text: 'vacante' },
  ]);

  // 8. Odd one out (1)
  id = await insertItem(L, {
    sort_order: 70, type: 'odd_one_out',
    question_text: 'Tres son sectores, una no. Toca la intrusa.',
    correct_answer: 'vacature',
    explanation: '"Vacature" = vacante (no es un sector). Los otros: zorg/horeca/onderwijs.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'zorg',      is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'horeca',    is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'vacature',  is_correct: true  },
    { practice_item_id: id, sort_order: 4, option_text: 'onderwijs', is_correct: false },
  ]);

  // 9. Listen_translate (1) — NL frase → componer ES
  id = await insertItem(L, {
    sort_order: 80, type: 'listen_translate',
    question_text: 'Escucha y traduce al español: "Ik heb een sollicitatiegesprek"',
    correct_answer: 'Tengo una entrevista de trabajo',
    explanation: 'Ik heb = tengo. Een sollicitatiegesprek = una entrevista de trabajo.',
  });
  await post('practice_options', [
    { practice_item_id: id, sort_order: 1, option_text: 'Tengo',       is_correct: false },
    { practice_item_id: id, sort_order: 2, option_text: 'una',         is_correct: false },
    { practice_item_id: id, sort_order: 3, option_text: 'entrevista',  is_correct: false },
    { practice_item_id: id, sort_order: 4, option_text: 'de',          is_correct: false },
    { practice_item_id: id, sort_order: 5, option_text: 'trabajo',     is_correct: false },
    { practice_item_id: id, sort_order: 6, option_text: 'empresa',     is_correct: false }, // distractor
    { practice_item_id: id, sort_order: 7, option_text: 'compañero',   is_correct: false }, // distractor
  ]);

  console.log(`✅  practice_items × 16 (MC×4, fill_blank×3, tf×2, order×2, scramble×1, letter_dash×1, match_pairs×1, odd_one_out×1, listen_translate×1)\n`);

  console.log('════════════════════════════════════════════════════════════');
  console.log('🎉  M4 L1 — Het werk — COMPLETO');
  console.log('════════════════════════════════════════════════════════════');
  console.log('   • Módulo: het-werk');
  console.log('   • Lección: m4-les-1-werk-beroep (' + L + ')');
  console.log('   • Vocabulary: 20');
  console.log('   • Phrases: 12');
  console.log('   • Dialogue: 8 lines (Gesprek bij het uitzendbureau)');
  console.log('   • Lezen: 1 text + 7 exercises');
  console.log('   • Practice: 16 exercises mixtos');
  console.log('   • Resumen: local en courseData.ts');
  console.log('════════════════════════════════════════════════════════════\n');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
