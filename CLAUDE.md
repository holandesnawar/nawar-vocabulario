# CLAUDE.md — Memoria del proyecto HolandésNawar

Este archivo se carga automáticamente al abrir el proyecto. Rida lo lee para revisar; Claude lo usa para recuperar contexto entre sesiones.

---

## Stack y arquitectura

- **Next.js 16.2 (App Router) + React 19 + Tailwind 4** en Vercel
- **Supabase** (ref `alifjhqjmedstkafnrmp`) como source of truth para contenido
- Páginas de lección y módulo: `export const dynamic = 'force-dynamic'` → cada request re-fetch desde Supabase
- **localStorage** para progreso del alumno (sin auth — revertido en commit `b5c25a0a`)
- **Embebido vía iframe en Circle** (la plataforma principal del alumno)
- Rama de trabajo: `claude/affectionate-dijkstra` que pushea a `main`
- **Worktree** en `.claude/worktrees/affectionate-dijkstra/` — hay que trabajar aquí
- Push con credenciales HTTPS de la sesión (si falla, `git remote set-url origin git@github.com:holandesnawar/nawar-vocabulario.git`)
- **Despliegue en Vercel**: trigger automático al push a `main`; ~1-2 min

---

## Contexto de producto

- **Público**: adultos hispanohablantes aprendiendo neerlandés para vivir/trabajar en NL (Inburgering, NT2)
- **Moat**: Nawar es un profesor humano con criterio. No competimos con Duolingo.
- **Flujo**: Circle muestra video → botón "Practicar" → iframe a `/modulo/X/leccion/Y` de nuestra app.
- **Rechazado explícitamente**: SRS (fit4taal lo hace y falla), AI chat, gamificación pesada.
- **Enfoque**: lecciones + ejercicios + speaking club + consultas + resumen web/PDF + audio de clase.

---

## Flujo para construir una lección nueva (LO IMPORTANTE)

Este es el flujo consolidado para crear una lección completa a partir de un PPTX. **Úsalo como receta**.

### 1. Leer el PPTX

```bash
python3 -m pip install python-pptx --user  # si no está
cp "/ruta/al/PPTX.pptx" /tmp/lesson.pptx
python3 << 'EOF'
from pptx import Presentation
prs = Presentation('/tmp/lesson.pptx')
for i, s in enumerate(prs.slides, 1):
    print(f'--- Slide {i} ---')
    for sh in s.shapes:
        if sh.has_text_frame:
            for p in sh.text_frame.paragraphs:
                t = p.text.strip()
                if t: print(t)
        if sh.has_table:
            for r in sh.table.rows:
                cells = [c.text.strip() for c in r.cells]
                if any(cells): print('T:', ' | '.join(cells))
EOF
```

### 2. Extraer como Director Académico

No copiar literal. **Estructurar** el contenido en 5 secciones:
1. **Objetivos** de la lección (3-4 bullets, del slide de "lesdoelen")
2. **Secciones temáticas** (2-5, cada una con título con emoji + body opcional + items NL/ES)
3. **Vocabulario** clave (15-25 palabras: sustantivos con artículo de/het, + verbos sin artículo)
4. **Frases útiles** (10-15)
5. **Tema del diálogo** + **tema del texto de lectura** (escribir tú según PPT + contexto NL real)

**Regla del Director Académico**: si el PPTX es corto, **enriquécelo**. Añade palabras esenciales del tema que falten, frases colloquiales reales, un texto de lectura que contextualice.

### 3. Añadir módulo y lección en courseData.ts

Si el módulo no existe, añádelo al array `MODULES` en `src/lib/courseData.ts`:

```ts
{
  id: 'slug-del-modulo',
  title: 'Título NL',
  subtitle: 'Título ES',
  description: 'Frase corta que describe el módulo',
  order: 4, // siguiente en la secuencia
  emoji: '💼',
  level: 'Módulo 4',
  color: '#b91c1c', // distinto de los módulos previos
},
```

Luego añade el objeto Lesson al final de `LESSONS[]` con **el bloque de resumen** (ver siguiente sección).

### 4. Definir el bloque SummaryBlock (la sección "Resumen")

**Esta es la parte nueva y más importante**. El schema está en `src/lib/types.ts`:

```ts
interface SummaryBlock {
  type: 'summary';
  title?: string;        // aparece como h2 en el hero
  intro?: string;        // párrafo introductorio
  objectives?: string[]; // bullets con checks verdes
  sections: SummarySectionData[];
  tip?: string;          // banner amarillo al final (acepta **negritas**)
}

interface SummarySectionData {
  heading: string;       // título con emoji al inicio: "🏢 Sectores laborales"
  body?: string;         // texto explicativo (acepta **negritas**)
  items?: Array<{ nl?: string; es: string }>; // tabla NL → ES
}
```

**Ejemplo vivo**: mira el `m4_les1` en `src/lib/courseData.ts`. Úsalo de plantilla.

**Reglas de estilo para el Summary**:
- **Heading** con emoji al inicio (🏢, 👥, 🏛️, 📝, ⏱️, 🎓, 🗣️, etc.)
- **Body** corto, explicativo. Usar `**texto**` para resaltar estructuras clave ("Usamos **Ik werk in ...**")
- **Items**: NL a la izquierda, ES a la derecha. Si hay variantes, juntar con `/` (ej. "de zorg / de gezondheidszorg")
- **Tip** al final siempre aporta un dato **cultural/contextual** (cómo se usa en NL real), no gramatical

El componente `ResumenSection` en `LessonViewer.tsx` ya renderiza todo esto. No hay que tocarlo.

### 5. Crear el script de seed

Copia `scripts/seed-m4-les1.mjs` como plantilla para la nueva lección. Cambia:
- `slug`: `m{N}-les-{N}-{tema}`
- Módulo: crea si no existe (con id explícito `(max_id)+1` — hay desync del sequence, ojo)
- `vocab`, `phrases`, `dialogue lines`, `lezen text`, `practice items`

Tabla de cantidades objetivo por lección:

| Recurso | Mínimo | Ideal |
|---|---|---|
| Vocabulary | 15 | 20-25 |
| Phrases | 8 | 12-15 |
| Dialogue | 6 líneas | 8-10 |
| Lezen text | ~60 palabras NL | 80-120 |
| Lezen exercises | 5 | 7-8 |
| Practice | 12 | 16+ |

Mix recomendado para practice (igual que M4 L1):
- 4 `multiple_choice` con options
- 3 `fill_blank` con options (chip-tap + audio)
- 2 `true_false`
- 2 `order_sentence` con chips + distractores
- 1 `word_scramble`
- 1 `letter_dash` (palabra con huecos)
- 1 `match_pairs` (4 pares)
- 1 `odd_one_out`
- 1 `listen_translate` (NL → ES con chips)

### 6. Ejecutar el seed

```bash
cd .claude/worktrees/affectionate-dijkstra
node scripts/seed-m{N}-les{N}.mjs
```

El script debe ser **idempotente**: al re-ejecutarse borra el contenido previo de esa lección y reinserta. Copiar el patrón de `scripts/seed-m4-les1.mjs` literalmente.

### 7. Verificar build

```bash
npx tsc --noEmit
npx next build
```

### 8. Commit + push

Con mensaje descriptivo siguiendo la convención:

```
M{N} L{N} — {Tema}: módulo + lección + Resumen + contenido

- Módulo: {slug} ({emoji})
- Vocabulary: X
- Phrases: X
- Dialogue: X lines (título)
- Lezen: text + X exercises
- Practice: X exercises

Co-Authored-By: Claude Opus 4 (1M context) <noreply@anthropic.com>
```

### 9. (Después, si el usuario aprueba) Generar audio ElevenLabs

```bash
node scripts/generate-audio.mjs --scope=m{N}-les-{N}-{slug} --force
```

Coste: ~$0.30-0.40 por lección. Usa voz Marianne (ID `tfweP7lGJyLeNV9dH1Rm`) por defecto.

---

## Componentes y archivos clave

| Qué | Dónde |
|---|---|
| Tipos (LessonBlock, SummaryBlock) | `src/lib/types.ts` |
| Data local (módulos, lecciones, summary) | `src/lib/courseData.ts` |
| Merge local + Supabase | `src/lib/supabaseService.ts` → `fetchLesson()` |
| UI de la lección | `src/components/LessonViewer.tsx` |
| Sección Resumen | `LessonViewer.tsx` → `ResumenSection` (helper `renderInlineBold`) |
| Audio player | `src/components/AudioPlayer.tsx` |
| Generación de audio | `scripts/generate-audio.mjs` |
| Seed de lección | `scripts/seed-m{N}-les{N}.mjs` |

---

## Sistema de audio

- **Voz default**: **Marianne** (`tfweP7lGJyLeNV9dH1Rm`) — nativa NL
- **Sin dictionary IPA** en síntesis (rompía MP3s con Marianne nativa)
- **Bucket**: `nawar-audio` público en Supabase Storage
- **URLs deterministas**:
  - `vocab/{lesson_id}-{slug}.mp3` y `vocab/{lesson_id}-{slug}-art.mp3` (con artículo)
  - `phrases/{lesson_id}-{slug}.mp3`
  - `dialogues/{id}-normal.mp3` y `dialogues/{id}-slow.mp3` (0.75x)
  - `dialogue-lines/{dialogue_id}-{line_id}.mp3`
  - `practice/{practice_item_id}.mp3` (listen_and_choose, listen_translate)
  - `options/{slug(text)}.mp3` (fill_blank options)
- **Cliente**: función `speakDutch(text)` consulta `_wordAudioMap` global (poblado por LessonViewer desde vocab + phrases + practice + options). Match → MP3. No match → TTS fallback.

---

## UX establecido (no romper)

- **No hard-locking** de lecciones — Circle es el source of truth. `markPreviousAsCompleted` auto-marca anteriores al acceder por URL.
- **Navegación tipo libro**: al pasar de step, se guarda `indexKey = length-1` para aterrizar en el último al volver atrás.
- **Fill_blank 2 fases**: tap chip = escucha + rellena, botón "Comprobar" valida.
- **Hover unificado**: sutil cambio de color en desktop, nada en mobile.
- **Banner morado sólido `#1D0084`** como tu web nawar-web (no gradient).
- **Modo oscuro** con toggle sun/moon en banner. Persistido en localStorage (`nawar-theme`).
- **Botones primarios** en dark usan `#4da3ff` con texto oscuro.

---

## Seguridad (aplicado)

- Eliminadas rutas `/api/seed` (wipe DB público) y `/api/debug` (leak schema)
- Seeds solo desde `scripts/` locales con service role key
- CSP `frame-ancestors *` intencional para Circle

---

## Quick reference: slugs y IDs

| Módulo | slug | id Supabase |
|---|---|---|
| Over jou | `over-jou` | 7 |
| Familie & vrienden | `familie-vrienden` | 8 |
| Boodschappen | `boodschappen` | 9 |
| Het werk | `het-werk` | 10 |

Lesson IDs: se asignan automáticos. El secuence de `modules.id` está desincronizado → usar `id: maxId + 1` explícito al crear módulo nuevo (ver seed-m4-les1.mjs como referencia).

---

## Estilo de trabajo con el usuario

- **Honestidad > agradar**. Decir "no hagas esto" cuando toque.
- **Commits pequeños** con mensaje descriptivo + `Co-Authored-By: Claude Opus 4 (1M context) <noreply@anthropic.com>`.
- **No reescribir** ejercicios/UI que ya funcionan.
- **Tipar fuerte** (discriminated unions para blocks, tokens CSS vars para dark mode).
- **Primero el esqueleto, luego los detalles**. Enseñar estructura, esperar feedback antes de generar audio.

---

## Cómo añadir la sección Resumen a una lección YA existente

Si una lección ya existe y solo quieres añadirle el resumen:

1. Abre `src/lib/courseData.ts`
2. Encuentra el objeto `const mX_lesY: Lesson = { ... blocks: [...] }`
3. Añade al principio del array `blocks`:
```ts
{
  type: 'summary',
  title: '...',
  intro: '...',
  objectives: ['...', '...'],
  sections: [...],
  tip: '...',
},
```
4. Build + commit + push. Ya aparece la sección "📋 Resumen" al principio de esa lección. No hay que tocar nada en Supabase (el contenido del summary vive solo en código).

---

## Pendientes conocidos / roadmap

### Tier 1 — alto valor, bajo esfuerzo
- Terminar audio de M3 L2, L3, L4 con Marianne
- "Continúa donde lo dejaste" en home
- Open Graph + favicon ya aplicado
- Keyboard shortcuts (1/2/3/4 en multiple_choice)

### Tier 2
- Export PDF del Resumen (window.print con @media print CSS)
- Audio-podcast de cada clase (MP3 extraído del video)
- Diccionario `/diccionario` (SEO + canal de adquisición)

### Tier 3
- Speaking club (producto/ops)
- Empty state home para nuevos users
- Next/Image para el logo

---

Última actualización: commit `bb798f69` (M4 L1 + sección Resumen nueva).
