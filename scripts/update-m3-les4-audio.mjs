/**
 * update-m3-les4-audio.mjs
 *
 * Añade (o actualiza) el audio_url del diálogo de la Lección 4
 * del Módulo 3 (boodschappen) en Supabase.
 *
 * URL: https://docs.holandesnawar.com/audio/19-12-2025.mp3
 *
 * Uso:  node scripts/update-m3-les4-audio.mjs
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
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Faltan variables en .env.local');
  process.exit(1);
}

const AUDIO_URL = 'https://docs.holandesnawar.com/audio/19-12-2025.mp3';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${SERVICE_KEY}`,
  apikey: SERVICE_KEY,
  Prefer: 'return=representation',
};

async function get(table, params) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers });
  if (!r.ok) throw new Error(`GET ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function patch(table, params, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function main() {
  console.log('🎧  Añadiendo audio al diálogo de M3 Les 4\n');

  // 1. Módulo boodschappen
  const [mod] = await get('modules', 'slug=eq.boodschappen&select=id,title_es');
  if (!mod) throw new Error('Módulo "boodschappen" no encontrado');
  console.log(`✅  Módulo: ${mod.title_es} (id=${mod.id})`);

  // 2. Lección con sort_order=4 dentro de ese módulo
  const lessons = await get('lessons', `module_id=eq.${mod.id}&sort_order=eq.4&select=id,slug,title_es`);
  if (!lessons.length) {
    // Fallback: buscar lecciones con "les-4" o "les4" en el slug
    const fallback = await get('lessons', `module_id=eq.${mod.id}&slug=ilike.*les*4*&select=id,slug,title_es,sort_order`);
    console.log('\n❌ No hay lección con sort_order=4 en boodschappen.');
    console.log('   Lecciones existentes en el módulo:');
    const all = await get('lessons', `module_id=eq.${mod.id}&select=id,slug,title_es,sort_order&order=sort_order`);
    all.forEach(l => console.log(`     - sort=${l.sort_order}  slug=${l.slug}  ${l.title_es ?? ''}`));
    if (fallback.length) {
      console.log('\n   Sospechosa por slug:');
      fallback.forEach(l => console.log(`     - sort=${l.sort_order}  slug=${l.slug}`));
    }
    process.exit(1);
  }
  const lesson = lessons[0];
  console.log(`✅  Lección: ${lesson.title_es} (id=${lesson.id}, slug=${lesson.slug})`);

  // 3. Diálogo asociado a esa lección (SELECT * para ver columnas reales)
  const dialogues = await get('dialogues', `lesson_id=eq.${lesson.id}&select=*`);
  if (!dialogues.length) {
    console.log('\n❌ Esta lección no tiene ningún diálogo aún.');
    console.log('   Habría que crearlo primero en Supabase → Table Editor → dialogues,');
    console.log('   con lesson_id=' + lesson.id);
    process.exit(1);
  }
  if (dialogues.length > 1) {
    console.log(`⚠️  Hay ${dialogues.length} diálogos en esta lección. Actualizo todos.`);
  }

  // Mostrar columnas reales del primer diálogo
  console.log('\n   Columnas reales de la tabla dialogues:');
  console.log('   ' + Object.keys(dialogues[0]).join(', '));
  console.log();

  // Buscar la columna de audio — probamos nombres comunes hasta encontrar uno
  const candidateCols = ['audio_url', 'audio', 'normal_audio_url', 'audio_normal_url', 'full_audio_url', 'audio_full_url', 'audioUrl'];
  const audioCol = candidateCols.find(c => c in dialogues[0]);
  if (!audioCol) {
    console.log('❌ No encuentro una columna de audio con un nombre conocido.');
    console.log('   Columnas disponibles: ' + Object.keys(dialogues[0]).join(', '));
    console.log('   Dime cuál es la correcta y actualizo el script.');
    process.exit(1);
  }
  console.log(`✅  Columna de audio detectada: "${audioCol}"`);

  dialogues.forEach(d => {
    console.log(`   • Diálogo id=${d.id}, title="${d.title ?? '(sin título)'}", ${audioCol} actual="${d[audioCol] ?? '(vacío)'}"`);
  });

  // 4. PATCH la columna detectada
  const ids = dialogues.map(d => d.id).join(',');
  const body = { [audioCol]: AUDIO_URL };
  const updated = await patch('dialogues', `id=in.(${ids})`, body);
  console.log(`\n✅  ${updated.length} diálogo(s) actualizado(s) con ${audioCol}=${AUDIO_URL}`);
  updated.forEach(d => {
    console.log(`   • id=${d.id}  ${audioCol}=${d[audioCol]}`);
  });

  console.log('\n🎉  Listo. Recarga la lección en la app (Cmd+Shift+R) para ver el reproductor.');
}

main().catch((e) => {
  console.error('❌ ERROR:', e.message);
  process.exit(1);
});
