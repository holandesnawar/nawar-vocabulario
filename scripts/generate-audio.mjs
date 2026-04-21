/**
 * generate-audio.mjs
 *
 * Genera audio MP3 con ElevenLabs para el contenido de Supabase y lo sube
 * al bucket público "nawar-audio". Idempotente: solo genera lo que aún no
 * tiene audio_url.
 *
 * Voz por defecto: Charlotte (XB0fDUnXU5powFXDhCwa) — multilingual_v2.
 * Modelo: eleven_multilingual_v2 (mejor para neerlandés).
 *
 * Uso:
 *   node scripts/generate-audio.mjs                  # Test Zone (default)
 *   node scripts/generate-audio.mjs --scope=test     # Test Zone vocab only
 *   node scripts/generate-audio.mjs --scope=all      # Todo el curso
 *   node scripts/generate-audio.mjs --dry            # Cuenta sin generar
 *   node scripts/generate-audio.mjs --voice=ID       # Override voice
 *
 * Para diálogos genera 2 versiones: normal + lenta (0.75x).
 */

import { readFileSync, writeFileSync } from 'fs';
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
const ELEVEN_KEY = env['ELEVENLABS_API_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}
if (!ELEVEN_KEY) {
  console.error('❌  Falta ELEVENLABS_API_KEY en .env.local');
  process.exit(1);
}

// CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const scopeArg = args.find(a => a.startsWith('--scope='))?.split('=')[1] ?? 'test';
const voiceOverride = args.find(a => a.startsWith('--voice='))?.split('=')[1];
const useDict = args.includes('--use-dict'); // Marianne no lo necesita; off por defecto
const forceAll = args.includes('--force');   // Regenera TODO el scope, ignora audio existente
// --re-record=lunch,ham,yoghurt → borra audio_url + MP3 de esas palabras específicas
const reRecordWords = (args.find(a => a.startsWith('--re-record='))?.split('=')[1] ?? '')
  .split(',').map(w => w.trim().toLowerCase()).filter(Boolean);

const VOICE_ID = voiceOverride ?? 'tfweP7lGJyLeNV9dH1Rm'; // Marianne (NL nativa)
const MODEL_ID = 'eleven_multilingual_v2';
const BUCKET = 'nawar-audio';

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// ─── Supabase REST helpers ─────────────────────────────────────────────────

async function sbGet(table, params) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: sbHeaders });
  if (!r.ok) throw new Error(`GET ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbPatch(table, params, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers: { ...sbHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${table}: ${r.status} ${await r.text()}`);
}

// ─── Storage upload ────────────────────────────────────────────────────────

async function uploadMp3(path, bytes) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'audio/mpeg',
      'x-upsert': 'true',
    },
    body: bytes,
  });
  if (!r.ok) throw new Error(`Upload ${path}: ${r.status} ${await r.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// ─── ElevenLabs ────────────────────────────────────────────────────────────

// Pronunciation dictionary uploaded por scripts/setup-pronunciation-dictionary.mjs
// Si está configurado, ElevenLabs aplica las reglas IPA antes de sintetizar.
// El diccionario se mantiene en .env.local; correr el setup script lo actualiza.
const DICT_ID = env['ELEVENLABS_DICT_ID'];
const DICT_VERSION = env['ELEVENLABS_DICT_VERSION'];

async function synthesize(text, opts = {}) {
  const speed = opts.speed ?? 1.0;
  const body = {
    text,
    model_id: MODEL_ID,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0,
      use_speaker_boost: true,
      speed,
    },
    language_code: 'nl',
  };
  // Dict solo si explícitamente se pide con --use-dict. Con voz nativa NL
  // (Marianne) el dict puede romper la sintesis de algunas palabras.
  if (useDict && DICT_ID && DICT_VERSION) {
    body.pronunciation_dictionary_locators = [
      { pronunciation_dictionary_id: DICT_ID, version_id: DICT_VERSION },
    ];
  }
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`ElevenLabs ${r.status}: ${errText}`);
  }
  return new Uint8Array(await r.arrayBuffer());
}

// ─── Slug helper for filenames ─────────────────────────────────────────────

function slug(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ─── Main pipeline ─────────────────────────────────────────────────────────

async function main() {
  console.log(`🎙️  generate-audio — voz=${VOICE_ID} modelo=${MODEL_ID} scope=${scopeArg}${dryRun ? ' (DRY RUN)' : ''}\n`);

  // Build the lesson scope
  const lessonFilter = scopeArg === 'test'
    ? 'slug=eq.test-zone-vocab'
    : scopeArg === 'all'
      ? '' // all lessons
      : `slug=eq.${scopeArg}`;

  const lessons = await sbGet('lessons', `${lessonFilter}${lessonFilter ? '&' : ''}select=id,slug,title_es`);
  if (lessons.length === 0) {
    console.error(`❌  No se encontraron lecciones con scope="${scopeArg}"`);
    process.exit(1);
  }
  console.log(`✅  ${lessons.length} lección(es) en scope:`);
  lessons.forEach(l => console.log(`     • ${l.slug} — ${l.title_es}`));
  console.log();

  const lessonIds = lessons.map(l => l.id).join(',');

  // ── Re-record: limpiar audio_url y borrar MP3s de palabras especificadas ─
  async function deleteStorage(path) {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    // 200 = deleted, 400/404 = not exists (OK), other = error
    if (!r.ok && r.status !== 400 && r.status !== 404) {
      console.warn(`  ⚠ DELETE ${path}: ${r.status} ${await r.text()}`);
    }
  }

  // ── Force: limpia TODO el scope (vocab+phrases+practice+options) antes de regenerar ─
  if (forceAll && !dryRun) {
    console.log(`♻️  FORCE: borrando todo el audio del scope antes de regenerar`);
    // Vocab: clear audio_url + delete MP3s
    const vocabAll = await sbGet('vocabulary_items', `lesson_id=in.(${lessonIds})&select=id,word_nl,lesson_id`);
    for (const v of vocabAll) {
      const base = `vocab/${v.lesson_id}-${slug(v.word_nl)}.mp3`;
      const art = `vocab/${v.lesson_id}-${slug(v.word_nl)}-art.mp3`;
      await deleteStorage(base);
      await deleteStorage(art);
      await sbPatch('vocabulary_items', `id=eq.${v.id}`, { audio_url: null });
    }
    // Phrases: clear audio_url + delete MP3s
    const phrasesAll = await sbGet('phrases', `lesson_id=in.(${lessonIds})&select=id,phrase_nl,lesson_id`);
    for (const p of phrasesAll) {
      await deleteStorage(`phrases/${p.lesson_id}-${slug(p.phrase_nl)}.mp3`);
      await sbPatch('phrases', `id=eq.${p.id}`, { audio_url: null });
    }
    // Practice items (listen_*): delete MP3s
    const practiceAll = await sbGet('practice_items', `lesson_id=in.(${lessonIds})&select=id,type`);
    for (const p of practiceAll) {
      if (p.type === 'listen_and_choose' || p.type === 'listen_translate') {
        await deleteStorage(`practice/${p.id}.mp3`);
      }
    }
    // Options de fill_blank: delete MP3s
    const fillBlankIds2 = practiceAll.filter(p => p.type === 'fill_blank').map(p => p.id);
    if (fillBlankIds2.length > 0) {
      const opts = await sbGet('practice_options', `practice_item_id=in.(${fillBlankIds2.join(',')})&select=option_text`);
      const seen = new Set();
      for (const o of opts) {
        const s = slug(o.option_text || '');
        if (!s || seen.has(s)) continue;
        seen.add(s);
        await deleteStorage(`options/${s}.mp3`);
      }
    }
    console.log(`   Scope limpio — listo para regenerar\n`);
  }

  if (reRecordWords.length > 0 && !dryRun) {
    console.log(`♻️  Re-record solicitado para: ${reRecordWords.join(', ')}`);
    const allVocab = await sbGet('vocabulary_items', `lesson_id=in.(${lessonIds})&select=id,word_nl,lesson_id`);
    let cleared = 0;
    for (const v of allVocab) {
      if (!reRecordWords.includes((v.word_nl || '').trim().toLowerCase())) continue;
      const baseName = `vocab/${v.lesson_id}-${slug(v.word_nl)}.mp3`;
      const articleName = `vocab/${v.lesson_id}-${slug(v.word_nl)}-art.mp3`;
      await deleteStorage(baseName);
      await deleteStorage(articleName);
      await sbPatch('vocabulary_items', `id=eq.${v.id}`, { audio_url: null });
      cleared++;
    }
    // Opciones de fill_blank con esos textos
    const fillBlankIds = (await sbGet('practice_items', `lesson_id=in.(${lessonIds})&type=eq.fill_blank&select=id`)).map(p => p.id);
    if (fillBlankIds.length > 0) {
      const allOptions = await sbGet('practice_options', `practice_item_id=in.(${fillBlankIds.join(',')})&select=id,option_text`);
      const seenOptionTexts = new Set();
      for (const o of allOptions) {
        const text = (o.option_text || '').trim().toLowerCase();
        if (!reRecordWords.includes(text) || seenOptionTexts.has(text)) continue;
        seenOptionTexts.add(text);
        await deleteStorage(`options/${slug(o.option_text)}.mp3`);
        cleared++;
      }
    }
    console.log(`   Limpieza: ${cleared} item(s)\n`);
  }

  // ── Recoger todo lo que falta audio ──────────────────────────────────────
  const tasks = [];

  // 1) vocabulary_items: 2 versiones por palabra
  //    - vocab/{lesson_id}-{slug}.mp3       → palabra sin artículo (uso en ejercicios)
  //    - vocab/{lesson_id}-{slug}-art.mp3   → con artículo (uso en Diccionario)
  //    audio_url en DB guarda la versión SIN artículo. La versión con artículo
  //    se computa client-side via URL determinista.
  const vocab = await sbGet('vocabulary_items', `lesson_id=in.(${lessonIds})&select=id,word_nl,article,audio_url,lesson_id`);
  for (const v of vocab) {
    const word = v.word_nl;
    if (!word) continue;
    const baseName = `vocab/${v.lesson_id}-${slug(word)}.mp3`;
    const articleName = `vocab/${v.lesson_id}-${slug(word)}-art.mp3`;

    // Sin artículo (palabra sola) — para ejercicios
    if (!v.audio_url) {
      tasks.push({
        table: 'vocabulary_items',
        id: v.id,
        column: 'audio_url',
        text: word,
        filename: baseName,
      });
    }

    // Con artículo — para Diccionario. Solo si hay artículo y el MP3 no existe ya.
    if (v.article) {
      const head = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${articleName}`, { method: 'HEAD' });
      if (!head.ok) {
        tasks.push({
          table: '__storage_only__',
          id: v.id,
          column: null,
          text: `${v.article} ${word}`,
          filename: articleName,
        });
      }
    }
  }

  // 2) phrases
  const phrases = await sbGet('phrases', `lesson_id=in.(${lessonIds})&audio_url=is.null&select=id,phrase_nl,lesson_id`);
  for (const p of phrases) {
    tasks.push({
      table: 'phrases',
      id: p.id,
      column: 'audio_url',
      text: p.phrase_nl,
      filename: `phrases/${p.lesson_id}-${slug(p.phrase_nl)}.mp3`,
    });
  }

  // 3) practice_items: URL determinista por id para listen_* (texto entre comillas).
  const practice = await sbGet('practice_items', `lesson_id=in.(${lessonIds})&select=id,type,question_text`);
  for (const p of practice) {
    if (p.type !== 'listen_and_choose' && p.type !== 'listen_translate') continue;
    const m = p.question_text?.match(/"([^"]+)"/);
    const text = m ? m[1] : null;
    if (!text) continue;
    const filename = `practice/${p.id}.mp3`;
    const head = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`, { method: 'HEAD' });
    if (head.ok) continue;
    tasks.push({ table: '__storage_only__', id: p.id, column: null, text, filename });
  }

  // 3b) practice_options para fill_blank: URL determinista por slug(text).
  //     Conjugaciones de verbos (eet, drink...) no están en vocab; necesitan
  //     su propio MP3. URL: options/{slug(text)}.mp3 (compartida entre lecciones).
  const practiceItemIds = practice.filter(p => p.type === 'fill_blank').map(p => p.id);
  if (practiceItemIds.length > 0) {
    const options = await sbGet('practice_options', `practice_item_id=in.(${practiceItemIds.join(',')})&select=option_text`);
    const seen = new Set();
    for (const o of options) {
      const text = (o.option_text ?? '').trim();
      if (!text) continue;
      const s = slug(text);
      if (!s || seen.has(s)) continue;
      seen.add(s);
      const filename = `options/${s}.mp3`;
      const head = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`, { method: 'HEAD' });
      if (head.ok) continue;
      tasks.push({ table: '__storage_only__', id: text, column: null, text, filename });
    }
  }

  // 4) dialogue_lines + dialogues (normal + slow)
  const dialogues = await sbGet('dialogues', `lesson_id=in.(${lessonIds})&select=id,title,audio_normal_url,audio_slow_url,lesson_id`);
  for (const d of dialogues) {
    const lines = await sbGet('dialogue_lines', `dialogue_id=eq.${d.id}&select=id,text_nl,audio_url&order=sort_order`);
    // Per-line audio
    for (const l of lines) {
      if (l.audio_url) continue;
      tasks.push({
        table: 'dialogue_lines',
        id: l.id,
        column: 'audio_url',
        text: l.text_nl,
        filename: `dialogue-lines/${d.id}-${l.id}.mp3`,
      });
    }
    // Full dialogue normal + slow (concatenate lines)
    const fullText = lines.map(l => l.text_nl).join('. ');
    if (!d.audio_normal_url && fullText) {
      tasks.push({
        table: 'dialogues',
        id: d.id,
        column: 'audio_normal_url',
        text: fullText,
        filename: `dialogues/${d.id}-normal.mp3`,
      });
    }
    if (!d.audio_slow_url && fullText) {
      tasks.push({
        table: 'dialogues',
        id: d.id,
        column: 'audio_slow_url',
        text: fullText,
        filename: `dialogues/${d.id}-slow.mp3`,
        speed: 0.75,
      });
    }
  }

  // ── Resumen previo ───────────────────────────────────────────────────────
  if (tasks.length === 0) {
    console.log('✅  Nada que generar — todo el contenido ya tiene audio.');
    return;
  }

  const totalChars = tasks.reduce((sum, t) => sum + t.text.length, 0);
  const estCost = (totalChars / 1000 * 0.18).toFixed(3);
  console.log(`📋  ${tasks.length} ítem(s) a generar:`);
  const byTable = tasks.reduce((acc, t) => { acc[t.table] = (acc[t.table] || 0) + 1; return acc; }, {});
  Object.entries(byTable).forEach(([t, n]) => console.log(`     • ${t}: ${n}`));
  console.log(`     Total: ${totalChars} chars · estimación coste: ~$${estCost} USD\n`);

  if (dryRun) {
    console.log('🧪  DRY RUN — no se genera nada. Ejemplos:');
    tasks.slice(0, 5).forEach(t => console.log(`     "${t.text}" → ${t.filename}`));
    return;
  }

  // ── Pipeline real ────────────────────────────────────────────────────────
  let ok = 0, fail = 0;
  for (const t of tasks) {
    try {
      process.stdout.write(`   [${ok + fail + 1}/${tasks.length}] ${t.filename}... `);
      const audio = await synthesize(t.text, { speed: t.speed });
      const url = await uploadMp3(t.filename, audio);
      // Actualiza DB solo si la tarea apunta a una columna real
      if (t.table !== '__storage_only__' && t.column) {
        await sbPatch(t.table, `id=eq.${t.id}`, { [t.column]: url });
      }
      ok++;
      console.log(`✓ (${audio.length} bytes)`);
    } catch (e) {
      fail++;
      console.log(`❌ ${e.message}`);
    }
  }

  console.log(`\n🎉  Hecho. ${ok} ok · ${fail} fallidos.`);
  if (fail > 0) console.log('    Re-corre el script para reintentar los fallidos (idempotente).');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
