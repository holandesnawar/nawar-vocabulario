/**
 * vocab-coverage.mjs
 *
 * Auditor de vocabulario del curso. Conecta a Supabase, descarga toda la
 * tabla `vocabulary_items` con su lección y módulo, y produce un reporte:
 *
 *   - Cuántas palabras únicas hay por módulo y por lección
 *   - Qué palabras se repiten entre lecciones (duplicados)
 *   - Cobertura cruzada con una lista de referencia (CEFR A1 etc.)
 *
 * Uso:
 *
 *   # Reporte completo del curso
 *   node scripts/vocab-coverage.mjs
 *
 *   # Comprobar una lección que estás escribiendo (NO en Supabase aún)
 *   # Lee scripts/vocab-drafts/<slug>.json con un array de { word_nl, translation_es }
 *   node scripts/vocab-coverage.mjs --check m4-les-2-de-woning
 *
 *   # Cobertura contra una lista de referencia A1 estática
 *   node scripts/vocab-coverage.mjs --reference scripts/reference-vocab/A1-woning.json
 *
 * Idempotente y no destructivo: solo lee.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

/* ─── env: probar worktree primero, luego repo principal ─────────────── */
const ENV_CANDIDATES = [
  resolve(__dir, '../.env.local'),
  resolve(__dir, '../../../../.env.local'), // raíz repo principal cuando estamos en worktree
];
const envPath = ENV_CANDIDATES.find(existsSync);
if (!envPath) {
  console.error('❌  No encuentro .env.local. Probé:');
  ENV_CANDIDATES.forEach(p => console.error('   ' + p));
  process.exit(1);
}
const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en ' + envPath);
  process.exit(1);
}

const H = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${SERVICE_KEY}`,
  apikey: SERVICE_KEY,
};

async function get(table, params = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: H });
  if (!r.ok) throw new Error(`GET ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

/* ─── colores ANSI ──────────────────────────────────────────────────── */
const C = {
  reset: '\x1b[0m',
  dim:   '\x1b[2m',
  bold:  '\x1b[1m',
  red:   '\x1b[31m',
  green: '\x1b[32m',
  yellow:'\x1b[33m',
  blue:  '\x1b[34m',
  cyan:  '\x1b[36m',
  gray:  '\x1b[90m',
};
const c = (color, s) => `${C[color]}${s}${C.reset}`;

/* ─── normalización ─────────────────────────────────────────────────── */
// Clave canónica: lowercase + trim. Mantenemos artículo separado.
// Conservador: NO se quitan plurales/diminutivos para no fusionar palabras
// que enseñas como entradas distintas (ej. "het kind" vs "de kinderen").
const normalize = (w) => (w || '').toLowerCase().trim().replace(/\s+/g, ' ');

/* ─── carga de toda la tabla ─────────────────────────────────────────── */
async function loadAll() {
  const [modules, lessons, vocab] = await Promise.all([
    get('modules', 'select=id,slug,title_nl,sort_order&order=sort_order'),
    get('lessons', 'select=id,module_id,slug,title_nl,sort_order,is_extra&order=sort_order'),
    get('vocabulary_items', 'select=lesson_id,word_nl,article,translation_es,sort_order&order=sort_order'),
  ]);

  const modById    = Object.fromEntries(modules.map(m => [m.id, m]));
  const lessonById = Object.fromEntries(lessons.map(l => [l.id, l]));

  // Vocab enriquecido con lección y módulo + clave canónica
  const items = vocab.map(v => {
    const lesson = lessonById[v.lesson_id];
    const mod = lesson ? modById[lesson.module_id] : null;
    return {
      ...v,
      key: normalize(v.word_nl),
      lesson_slug: lesson?.slug ?? '(huérfana)',
      lesson_title: lesson?.title_nl ?? '?',
      module_slug: mod?.slug ?? '(sin-modulo)',
      module_title: mod?.title_nl ?? '?',
    };
  });

  return { modules, lessons, items };
}

/* ─── reporte general ───────────────────────────────────────────────── */
function reportOverview({ modules, lessons, items }) {
  console.log(c('bold', '\n📚 COBERTURA DE VOCABULARIO\n'));
  console.log(c('gray', `Total items en BD: ${items.length}`));
  console.log(c('gray', `Total palabras únicas (canónicas): ${new Set(items.map(i => i.key)).size}`));
  console.log(c('gray', `Módulos: ${modules.length} · Lecciones: ${lessons.length}\n`));

  // Por módulo
  for (const mod of modules) {
    const modItems = items.filter(i => i.module_slug === mod.slug);
    const modUnique = new Set(modItems.map(i => i.key)).size;
    const modLessons = lessons.filter(l => l.module_id === mod.id);

    console.log(c('cyan', `\n━━ ${mod.sort_order}. ${mod.title_nl} ${c('gray', `(${mod.slug})`)} `));
    console.log(`   ${modItems.length} entradas · ${c('bold', modUnique)} palabras únicas en el módulo`);

    for (const les of modLessons) {
      const lesItems = items.filter(i => i.lesson_id === les.id);
      const tag = les.is_extra ? c('yellow', '[extra] ') : '';
      console.log(`   ${c('gray', '·')} ${tag}${les.title_nl} ${c('gray', `— ${lesItems.length} palabras`)}`);
    }
  }
}

/* ─── duplicados cross-lesson ───────────────────────────────────────── */
function reportDuplicates({ items }) {
  // Agrupar por clave canónica
  const byKey = new Map();
  for (const it of items) {
    if (!byKey.has(it.key)) byKey.set(it.key, []);
    byKey.get(it.key).push(it);
  }

  // Solo los que aparecen en >1 lección distinta
  const dups = [...byKey.entries()]
    .filter(([_, occs]) => new Set(occs.map(o => o.lesson_id)).size > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(c('bold', '\n\n🔁 DUPLICADOS ENTRE LECCIONES\n'));
  if (dups.length === 0) {
    console.log(c('green', '   Ninguno. Curso libre de repeticiones cross-lesson. ✨'));
    return;
  }

  console.log(c('gray', `   ${dups.length} palabra(s) aparecen en más de una lección:\n`));
  for (const [key, occs] of dups) {
    const example = occs[0];
    const head = example.article ? `${example.article} ${example.word_nl}` : example.word_nl;
    console.log(`   ${c('yellow', '⚠')}  ${c('bold', head)} ${c('gray', `→ ${example.translation_es}`)}`);
    const seen = new Set();
    for (const o of occs) {
      const k = `${o.module_slug}/${o.lesson_slug}`;
      if (seen.has(k)) continue;
      seen.add(k);
      console.log(c('gray', `        en ${o.module_slug} / ${o.lesson_slug}`));
    }
  }
}

/* ─── modo --check: comprobar borrador de lección ────────────────────── */
async function checkDraft(slug, all) {
  const draftPath = resolve(__dir, 'vocab-drafts', `${slug}.json`);
  if (!existsSync(draftPath)) {
    console.error(c('red', `❌  No existe ${draftPath}`));
    console.error(c('gray', `   Crea un fichero JSON con la forma:`));
    console.error(c('gray', `   [`));
    console.error(c('gray', `     { "article": "de", "word_nl": "keuken", "translation_es": "cocina" },`));
    console.error(c('gray', `     { "article": null, "word_nl": "koken",  "translation_es": "cocinar" }`));
    console.error(c('gray', `   ]`));
    process.exit(1);
  }
  const draft = JSON.parse(readFileSync(draftPath, 'utf8'));
  const draftKeys = draft.map(d => ({ ...d, key: normalize(d.word_nl) }));

  // Index por clave de lo que YA hay en BD
  const inDb = new Map();
  for (const it of all.items) {
    if (!inDb.has(it.key)) inDb.set(it.key, []);
    inDb.get(it.key).push(it);
  }

  console.log(c('bold', `\n🧪 CHECK DRAFT — ${slug}\n`));
  console.log(c('gray', `   ${draft.length} palabras propuestas\n`));

  let nuevas = 0, duplicadas = 0;
  for (const d of draftKeys) {
    const head = d.article ? `${d.article} ${d.word_nl}` : d.word_nl;
    const occs = inDb.get(d.key);
    if (!occs) {
      console.log(`   ${c('green', '✓')} ${c('bold', head)} ${c('gray', `→ ${d.translation_es ?? ''}`)}`);
      nuevas++;
    } else {
      const where = [...new Set(occs.map(o => `${o.module_slug}/${o.lesson_slug}`))].join(', ');
      console.log(`   ${c('red', '✗')} ${c('bold', head)} ${c('gray', `→ ya está en ${where}`)}`);
      duplicadas++;
    }
  }

  console.log(c('bold', `\n   Resumen: ${c('green', nuevas + ' nuevas')} · ${c('red', duplicadas + ' duplicadas')}`));
  if (duplicadas > 0) {
    console.log(c('yellow', `   ⚠  Considera reemplazar las duplicadas por palabras del mismo tema que aún no hayas enseñado.`));
  }
}

/* ─── modo --reference: cobertura contra lista CEFR ──────────────────── */
async function checkReference(refPath, all) {
  if (!existsSync(refPath)) {
    console.error(c('red', `❌  No existe ${refPath}`));
    process.exit(1);
  }
  const ref = JSON.parse(readFileSync(refPath, 'utf8'));
  const refKeys = ref.words.map(w => ({ ...w, key: normalize(w.word_nl) }));
  const inDb = new Set(all.items.map(i => i.key));

  const covered = refKeys.filter(r => inDb.has(r.key));
  const missing = refKeys.filter(r => !inDb.has(r.key));
  const pct = Math.round((covered.length / refKeys.length) * 100);

  console.log(c('bold', `\n📋 COBERTURA — ${ref.title}\n`));
  console.log(c('gray', `   Fuente: ${basename(refPath)}`));
  console.log(c('gray', `   ${refKeys.length} palabras de referencia · ${covered.length} cubiertas (${pct}%)\n`));

  if (missing.length > 0) {
    console.log(c('yellow', `   Faltan ${missing.length}:\n`));
    for (const m of missing) {
      const head = m.article ? `${m.article} ${m.word_nl}` : m.word_nl;
      console.log(`   ${c('red', '·')} ${c('bold', head)} ${c('gray', `→ ${m.translation_es ?? ''}`)}`);
    }
  } else {
    console.log(c('green', '   Cobertura total. ✨'));
  }
}

/* ─── main ──────────────────────────────────────────────────────────── */
async function main() {
  const args = process.argv.slice(2);
  const all = await loadAll();

  if (args[0] === '--check' && args[1]) {
    await checkDraft(args[1], all);
    return;
  }
  if (args[0] === '--reference' && args[1]) {
    await checkReference(resolve(args[1]), all);
    return;
  }
  if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
Uso:
  node scripts/vocab-coverage.mjs                       Reporte completo
  node scripts/vocab-coverage.mjs --check <slug>        Comprobar borrador en scripts/vocab-drafts/<slug>.json
  node scripts/vocab-coverage.mjs --reference <path>    Cobertura contra lista CEFR
`);
    return;
  }

  reportOverview(all);
  reportDuplicates(all);
  console.log('');
}

main().catch(err => { console.error(err); process.exit(1); });
