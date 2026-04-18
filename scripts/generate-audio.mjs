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

const VOICE_ID = voiceOverride ?? 'XB0fDUnXU5powFXDhCwa'; // Charlotte
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

async function synthesize(text, opts = {}) {
  const speed = opts.speed ?? 1.0;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
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
    }),
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

  // 3) practice_items: la tabla no tiene columna audio_url, así que usamos
  //    URL determinista por id: practice/{id}.mp3. El cliente reconstruye
  //    la URL y la intenta — si 404, cae a TTS.
  //    Procesa listen_and_choose y listen_translate (texto entre comillas).
  //    NO actualiza ninguna tabla (la URL se computa client-side).
  const practice = await sbGet('practice_items', `lesson_id=in.(${lessonIds})&select=id,type,question_text`);
  for (const p of practice) {
    if (p.type !== 'listen_and_choose' && p.type !== 'listen_translate') continue;
    const m = p.question_text?.match(/"([^"]+)"/);
    const text = m ? m[1] : null;
    if (!text) continue;
    const filename = `practice/${p.id}.mp3`;
    // Skip si el MP3 ya existe en Storage
    const head = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`, { method: 'HEAD' });
    if (head.ok) continue;
    tasks.push({
      table: '__storage_only__', // marca: no actualizar DB, solo subir
      id: p.id,
      column: null,
      text,
      filename,
    });
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
