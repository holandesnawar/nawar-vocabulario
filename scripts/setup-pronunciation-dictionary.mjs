/**
 * setup-pronunciation-dictionary.mjs
 *
 * Sube un diccionario fonético IPA a ElevenLabs y guarda el id+version
 * en .env.local para que generate-audio.mjs lo use automáticamente.
 *
 * Idempotente: si el diccionario "nawar-nl-loanwords" ya existe, lo
 * reemplaza con las reglas actuales de PHONETICS_NL.
 *
 * Requisitos:
 *  - API key con permiso "pronunciation_dictionaries_write" activado.
 *
 * Uso: node scripts/setup-pronunciation-dictionary.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');
const envText = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const ELEVEN_KEY = env['ELEVENLABS_API_KEY'];
if (!ELEVEN_KEY) {
  console.error('❌  ELEVENLABS_API_KEY no encontrado en .env.local');
  process.exit(1);
}

// ─── Diccionario fonético IPA holandés ─────────────────────────────────────
// Añade aquí palabras que ElevenLabs pronuncia mal. IPA holandés (Wiktionary).
const PHONETICS_NL = {
  'lunch':       'lʏntʃ',
  'ham':         'ɦɑm',
  'yoghurt':     'ˈjɔːɣʏrt',
  'sinaasappel': 'ˈsiːnaːsˌɑpəl',
  'pasta':       'ˈpɑstaː',
  'pinnen':      'ˈpɪnə',
  'kaas':        'kaːs',
  'sap':         'sɑp',
  'klant':       'klɑnt',
  // Añade más aquí. Después re-corre este script para actualizar.
};

const DICT_NAME = 'nawar-nl-loanwords';

// ─── API helpers ───────────────────────────────────────────────────────────

const elHeaders = {
  'xi-api-key': ELEVEN_KEY,
  'Content-Type': 'application/json',
};

async function listDictionaries() {
  const r = await fetch('https://api.elevenlabs.io/v1/pronunciation-dictionaries', { headers: elHeaders });
  if (!r.ok) throw new Error(`List dictionaries: ${r.status} ${await r.text()}`);
  const data = await r.json();
  return data.pronunciation_dictionaries ?? [];
}

async function deleteDictionary(id) {
  const r = await fetch(`https://api.elevenlabs.io/v1/pronunciation-dictionaries/${id}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': ELEVEN_KEY },
  });
  if (!r.ok && r.status !== 404) {
    console.warn(`⚠ Delete dictionary ${id}: ${r.status} ${await r.text()}`);
  }
}

async function createDictionary(rules, name) {
  const r = await fetch('https://api.elevenlabs.io/v1/pronunciation-dictionaries/add-from-rules', {
    method: 'POST',
    headers: elHeaders,
    body: JSON.stringify({ rules, name }),
  });
  if (!r.ok) throw new Error(`Create dictionary: ${r.status} ${await r.text()}`);
  return r.json();
}

// ─── Update .env.local ─────────────────────────────────────────────────────

function setEnvVar(text, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) return text.replace(re, `${key}=${value}`);
  return text.trimEnd() + `\n${key}=${value}\n`;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`📖  Setup pronunciation dictionary "${DICT_NAME}" (${Object.keys(PHONETICS_NL).length} palabras)\n`);

  // 1. Borrar diccionario anterior si existe (idempotente)
  const existing = (await listDictionaries()).filter(d => d.name === DICT_NAME);
  for (const d of existing) {
    console.log(`   🗑  Borrando versión anterior: ${d.id}`);
    await deleteDictionary(d.id);
  }

  // 2. Crear nuevo
  const rules = Object.entries(PHONETICS_NL).map(([word, ipa]) => ({
    type: 'phoneme',
    string_to_replace: word,
    phoneme: ipa,
    alphabet: 'ipa',
  }));

  const dict = await createDictionary(rules, DICT_NAME);
  const id = dict.id || dict.pronunciation_dictionary_id;
  const versionId = dict.version_id;
  if (!id || !versionId) {
    console.error('❌  Respuesta inesperada:', JSON.stringify(dict).slice(0, 300));
    process.exit(1);
  }
  console.log(`   ✓ Creado dictionary id=${id} version=${versionId}`);

  // 3. Guardar en .env.local para que generate-audio.mjs lo use
  let updated = setEnvVar(envText, 'ELEVENLABS_DICT_ID', id);
  updated = setEnvVar(updated, 'ELEVENLABS_DICT_VERSION', versionId);
  writeFileSync(envPath, updated);
  console.log(`   ✓ Guardado en .env.local: ELEVENLABS_DICT_ID, ELEVENLABS_DICT_VERSION\n`);

  console.log('🎉  Listo. Para regenerar palabras concretas:');
  console.log('   node scripts/generate-audio.mjs --scope=m3-les-1-eten-en-drinken --re-record=lunch,ham,yoghurt');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
