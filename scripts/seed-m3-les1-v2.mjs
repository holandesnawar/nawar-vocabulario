/**
 * seed-m3-les1-v2.mjs
 *
 * Añade vocabulario extra, frases y ejercicios variados
 * al Módulo 3 Lección 1 "Eten en drinken".
 *
 * ✅ NO borra contenido existente (sort_order 1-99 intacto)
 * ✅ Sólo inserta sort_order >= 100 (nuevo contenido)
 * ✅ audio_url = null en todo (rellena tú después)
 * ✅ Ejercicios variados: 7 tipos diferentes
 *
 * Uso:
 *   node scripts/seed-m3-les1-v2.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
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

// ─────────────────────────────────────────────────────────────────────────────
//  VOCABULARIO
//  Organizado en secciones mediante sort_order.
//  audio_url = null — rellena manualmente después.
// ─────────────────────────────────────────────────────────────────────────────

const VOCABULARY = [
  // ── Sección 1: Comida y bebida — conceptos base (100-109) ────────────────
  { sort_order: 100, article: 'het', word_nl: 'het eten',      translation_es: 'la comida' },
  { sort_order: 101, article: 'het', word_nl: 'het drinken',   translation_es: 'la bebida' },
  { sort_order: 102, article: 'het', word_nl: 'het ontbijt',   translation_es: 'el desayuno' },
  { sort_order: 103, article: 'de',  word_nl: 'de lunch',      translation_es: 'el almuerzo' },
  { sort_order: 104, article: 'het', word_nl: 'het avondeten', translation_es: 'la cena' },
  { sort_order: 105, article: 'de',  word_nl: 'de boterham',   translation_es: 'el bocadillo / rebanada de pan' },
  { sort_order: 106, article: 'de',  word_nl: 'de ham',        translation_es: 'el jamón' },
  { sort_order: 107, article: 'de',  word_nl: 'de yoghurt',    translation_es: 'el yogur' },
  { sort_order: 108, article: 'het', word_nl: 'het sap',       translation_es: 'el zumo' },
  { sort_order: 109, article: 'het', word_nl: 'het ei',        translation_es: 'el huevo' },

  // ── Sección 2: Frutas (120-126) ──────────────────────────────────────────
  { sort_order: 120, article: 'de', word_nl: 'de appel',      translation_es: 'la manzana' },
  { sort_order: 121, article: 'de', word_nl: 'de banaan',     translation_es: 'el plátano' },
  { sort_order: 122, article: 'de', word_nl: 'de aardbei',    translation_es: 'la fresa' },
  { sort_order: 123, article: 'de', word_nl: 'de peer',       translation_es: 'la pera' },
  { sort_order: 124, article: 'de', word_nl: 'de druif',      translation_es: 'la uva' },
  { sort_order: 125, article: 'de', word_nl: 'de sinaasappel',translation_es: 'la naranja' },

  // ── Sección 3: Verduras (130-136) ────────────────────────────────────────
  { sort_order: 130, article: 'de', word_nl: 'de aardappel',  translation_es: 'la patata' },
  { sort_order: 131, article: 'de', word_nl: 'de tomaat',     translation_es: 'el tomate' },
  { sort_order: 132, article: 'de', word_nl: 'de komkommer',  translation_es: 'el pepino' },
  { sort_order: 133, article: 'de', word_nl: 'de ui',         translation_es: 'la cebolla' },
  { sort_order: 134, article: 'de', word_nl: 'de wortel',     translation_es: 'la zanahoria' },
  { sort_order: 135, article: 'de', word_nl: 'de sla',        translation_es: 'la lechuga' },

  // ── Sección 4: Carnes y proteínas (140-143) ───────────────────────────────
  { sort_order: 140, article: 'de', word_nl: 'de kip',        translation_es: 'el pollo' },
  { sort_order: 141, article: 'het',word_nl: 'het vlees',     translation_es: 'la carne' },
  { sort_order: 142, article: 'de', word_nl: 'de vis',        translation_es: 'el pescado' },
  { sort_order: 143, article: 'de', word_nl: 'de kaas',       translation_es: 'el queso' },

  // ── Sección 5: Diminutivos (150-155) ─────────────────────────────────────
  { sort_order: 150, article: 'het', word_nl: 'het hapje',    translation_es: 'el bocado / snack pequeño' },
  { sort_order: 151, article: 'het', word_nl: 'het slokje',   translation_es: 'el sorbito' },
  { sort_order: 152, article: 'het', word_nl: 'het stukje',   translation_es: 'el trocito' },
  { sort_order: 153, article: 'het', word_nl: 'het glaasje',  translation_es: 'el vasito' },
  { sort_order: 154, article: 'het', word_nl: 'het kopje',    translation_es: 'la tacita' },
  { sort_order: 155, article: 'het', word_nl: 'het broodje',  translation_es: 'el bocadillo / panecillo' },

  // ── Sección 6: Supermercado — personas, lugares y secciones (160-170) ────
  { sort_order: 160, article: 'de', word_nl: 'de klant',           translation_es: 'el cliente' },
  { sort_order: 161, article: 'de', word_nl: 'de medewerker',      translation_es: 'el empleado' },
  { sort_order: 162, article: 'de', word_nl: 'de kassamedewerker', translation_es: 'el cajero' },
  { sort_order: 163, article: 'de', word_nl: 'de zuivel',          translation_es: 'los lácteos' },
  { sort_order: 164, article: 'de', word_nl: 'de pasta',           translation_es: 'la pasta' },
  { sort_order: 165, article: 'de', word_nl: 'de afdeling',        translation_es: 'la sección' },
  { sort_order: 166, article: 'de', word_nl: 'de ingang',          translation_es: 'la entrada' },
  { sort_order: 167, article: 'de', word_nl: 'de uitgang',         translation_es: 'la salida' },
  { sort_order: 168, article: 'de', word_nl: 'de kassa',           translation_es: 'la caja (registradora)' },
  { sort_order: 169, article: 'het',word_nl: 'het winkelwagentje', translation_es: 'el carrito de la compra' },
  { sort_order: 170, article: 'het',word_nl: 'het mandje',         translation_es: 'la cesta (de la compra)' },

  // ── Sección 7: Verbos clave (180-189) ────────────────────────────────────
  { sort_order: 180, article: null, word_nl: 'kopen',   translation_es: 'comprar' },
  { sort_order: 181, article: null, word_nl: 'zoeken',  translation_es: 'buscar' },
  { sort_order: 182, article: null, word_nl: 'vinden',  translation_es: 'encontrar' },
  { sort_order: 183, article: null, word_nl: 'nemen',   translation_es: 'coger / tomar' },
  { sort_order: 184, article: null, word_nl: 'staan',   translation_es: 'estar de pie (colocado)' },
  { sort_order: 185, article: null, word_nl: 'liggen',  translation_es: 'estar tumbado / estar colocado (plano)' },
  { sort_order: 186, article: null, word_nl: 'helpen',  translation_es: 'ayudar' },
  { sort_order: 187, article: null, word_nl: 'pinnen',  translation_es: 'pagar con tarjeta' },
  { sort_order: 188, article: null, word_nl: 'betalen', translation_es: 'pagar' },
  { sort_order: 189, article: null, word_nl: 'pakken',  translation_es: 'coger / agarrar' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  FRASES ÚTILES
// ─────────────────────────────────────────────────────────────────────────────

const PHRASES = [
  // ── Rutinas diarias (100-107) ─────────────────────────────────────────────
  { sort_order: 100, phrase_nl: 'Ik eet brood met kaas.',                   translation_es: 'Como pan con queso.' },
  { sort_order: 101, phrase_nl: 'Ik drink koffie.',                         translation_es: 'Bebo café.' },
  { sort_order: 102, phrase_nl: 'Ik drink thee.',                           translation_es: 'Bebo té.' },
  { sort_order: 103, phrase_nl: 'Ik eet fruit.',                            translation_es: 'Como fruta.' },
  { sort_order: 104, phrase_nl: 'Ik eet soep met brood.',                   translation_es: 'Como sopa con pan.' },
  { sort_order: 105, phrase_nl: 'Als ontbijt eet ik brood.',                translation_es: 'De desayuno como pan.' },
  { sort_order: 106, phrase_nl: 'Als lunch eet ik een boterham met kaas.',  translation_es: 'De almuerzo como un bocadillo con queso.' },
  { sort_order: 107, phrase_nl: 'Als avondeten eet ik rijst met groenten.', translation_es: 'De cena como arroz con verduras.' },

  // ── En el supermercado (108-117) ──────────────────────────────────────────
  { sort_order: 108, phrase_nl: 'Ik koop melk in de supermarkt.',           translation_es: 'Compro leche en el supermercado.' },
  { sort_order: 109, phrase_nl: 'Ik neem een mandje.',                      translation_es: 'Cojo una cesta.' },
  { sort_order: 110, phrase_nl: 'Waar vind ik de melk?',                   translation_es: '¿Dónde encuentro la leche?' },
  { sort_order: 111, phrase_nl: 'Waar is de kassa?',                       translation_es: '¿Dónde está la caja?' },
  { sort_order: 112, phrase_nl: 'Mag ik pinnen, alstublieft?',             translation_es: '¿Puedo pagar con tarjeta, por favor?' },
  { sort_order: 113, phrase_nl: 'De melk staat bij de zuivel.',            translation_es: 'La leche está en la sección de lácteos.' },
  { sort_order: 114, phrase_nl: 'De rijst ligt bij de pasta.',             translation_es: 'El arroz está junto a la pasta.' },
  { sort_order: 115, phrase_nl: 'Kan ik u helpen?',                        translation_es: '¿Puedo ayudarle?' },
  { sort_order: 116, phrase_nl: 'Ik zoek de groenten.',                    translation_es: 'Busco las verduras.' },
  { sort_order: 117, phrase_nl: 'Hoeveel kost dit?',                       translation_es: '¿Cuánto cuesta esto?' },

  // ── Cantidades (118-124) ──────────────────────────────────────────────────
  { sort_order: 118, phrase_nl: 'Een pak melk.',                           translation_es: 'Un cartón de leche.' },
  { sort_order: 119, phrase_nl: 'Een fles water.',                         translation_es: 'Una botella de agua.' },
  { sort_order: 120, phrase_nl: 'Een blik soep.',                          translation_es: 'Una lata de sopa.' },
  { sort_order: 121, phrase_nl: 'Een zak rijst.',                          translation_es: 'Una bolsa de arroz.' },
  { sort_order: 122, phrase_nl: 'Ik wil een kopje koffie.',                translation_es: 'Quiero una tacita de café.' },
  { sort_order: 123, phrase_nl: 'Ik neem een slokje water.',               translation_es: 'Doy un sorbito de agua.' },
  { sort_order: 124, phrase_nl: 'Ik koop een broodje en een fles water.',  translation_es: 'Compro un panecillo y una botella de agua.' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  EJERCICIOS — 7 tipos diferentes, bien variados
//
//  100-106  → fill_blank       : conjugar verbos
//  110-117  → multiple_choice  : vocabulario, artículos, eten/drinken, situacional
//  120-125  → listen_and_choose: escucha la frase y elige la traducción
//  130-133  → order_sentence   : ordena las palabras
//  140-142  → match_pairs      : empareja columnas
//  150-153  → word_scramble    : adivina la palabra desordenada
//  160-163  → write_answer     : escribe en neerlandés
// ─────────────────────────────────────────────────────────────────────────────

const EXERCISES = [

  // ══════════════════════════════════════════════════════════════════════════
  //  SECCIÓN 1 — fill_blank: Conjugar verbos (sort_order 100-106)
  // ══════════════════════════════════════════════════════════════════════════
  {
    sort_order: 100, type: 'fill_blank',
    question_text: 'Als ontbijt ___ ik brood. (conjugar: eten)',
    correct_answer: 'eet',
    hint: 'La raíz de "eten" es "eet" para ik/jij/hij.',
    explanation: '"Eten" → ik eet, jij eet, hij eet, wij eten, jullie eten, zij eten.',
    options: [],
  },
  {
    sort_order: 101, type: 'fill_blank',
    question_text: 'Ik ___ elke ochtend sap. (conjugar: drinken)',
    correct_answer: 'drink',
    hint: 'La raíz de "drinken" es "drink".',
    explanation: '"Drinken" → ik drink, jij drinkt, hij drinkt, wij drinken.',
    options: [],
  },
  {
    sort_order: 102, type: 'fill_blank',
    question_text: 'Ik ___ melk in de supermarkt. (conjugar: kopen)',
    correct_answer: 'koop',
    hint: 'La raíz de "kopen" es "koop".',
    explanation: '"Kopen" → ik koop, jij koopt, hij koopt, wij kopen.',
    options: [],
  },
  {
    sort_order: 103, type: 'fill_blank',
    question_text: 'Waar ___ ik de yoghurt? (conjugar: vinden)',
    correct_answer: 'vind',
    hint: 'La raíz de "vinden" es "vind".',
    explanation: '"Vinden" → ik vind, jij vindt, hij vindt, wij vinden.',
    options: [],
  },
  {
    sort_order: 104, type: 'fill_blank',
    question_text: 'Ik ___ een mandje bij de ingang. (conjugar: nemen)',
    correct_answer: 'neem',
    hint: '"Nemen" es irregular: ik neem.',
    explanation: '"Nemen" → ik neem, jij neemt, hij neemt, wij nemen. Verbo irregular.',
    options: [],
  },
  {
    sort_order: 105, type: 'fill_blank',
    question_text: 'Ik ___ de kassa. (conjugar: zoeken)',
    correct_answer: 'zoek',
    hint: 'La raíz de "zoeken" es "zoek".',
    explanation: '"Zoeken" → ik zoek, jij zoekt, hij zoekt, wij zoeken.',
    options: [],
  },
  {
    sort_order: 106, type: 'fill_blank',
    question_text: 'De medewerker ___ de klant. (helpen — hij/zij)',
    correct_answer: 'helpt',
    hint: 'Para hij/zij/het añadimos -t a la raíz "help".',
    explanation: '"Helpen" → ik help, jij helpt, hij helpt, wij helpen.',
    options: [],
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SECCIÓN 2 — multiple_choice: Vocabulario variado (sort_order 110-117)
  // ══════════════════════════════════════════════════════════════════════════
  {
    sort_order: 110, type: 'multiple_choice',
    question_text: '¿Qué significa "de aardappel"?',
    correct_answer: 'la patata',
    hint: 'Es una verdura muy común.',
    explanation: '"De aardappel" = la patata. Literalmente "manzana de la tierra".',
    options: [
      { option_text: 'la zanahoria', is_correct: false, sort_order: 1 },
      { option_text: 'el tomate',    is_correct: false, sort_order: 2 },
      { option_text: 'la patata',    is_correct: true,  sort_order: 3 },
      { option_text: 'el pepino',    is_correct: false, sort_order: 4 },
    ],
  },
  {
    sort_order: 111, type: 'multiple_choice',
    question_text: '¿Qué significa "het winkelwagentje"?',
    correct_answer: 'el carrito de la compra',
    hint: 'Lo usas al entrar al supermercado.',
    explanation: '"Winkel" = tienda, "wagentje" = carrito (diminutivo de wagen = carro).',
    options: [
      { option_text: 'la cesta',               is_correct: false, sort_order: 1 },
      { option_text: 'el carrito de la compra', is_correct: true,  sort_order: 2 },
      { option_text: 'la bolsa',                is_correct: false, sort_order: 3 },
      { option_text: 'el cajero',               is_correct: false, sort_order: 4 },
    ],
  },
  {
    sort_order: 112, type: 'multiple_choice',
    question_text: '¿Cuál es la diferencia entre "staan" y "liggen"?',
    correct_answer: 'staan = estar de pie; liggen = estar tumbado',
    hint: 'Una botella "staat", un libro "ligt".',
    explanation: '"Staan" se usa para objetos verticales (botellas, cajas). "Liggen" para objetos planos (libros, bolsas).',
    options: [
      { option_text: 'staan = buscar; liggen = encontrar',         is_correct: false, sort_order: 1 },
      { option_text: 'staan = estar de pie; liggen = estar tumbado', is_correct: true, sort_order: 2 },
      { option_text: 'staan = comprar; liggen = vender',           is_correct: false, sort_order: 3 },
      { option_text: 'son sinónimos',                              is_correct: false, sort_order: 4 },
    ],
  },
  {
    sort_order: 113, type: 'multiple_choice',
    question_text: '¿Qué verbo usas con "de melk"?',
    correct_answer: 'drinken',
    hint: 'La leche es un líquido.',
    explanation: '"Ik drink melk." — Los líquidos usan "drinken". Excepción: soep → eten.',
    options: [
      { option_text: 'eten',    is_correct: false, sort_order: 1 },
      { option_text: 'drinken', is_correct: true,  sort_order: 2 },
      { option_text: 'kopen',   is_correct: false, sort_order: 3 },
      { option_text: 'nemen',   is_correct: false, sort_order: 4 },
    ],
  },
  {
    sort_order: 114, type: 'multiple_choice',
    question_text: '¿Qué artículo lleva "ei" (huevo)?',
    correct_answer: 'het',
    hint: 'Los diminutivos y muchos neutros son "het".',
    explanation: '"Het ei" = el huevo. Artículo neutro. Plural: de eieren.',
    options: [
      { option_text: 'de',  is_correct: false, sort_order: 1 },
      { option_text: 'het', is_correct: true,  sort_order: 2 },
    ],
  },
  {
    sort_order: 115, type: 'multiple_choice',
    question_text: '¿Qué artículo lleva "yoghurt"?',
    correct_answer: 'de',
    hint: '"Yoghurt" es de género común.',
    explanation: '"De yoghurt" = el yogur. Artículo común (de).',
    options: [
      { option_text: 'de',  is_correct: true,  sort_order: 1 },
      { option_text: 'het', is_correct: false, sort_order: 2 },
    ],
  },
  {
    sort_order: 116, type: 'multiple_choice',
    question_text: 'En el supermercado preguntas "Mag ik pinnen?". ¿Qué quieres decir?',
    correct_answer: '¿Puedo pagar con tarjeta?',
    hint: '"Pinnen" es muy típico de los Países Bajos.',
    explanation: '"Mag ik" = ¿puedo?, "pinnen" = pagar con tarjeta. Casi todo se paga con tarjeta en NL.',
    options: [
      { option_text: '¿Puedo comer aquí?',         is_correct: false, sort_order: 1 },
      { option_text: '¿Puedo pagar con tarjeta?',  is_correct: true,  sort_order: 2 },
      { option_text: '¿Dónde está la salida?',     is_correct: false, sort_order: 3 },
      { option_text: '¿Cuánto cuesta esto?',       is_correct: false, sort_order: 4 },
    ],
  },
  {
    sort_order: 117, type: 'multiple_choice',
    question_text: '¿Qué verbo usas con "de soep"?',
    correct_answer: 'eten',
    hint: 'En neerlandés la sopa se "come", aunque sea líquida.',
    explanation: '"Ik eet soep." — Si se toma con cuchara, suele ser "eten". Excepción habitual para hablantes de español.',
    options: [
      { option_text: 'drinken', is_correct: false, sort_order: 1 },
      { option_text: 'eten',    is_correct: true,  sort_order: 2 },
      { option_text: 'kopen',   is_correct: false, sort_order: 3 },
      { option_text: 'pakken',  is_correct: false, sort_order: 4 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SECCIÓN 3 — listen_and_choose: Escucha la frase y elige (120-125)
  // ══════════════════════════════════════════════════════════════════════════
  {
    sort_order: 120, type: 'listen_and_choose',
    question_text: '¿Cuál es la traducción correcta de "Ik drink water"?',
    correct_answer: 'Bebo agua.',
    hint: 'Escucha el verbo: ¿eten o drinken?',
    explanation: '"Drinken" = beber, "water" = agua.',
    options: [
      { option_text: 'Como pan.',     is_correct: false, sort_order: 1 },
      { option_text: 'Bebo agua.',    is_correct: true,  sort_order: 2 },
      { option_text: 'Compro leche.', is_correct: false, sort_order: 3 },
      { option_text: 'Tengo sed.',    is_correct: false, sort_order: 4 },
    ],
  },
  {
    sort_order: 121, type: 'listen_and_choose',
    question_text: '¿Cuál es la traducción correcta de "Ik eet een boterham met ham"?',
    correct_answer: 'Como un bocadillo con jamón.',
    hint: '"Boterham" = bocadillo, "ham" = jamón.',
    explanation: '"Boterham" es una rebanada de pan, típicamente con algo encima.',
    options: [
      { option_text: 'Como una fruta con queso.',   is_correct: false, sort_order: 1 },
      { option_text: 'Como un bocadillo con jamón.', is_correct: true, sort_order: 2 },
      { option_text: 'Bebo té con leche.',           is_correct: false, sort_order: 3 },
      { option_text: 'Busco el jamón.',              is_correct: false, sort_order: 4 },
    ],
  },
  {
    sort_order: 122, type: 'listen_and_choose',
    question_text: '¿Cuál es la traducción correcta de "Mag ik pinnen, alstublieft"?',
    correct_answer: '¿Puedo pagar con tarjeta, por favor?',
    hint: '"Pinnen" = pagar con tarjeta. "Alstublieft" = por favor (formal).',
    explanation: '"Mag ik" = ¿puedo?, "pinnen" = pagar con tarjeta, "alstublieft" = por favor.',
    options: [
      { option_text: '¿Puedo comer aquí?',                   is_correct: false, sort_order: 1 },
      { option_text: '¿Cuánto cuesta?',                      is_correct: false, sort_order: 2 },
      { option_text: '¿Puedo pagar con tarjeta, por favor?', is_correct: true,  sort_order: 3 },
      { option_text: '¿Dónde está la salida?',               is_correct: false, sort_order: 4 },
    ],
  },
  {
    sort_order: 123, type: 'listen_and_choose',
    question_text: '¿Cuál es la traducción correcta de "De melk staat bij de zuivel"?',
    correct_answer: 'La leche está en la sección de lácteos.',
    hint: '"Staan" = estar (de pie). "Zuivel" = lácteos.',
    explanation: '"Staan" se usa para la leche porque el cartón está vertical. "Zuivel" = sección de lácteos.',
    options: [
      { option_text: 'El zumo está junto a la pasta.',            is_correct: false, sort_order: 1 },
      { option_text: 'La leche está en la sección de lácteos.',  is_correct: true,  sort_order: 2 },
      { option_text: 'El pan está en la panadería.',              is_correct: false, sort_order: 3 },
      { option_text: 'La leche está en el carrito.',             is_correct: false, sort_order: 4 },
    ],
  },
  {
    sort_order: 124, type: 'listen_and_choose',
    question_text: '¿Cuál es la traducción correcta de "Ik wil een kopje koffie"?',
    correct_answer: 'Quiero una tacita de café.',
    hint: '"Kopje" es el diminutivo de "kop" (taza grande).',
    explanation: '"Wil" = quiero, "kopje" = tacita (diminutivo de kop). Los diminutivos en -je son muy comunes.',
    options: [
      { option_text: 'Quiero un vaso de agua.',    is_correct: false, sort_order: 1 },
      { option_text: 'Quiero una tacita de café.', is_correct: true,  sort_order: 2 },
      { option_text: 'Bebo una cerveza.',          is_correct: false, sort_order: 3 },
      { option_text: 'Como un bocadillo.',         is_correct: false, sort_order: 4 },
    ],
  },
  {
    sort_order: 125, type: 'listen_and_choose',
    question_text: '¿Cuál es la traducción correcta de "Als ontbijt eet ik brood"?',
    correct_answer: 'De desayuno como pan.',
    hint: '"Ontbijt" = desayuno. "Als" aquí significa "de" (como indicador de momento).',
    explanation: 'Cuando "Als ontbijt" va al inicio, el sujeto (ik) va después del verbo (inversión).',
    options: [
      { option_text: 'De desayuno como pan.',     is_correct: true,  sort_order: 1 },
      { option_text: 'Para cenar bebo leche.',    is_correct: false, sort_order: 2 },
      { option_text: 'Compro pan en el desayuno.',is_correct: false, sort_order: 3 },
      { option_text: 'Como almuerzo bebo café.',  is_correct: false, sort_order: 4 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SECCIÓN 4 — order_sentence: Ordena las palabras (sort_order 130-133)
  // ══════════════════════════════════════════════════════════════════════════
  {
    sort_order: 130, type: 'order_sentence',
    question_text: 'Ordena las palabras: "Compro leche en el supermercado."',
    correct_answer: 'Ik koop melk in de supermarkt.',
    hint: '"Kopen" = comprar. El verbo va siempre en segunda posición.',
    explanation: 'En neerlandés: sujeto + verbo + objeto + lugar.',
    options: [
      { option_text: 'Ik',          is_correct: false, sort_order: 1 },
      { option_text: 'koop',        is_correct: false, sort_order: 2 },
      { option_text: 'melk',        is_correct: false, sort_order: 3 },
      { option_text: 'in',          is_correct: false, sort_order: 4 },
      { option_text: 'de',          is_correct: false, sort_order: 5 },
      { option_text: 'supermarkt.', is_correct: false, sort_order: 6 },
    ],
  },
  {
    sort_order: 131, type: 'order_sentence',
    question_text: 'Ordena las palabras: "Como un bocadillo con jamón."',
    correct_answer: 'Ik eet een boterham met ham.',
    hint: '"Met" = con. "Boterham" = bocadillo.',
    explanation: '"Met" conecta el alimento con su acompañamiento.',
    options: [
      { option_text: 'Ik',       is_correct: false, sort_order: 1 },
      { option_text: 'eet',      is_correct: false, sort_order: 2 },
      { option_text: 'een',      is_correct: false, sort_order: 3 },
      { option_text: 'boterham', is_correct: false, sort_order: 4 },
      { option_text: 'met',      is_correct: false, sort_order: 5 },
      { option_text: 'ham.',     is_correct: false, sort_order: 6 },
    ],
  },
  {
    sort_order: 132, type: 'order_sentence',
    question_text: 'Ordena las palabras: "¿Dónde está la caja?"',
    correct_answer: 'Waar is de kassa?',
    hint: '"Waar" = dónde. En preguntas el verbo va en segunda posición.',
    explanation: 'Preguntas: palabra interrogativa + verbo + sujeto.',
    options: [
      { option_text: 'Waar',   is_correct: false, sort_order: 1 },
      { option_text: 'is',     is_correct: false, sort_order: 2 },
      { option_text: 'de',     is_correct: false, sort_order: 3 },
      { option_text: 'kassa?', is_correct: false, sort_order: 4 },
    ],
  },
  {
    sort_order: 133, type: 'order_sentence',
    question_text: 'Ordena las palabras: "De cena como arroz con verduras."',
    correct_answer: 'Als avondeten eet ik rijst met groenten.',
    hint: '"Als avondeten" al inicio → el sujeto va después del verbo (inversión).',
    explanation: 'Regla de inversión: si el adverbio de tiempo va al inicio, sujeto y verbo se invierten.',
    options: [
      { option_text: 'Als',       is_correct: false, sort_order: 1 },
      { option_text: 'avondeten', is_correct: false, sort_order: 2 },
      { option_text: 'eet',       is_correct: false, sort_order: 3 },
      { option_text: 'ik',        is_correct: false, sort_order: 4 },
      { option_text: 'rijst',     is_correct: false, sort_order: 5 },
      { option_text: 'met',       is_correct: false, sort_order: 6 },
      { option_text: 'groenten.', is_correct: false, sort_order: 7 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SECCIÓN 5 — match_pairs: Empareja columnas (sort_order 140-142)
  // ══════════════════════════════════════════════════════════════════════════
  {
    sort_order: 140, type: 'match_pairs',
    question_text: 'Empareja las comidas del día con su traducción.',
    correct_answer: 'match',
    hint: 'Hay tres momentos principales para comer en un día.',
    explanation: null,
    options: [],
    pairs: [
      { left: 'het ontbijt',   right: 'el desayuno' },
      { left: 'de lunch',      right: 'el almuerzo' },
      { left: 'het avondeten', right: 'la cena' },
      { left: 'het eten',      right: 'la comida' },
      { left: 'het drinken',   right: 'la bebida' },
    ],
  },
  {
    sort_order: 141, type: 'match_pairs',
    question_text: 'Empareja las palabras del supermercado con su traducción.',
    correct_answer: 'match',
    hint: 'Piensa en personas, lugares y secciones.',
    explanation: null,
    options: [],
    pairs: [
      { left: 'de klant',           right: 'el cliente' },
      { left: 'de kassamedewerker', right: 'el cajero' },
      { left: 'de ingang',          right: 'la entrada' },
      { left: 'de uitgang',         right: 'la salida' },
      { left: 'de zuivel',          right: 'los lácteos' },
    ],
  },
  {
    sort_order: 142, type: 'match_pairs',
    question_text: 'Empareja los diminutivos con su significado.',
    correct_answer: 'match',
    hint: 'Todos terminan en -je: son versiones pequeñas o afectivas.',
    explanation: null,
    options: [],
    pairs: [
      { left: 'het hapje',   right: 'el bocado' },
      { left: 'het slokje',  right: 'el sorbito' },
      { left: 'het stukje',  right: 'el trocito' },
      { left: 'het glaasje', right: 'el vasito' },
      { left: 'het kopje',   right: 'la tacita' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SECCIÓN 6 — word_scramble: Adivina la palabra (sort_order 150-153)
  // ══════════════════════════════════════════════════════════════════════════
  {
    sort_order: 150, type: 'word_scramble',
    question_text: 'Ordena las letras para formar la palabra que significa "comprar".',
    correct_answer: 'kopen',
    hint: 'Empieza por "k" y tiene 5 letras.',
    explanation: '"Kopen" = comprar. Conjugado: ik koop, jij koopt, wij kopen.',
    options: [],
  },
  {
    sort_order: 151, type: 'word_scramble',
    question_text: 'Ordena las letras para formar la palabra que significa "el desayuno".',
    correct_answer: 'ontbijt',
    hint: 'Empieza por "o" y tiene 7 letras.',
    explanation: '"Het ontbijt" = el desayuno. Típicamente se come alrededor de las 7-8h.',
    options: [],
  },
  {
    sort_order: 152, type: 'word_scramble',
    question_text: 'Ordena las letras para formar la palabra que significa "pagar con tarjeta".',
    correct_answer: 'pinnen',
    hint: 'Empieza por "p" y tiene 6 letras.',
    explanation: '"Pinnen" = pagar con tarjeta. Casi todo se paga con tarjeta en los Países Bajos.',
    options: [],
  },
  {
    sort_order: 153, type: 'word_scramble',
    question_text: 'Ordena las letras para formar la palabra que significa "la zanahoria".',
    correct_answer: 'wortel',
    hint: 'Empieza por "w" y tiene 6 letras.',
    explanation: '"De wortel" = la zanahoria.',
    options: [],
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SECCIÓN 7 — write_answer: Escribe en neerlandés (sort_order 160-163)
  // ══════════════════════════════════════════════════════════════════════════
  {
    sort_order: 160, type: 'write_answer',
    question_text: '¿Cómo se dice en neerlandés "el desayuno"? (con artículo)',
    correct_answer: 'het ontbijt',
    hint: 'Es un sustantivo neutro.',
    explanation: '"Het ontbijt" = el desayuno. Artículo neutro het.',
    options: [],
  },
  {
    sort_order: 161, type: 'write_answer',
    question_text: '¿Cómo se dice en neerlandés "Bebo café"? (frase completa)',
    correct_answer: 'Ik drink koffie.',
    hint: '"Drinken" → ik drink. "Café" = koffie.',
    explanation: '"Ik drink koffie." — Recuerda: los líquidos son "drinken".',
    options: [],
  },
  {
    sort_order: 162, type: 'write_answer',
    question_text: '¿Cómo se dice en neerlandés "¿Dónde están las verduras?"',
    correct_answer: 'Waar zijn de groenten?',
    hint: '"Dónde" = waar, "están" = zijn (plural), "las verduras" = de groenten.',
    explanation: '"Waar zijn de groenten?" — "zijn" es el verbo ser/estar en plural.',
    options: [],
  },
  {
    sort_order: 163, type: 'write_answer',
    question_text: '¿Cómo se dice en neerlandés "Cojo una cesta"?',
    correct_answer: 'Ik neem een mandje.',
    hint: '"Nemen" = coger/tomar. Ik neem (irregular). "Cesta" = mandje.',
    explanation: '"Ik neem een mandje." — "Nemen" es irregular: ik neem (no "ik neme").',
    options: [],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Resolver lesson_id
  console.log('🔍 Buscando lección m3-les-1-eten-en-drinken...');
  const modules = await get('modules', 'slug=eq.boodschappen&select=id');
  if (!modules.length) throw new Error('Módulo "boodschappen" no encontrado. Verifica el slug.');
  const moduleId = modules[0].id;

  const lessons = await get('lessons', `module_id=eq.${moduleId}&slug=eq.m3-les-1-eten-en-drinken&select=id,slug`);
  if (!lessons.length) throw new Error('Lección m3-les-1-eten-en-drinken no encontrada.');
  const lessonId = lessons[0].id;
  console.log(`✅ Lección encontrada (id: ${lessonId})`);

  // 2. Limpiar solo sort_order >= 100 (preserva contenido original 1-99)
  console.log('\n🧹 Limpiando sort_order >= 100 (no toca el contenido original)...');

  // Obtener practice_items a borrar para eliminar sus opciones y pares primero
  const existingPractice = await get('practice_items', `lesson_id=eq.${lessonId}&sort_order=gte.100&select=id`);
  if (existingPractice.length > 0) {
    const ids = existingPractice.map(r => r.id);
    for (const id of ids) {
      try { await del('match_pair_items', `practice_item_id=eq.${id}`); } catch {}
      try { await del('practice_options', `practice_item_id=eq.${id}`); } catch {}
    }
    await del('practice_items', `lesson_id=eq.${lessonId}&sort_order=gte.100`);
  }
  await del('phrases',          `lesson_id=eq.${lessonId}&sort_order=gte.100`);
  await del('vocabulary_items', `lesson_id=eq.${lessonId}&sort_order=gte.100`);
  console.log('   ✅ Limpieza completada');

  // 3. Insertar vocabulario
  console.log('\n📚 Insertando vocabulario...');
  const vocabRows = VOCABULARY.map(v => ({
    lesson_id:      lessonId,
    sort_order:     v.sort_order,
    article:        v.article ?? null,
    word_nl:        v.word_nl,
    translation_es: v.translation_es,
    audio_url:      null,
  }));
  await post('vocabulary_items', vocabRows);
  console.log(`   ✅ ${vocabRows.length} palabras insertadas`);

  // 4. Insertar frases
  console.log('\n💬 Insertando frases...');
  const phraseRows = PHRASES.map(p => ({
    lesson_id:      lessonId,
    sort_order:     p.sort_order,
    phrase_nl:      p.phrase_nl,
    translation_es: p.translation_es,
    audio_url:      null,
  }));
  await post('phrases', phraseRows);
  console.log(`   ✅ ${phraseRows.length} frases insertadas`);

  // 5. Insertar ejercicios
  console.log('\n🧩 Insertando ejercicios...');
  let totalExercises = 0;
  for (const ex of EXERCISES) {
    const [item] = await post('practice_items', {
      lesson_id:     lessonId,
      sort_order:    ex.sort_order,
      type:          ex.type,
      question_text: ex.question_text,
      correct_answer:ex.correct_answer,
      hint:          ex.hint ?? null,
      explanation:   ex.explanation ?? null,
    });
    const itemId = item.id;

    // Opciones (multiple_choice, listen_and_choose, order_sentence)
    if (ex.options && ex.options.length > 0) {
      await post('practice_options', ex.options.map(o => ({
        practice_item_id: itemId,
        sort_order:       o.sort_order,
        option_text:      o.option_text,
        is_correct:       o.is_correct,
      })));
    }

    // Pares (match_pairs)
    if (ex.pairs && ex.pairs.length > 0) {
      await post('match_pair_items', ex.pairs.map((p, i) => ({
        practice_item_id: itemId,
        sort_order:       i + 1,
        left_text:        p.left,
        right_text:       p.right,
      })));
    }

    totalExercises++;
    process.stdout.write(`   [${totalExercises}/${EXERCISES.length}] ${ex.type} (sort_order ${ex.sort_order})\r`);
  }
  console.log(`\n   ✅ ${totalExercises} ejercicios insertados`);

  console.log('\n🎉 ¡Todo listo! Módulo 3 Lección 1 actualizado correctamente.');
  console.log('   → Vocabulario:  ' + VOCABULARY.length + ' palabras (7 secciones)');
  console.log('   → Frases:       ' + PHRASES.length + ' frases útiles');
  console.log('   → Ejercicios:   ' + EXERCISES.length + ' ejercicios (7 tipos diferentes)');
  console.log('   → audio_url:    null en todo — rellena manualmente cuando tengas los audios.');
}

main().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });
