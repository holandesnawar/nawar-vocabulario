/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */

export type Article = 'de' | 'het' | null

export interface Word {
  id:         string
  dutch:      string
  spanish:    string
  article:    Article
  emoji:      string
  color:      string
  image?:     string
  audio?:     string
  example_nl: string
  example_es: string
  category:   string
  difficulty: 'A0' | 'A1'
}

export interface Woordenlijst {
  slug:        string
  title:       string
  subtitle:    string
  level:       string
  emoji:       string
  description: string
  words:       Word[]
}

export type ExerciseType =
  | 'word_to_translation'
  | 'translation_to_word'

export interface Exercise {
  type:          ExerciseType
  word:          Word
  options:       string[]
  correctAnswer: string
}

export interface WordProgress {
  wordId:       string
  timesCorrect: number
  timesWrong:   number
  lastSeen:     string
  mastered:     boolean
}

export interface SessionProgress {
  wordlistSlug: string
  startedAt:    string
  completedAt?: string
  score:        number
  total:        number
  wordProgress: WordProgress[]
}

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generateExercises(words: Word[]): Exercise[] {
  const exercises: Exercise[] = []
  const shuffled = shuffle(words)

  for (const word of shuffled) {
    const distractors = shuffle(words.filter(w => w.id !== word.id)).slice(0, 3)
    const type: ExerciseType =
      Math.random() > 0.5 ? 'word_to_translation' : 'translation_to_word'

    if (type === 'word_to_translation') {
      exercises.push({
        type,
        word,
        options: shuffle([word.spanish, ...distractors.map(d => d.spanish)]),
        correctAnswer: word.spanish,
      })
    } else {
      exercises.push({
        type,
        word,
        options: shuffle([
          (word.article ? `${word.article} ` : '') + word.dutch,
          ...distractors.map(d => (d.article ? `${d.article} ` : '') + d.dutch),
        ]),
        correctAnswer: (word.article ? `${word.article} ` : '') + word.dutch,
      })
    }
  }

  // Reinforcement round: re-test ~40% of the words
  const extra = shuffle(words).slice(0, Math.ceil(words.length * 0.4))
  for (const word of extra) {
    const distractors = shuffle(words.filter(w => w.id !== word.id)).slice(0, 3)
    exercises.push({
      type: 'word_to_translation',
      word,
      options: shuffle([word.spanish, ...distractors.map(d => d.spanish)]),
      correctAnswer: word.spanish,
    })
  }

  return exercises
}

/* ─────────────────────────────────────────────────────────────────────────────
   DATA — WOORDENLIJSTEN
───────────────────────────────────────────────────────────────────────────── */

export const WORDLISTS: Woordenlijst[] = [

  /* ── 1. In de stad ── */
  {
    slug:        'in-de-stad',
    title:       'In de stad',
    subtitle:    'La ciudad',
    level:       'A0–A1',
    emoji:       '🏙️',
    description: 'Las palabras esenciales para moverte por una ciudad neerlandesa: transporte, lugares y servicios.',
    words: [
      {
        id: 'straat', dutch: 'straat', spanish: 'la calle', article: 'de',
        emoji: '🛣️', color: '#1D0084',
        example_nl: 'Ik loop op de straat.',
        example_es: 'Camino por la calle.',
        category: 'ciudad', difficulty: 'A0',
      },
      {
        id: 'winkel', dutch: 'winkel', spanish: 'la tienda', article: 'de',
        emoji: '🏪', color: '#025dc7',
        example_nl: 'De winkel is gesloten.',
        example_es: 'La tienda está cerrada.',
        category: 'ciudad', difficulty: 'A0',
      },
      {
        id: 'fiets', dutch: 'fiets', spanish: 'la bicicleta', article: 'de',
        emoji: '🚲', color: '#0b4db5',
        example_nl: 'Mijn fiets is rood.',
        example_es: 'Mi bicicleta es roja.',
        category: 'transporte', difficulty: 'A0',
      },
      {
        id: 'trein', dutch: 'trein', spanish: 'el tren', article: 'de',
        emoji: '🚆', color: '#0a3d9e',
        example_nl: 'De trein vertrekt om tien uur.',
        example_es: 'El tren sale a las diez.',
        category: 'transporte', difficulty: 'A0',
      },
      {
        id: 'restaurant', dutch: 'restaurant', spanish: 'el restaurante', article: 'het',
        emoji: '🍽️', color: '#1440a0',
        example_nl: 'We eten in het restaurant.',
        example_es: 'Comemos en el restaurante.',
        category: 'ciudad', difficulty: 'A0',
      },
      {
        id: 'park', dutch: 'park', spanish: 'el parque', article: 'het',
        emoji: '🌳', color: '#0d5295',
        example_nl: 'Ik loop in het park.',
        example_es: 'Paseo por el parque.',
        category: 'ciudad', difficulty: 'A0',
      },
      {
        id: 'bus', dutch: 'bus', spanish: 'el autobús', article: 'de',
        emoji: '🚌', color: '#1D0084',
        example_nl: 'Ik neem de bus naar huis.',
        example_es: 'Tomo el autobús a casa.',
        category: 'transporte', difficulty: 'A0',
      },
      {
        id: 'museum', dutch: 'museum', spanish: 'el museo', article: 'het',
        emoji: '🏛️', color: '#025dc7',
        example_nl: 'Het museum is interessant.',
        example_es: 'El museo es interesante.',
        category: 'ciudad', difficulty: 'A1',
      },
      {
        id: 'markt', dutch: 'markt', spanish: 'el mercado', article: 'de',
        emoji: '🛍️', color: '#0b4db5',
        example_nl: 'Ik koop groenten op de markt.',
        example_es: 'Compro verduras en el mercado.',
        category: 'ciudad', difficulty: 'A1',
      },
      {
        id: 'ziekenhuis', dutch: 'ziekenhuis', spanish: 'el hospital', article: 'het',
        emoji: '🏥', color: '#0a3d9e',
        example_nl: 'Het ziekenhuis is dichtbij.',
        example_es: 'El hospital está cerca.',
        category: 'ciudad', difficulty: 'A1',
      },
    ],
  },

  /* ── 2. Het huis ── */
  {
    slug:        'het-huis',
    title:       'Het huis',
    subtitle:    'La casa',
    level:       'A0–A1',
    emoji:       '🏠',
    description: 'Vocabulario para describir tu casa: habitaciones, muebles y objetos cotidianos.',
    words: [
      {
        id: 'keuken', dutch: 'keuken', spanish: 'la cocina', article: 'de',
        emoji: '🍳', color: '#1440a0',
        example_nl: 'Ik kook in de keuken.',
        example_es: 'Cocino en la cocina.',
        category: 'casa', difficulty: 'A0',
      },
      {
        id: 'slaapkamer', dutch: 'slaapkamer', spanish: 'el dormitorio', article: 'de',
        emoji: '🛏️', color: '#0d5295',
        example_nl: 'Mijn slaapkamer is groot.',
        example_es: 'Mi dormitorio es grande.',
        category: 'casa', difficulty: 'A0',
      },
      {
        id: 'badkamer', dutch: 'badkamer', spanish: 'el cuarto de baño', article: 'de',
        emoji: '🚿', color: '#1D0084',
        example_nl: 'De badkamer is klein.',
        example_es: 'El cuarto de baño es pequeño.',
        category: 'casa', difficulty: 'A0',
      },
      {
        id: 'woonkamer', dutch: 'woonkamer', spanish: 'el salón', article: 'de',
        emoji: '🛋️', color: '#025dc7',
        example_nl: 'Wij zitten in de woonkamer.',
        example_es: 'Estamos sentados en el salón.',
        category: 'casa', difficulty: 'A0',
      },
      {
        id: 'raam', dutch: 'raam', spanish: 'la ventana', article: 'het',
        emoji: '🪟', color: '#0b4db5',
        example_nl: 'Ik open het raam.',
        example_es: 'Abro la ventana.',
        category: 'casa', difficulty: 'A0',
      },
      {
        id: 'deur', dutch: 'deur', spanish: 'la puerta', article: 'de',
        emoji: '🚪', color: '#0a3d9e',
        example_nl: 'Sluit de deur, alsjeblieft.',
        example_es: 'Cierra la puerta, por favor.',
        category: 'casa', difficulty: 'A0',
      },
      {
        id: 'tafel', dutch: 'tafel', spanish: 'la mesa', article: 'de',
        emoji: '🪑', color: '#1440a0',
        example_nl: 'Het eten staat op de tafel.',
        example_es: 'La comida está en la mesa.',
        category: 'casa', difficulty: 'A0',
      },
      {
        id: 'bed', dutch: 'bed', spanish: 'la cama', article: 'het',
        emoji: '😴', color: '#0d5295',
        example_nl: 'Ik slaap in mijn bed.',
        example_es: 'Duermo en mi cama.',
        category: 'casa', difficulty: 'A0',
      },
      {
        id: 'stoel', dutch: 'stoel', spanish: 'la silla', article: 'de',
        emoji: '🪑', color: '#1D0084',
        example_nl: 'Ga op de stoel zitten.',
        example_es: 'Siéntate en la silla.',
        category: 'casa', difficulty: 'A0',
      },
      {
        id: 'trap', dutch: 'trap', spanish: 'la escalera', article: 'de',
        emoji: '🪜', color: '#025dc7',
        example_nl: 'Ik loop de trap op.',
        example_es: 'Subo la escalera.',
        category: 'casa', difficulty: 'A1',
      },
    ],
  },

]

export function getWordlist(slug: string): Woordenlijst | undefined {
  return WORDLISTS.find(w => w.slug === slug)
}
