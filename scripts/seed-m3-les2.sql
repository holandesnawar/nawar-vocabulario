-- ============================================================
-- Módulo 3 — Lección 2: Grammatica | Ik wil… / Mag ik…?
--
-- Cómo ejecutar:
--   Pega este SQL en el editor SQL de Supabase y ejecuta.
--
-- Notas:
--   · El script crea la lección si no existe.
--   · audio_url = NULL en todos los registros — añadir manualmente después.
--   · Los ejercicios listen_and_choose usan TTS automáticamente sobre
--     el texto entre comillas del question_text.
--   · Rangos de sort_order:
--       vocabulario  1–18
--       frases       1–10
--       diálogo      líneas 1–13
--       ejercicios   100–199
-- ============================================================

DO $$
DECLARE
  v_module_id  BIGINT;
  v_lesson_id  BIGINT;
  v_dialogue_id BIGINT;
  v_item_id    BIGINT;
BEGIN

  -- ── Obtener el ID del módulo ─────────────────────────────────────────────────
  SELECT id INTO v_module_id FROM modules WHERE slug = 'boodschappen' LIMIT 1;
  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'Módulo "boodschappen" no encontrado. Verifica el slug.';
  END IF;

  -- ── Buscar lección por slug o por módulo+orden ──────────────────────────────
  SELECT id INTO v_lesson_id
  FROM lessons
  WHERE slug = 'm3-les-2-grammatica'
     OR (module_id = v_module_id AND sort_order = 2)
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    -- No existe: crear
    INSERT INTO lessons (module_id, slug, title_nl, title_es, sort_order, is_extra)
    VALUES (
      v_module_id,
      'm3-les-2-grammatica',
      'Les 2 — Grammatica | Ik wil… / Mag ik…?',
      'Pedir en un café o snackbar',
      2,
      false
    )
    RETURNING id INTO v_lesson_id;
    RAISE NOTICE 'Lección creada con ID: %', v_lesson_id;
  ELSE
    -- Ya existe: actualizar slug y títulos por si acaso
    UPDATE lessons SET
      slug       = 'm3-les-2-grammatica',
      title_nl   = 'Les 2 — Grammatica | Ik wil… / Mag ik…?',
      title_es   = 'Pedir en un café o snackbar',
      module_id  = v_module_id,
      sort_order = 2,
      is_extra   = false
    WHERE id = v_lesson_id;
    RAISE NOTICE 'Lección ya existente (ID: %). Actualizada.', v_lesson_id;
  END IF;

  -- ── Limpiar datos anteriores (idempotente) ───────────────────────────────────
  DELETE FROM match_pair_items
    WHERE practice_item_id IN (
      SELECT id FROM practice_items WHERE lesson_id = v_lesson_id
    );
  DELETE FROM practice_options
    WHERE practice_item_id IN (
      SELECT id FROM practice_items WHERE lesson_id = v_lesson_id
    );
  DELETE FROM practice_items  WHERE lesson_id = v_lesson_id;
  DELETE FROM phrases          WHERE lesson_id = v_lesson_id;
  DELETE FROM vocabulary_items WHERE lesson_id = v_lesson_id;
  DELETE FROM dialogue_lines
    WHERE dialogue_id IN (SELECT id FROM dialogues WHERE lesson_id = v_lesson_id);
  DELETE FROM dialogues WHERE lesson_id = v_lesson_id;

  -- ══════════════════════════════════════════════════════════════════════════════
  --  VOCABULARIO
  -- ══════════════════════════════════════════════════════════════════════════════

  -- ── Bebidas (1–5) ────────────────────────────────────────────────────────────
  INSERT INTO vocabulary_items (lesson_id, sort_order, article, word_nl, translation_es, audio_url) VALUES
    (v_lesson_id,  1, 'de',  'de koffie',  'el café',            NULL),
    (v_lesson_id,  2, 'de',  'de thee',    'el té',              NULL),
    (v_lesson_id,  3, 'de',  'de cola',    'la cola',            NULL),
    (v_lesson_id,  4, 'het', 'het water',  'el agua',            NULL),
    (v_lesson_id,  5, 'het', 'het sap',    'el zumo',            NULL);

  -- ── Comida (6–10) ────────────────────────────────────────────────────────────
  INSERT INTO vocabulary_items (lesson_id, sort_order, article, word_nl, translation_es, audio_url) VALUES
    (v_lesson_id,  6, 'het', 'het broodje',      'el bocadillo / panecillo',  NULL),
    (v_lesson_id,  7, 'het', 'het broodje kaas', 'el bocadillo de queso',     NULL),
    (v_lesson_id,  8, 'de',  'de soep',          'la sopa',                   NULL),
    (v_lesson_id,  9, 'de',  'de friet',         'las patatas fritas',        NULL),
    (v_lesson_id, 10, 'de',  'de salade',        'la ensalada',               NULL);

  -- ── Verbos clave (11–13) ─────────────────────────────────────────────────────
  INSERT INTO vocabulary_items (lesson_id, sort_order, article, word_nl, translation_es, audio_url) VALUES
    (v_lesson_id, 11, NULL, 'willen',  'querer',                   NULL),
    (v_lesson_id, 12, NULL, 'nemen',   'tomar / coger / pedir',    NULL),
    (v_lesson_id, 13, NULL, 'mogen',   'poder / tener permiso',    NULL),
    (v_lesson_id, 14, NULL, 'betalen', 'pagar',                    NULL),
    (v_lesson_id, 15, NULL, 'pinnen',  'pagar con tarjeta',        NULL);

  -- ── Palabras del café (16–18) ────────────────────────────────────────────────
  INSERT INTO vocabulary_items (lesson_id, sort_order, article, word_nl, translation_es, audio_url) VALUES
    (v_lesson_id, 16, 'de', 'de ober',     'el camarero',  NULL),
    (v_lesson_id, 17, 'de', 'de klant',    'el cliente',   NULL),
    (v_lesson_id, 18, 'de', 'de rekening', 'la cuenta',    NULL);

  -- ══════════════════════════════════════════════════════════════════════════════
  --  FRASES ÚTILES
  -- ══════════════════════════════════════════════════════════════════════════════
  INSERT INTO phrases (lesson_id, sort_order, phrase_nl, translation_es, audio_url) VALUES
    (v_lesson_id,  1, 'Ik wil graag een koffie.',         'Quiero un café.',                  NULL),
    (v_lesson_id,  2, 'Ik neem een broodje kaas.',        'Tomo un bocadillo de queso.',      NULL),
    (v_lesson_id,  3, 'Mag ik de rekening, alstublieft?', '¿Me trae la cuenta, por favor?',  NULL),
    (v_lesson_id,  4, 'Mag ik pinnen?',                   '¿Puedo pagar con tarjeta?',        NULL),
    (v_lesson_id,  5, 'Nog iets?',                        '¿Algo más?',                       NULL),
    (v_lesson_id,  6, 'Nee, dat is alles.',               'No, eso es todo.',                 NULL),
    (v_lesson_id,  7, 'Wil jij thee of koffie?',          '¿Quieres té o café?',              NULL),
    (v_lesson_id,  8, 'Mag ik hier zitten?',              '¿Puedo sentarme aquí?',            NULL),
    (v_lesson_id,  9, 'Wij willen graag soep en salade.', 'Queremos sopa y ensalada.',        NULL),
    (v_lesson_id, 10, 'Dank u wel.',                      'Gracias.',                         NULL);

  -- ══════════════════════════════════════════════════════════════════════════════
  --  DIÁLOGO PRINCIPAL — In een café
  -- ══════════════════════════════════════════════════════════════════════════════
  INSERT INTO dialogues (lesson_id, title, context, audio_url, slow_audio_url)
  VALUES (
    v_lesson_id,
    'Dialoog – In een café',
    'Een klant bestelt in een Nederlands café.',
    NULL,
    NULL
  )
  RETURNING id INTO v_dialogue_id;

  INSERT INTO dialogue_lines (dialogue_id, sort_order, speaker, text_nl, text_es, audio_url) VALUES
    (v_dialogue_id,  1, 'Medewerker', 'Goedemiddag.',                                          'Buenas tardes.',                                    NULL),
    (v_dialogue_id,  2, 'Klant',      'Goedemiddag.',                                          'Buenas tardes.',                                    NULL),
    (v_dialogue_id,  3, 'Medewerker', 'Wat wilt u drinken?',                                   '¿Qué quiere beber?',                                NULL),
    (v_dialogue_id,  4, 'Klant',      'Ik wil graag een koffie, alstublieft.',                  'Quiero un café, por favor.',                        NULL),
    (v_dialogue_id,  5, 'Medewerker', 'Nog iets?',                                             '¿Algo más?',                                        NULL),
    (v_dialogue_id,  6, 'Klant',      'Ja, ik neem ook een broodje kaas.',                      'Sí, también tomo un bocadillo de queso.',           NULL),
    (v_dialogue_id,  7, 'Medewerker', 'Natuurlijk. Wilt u hier zitten of meenemen?',           'Claro. ¿Quiere sentarse aquí o para llevar?',       NULL),
    (v_dialogue_id,  8, 'Klant',      'Hier, alstublieft.',                                    'Aquí, por favor.',                                  NULL),
    (v_dialogue_id,  9, 'Medewerker', 'Prima. Dat is €8,50.',                                  'Perfecto. Son 8,50 €.',                             NULL),
    (v_dialogue_id, 10, 'Klant',      'Mag ik pinnen?',                                        '¿Puedo pagar con tarjeta?',                         NULL),
    (v_dialogue_id, 11, 'Medewerker', 'Ja, natuurlijk.',                                       'Sí, claro.',                                        NULL),
    (v_dialogue_id, 12, 'Klant',      'Dank u wel.',                                           'Gracias.',                                          NULL),
    (v_dialogue_id, 13, 'Medewerker', 'Alstublieft.',                                          'Aquí tiene.',                                       NULL);

  -- ══════════════════════════════════════════════════════════════════════════════
  --  EJERCICIOS
  --
  --  Rangos de sort_order:
  --    100–107  → fill_blank: elige el verbo correcto (Ej. 1)
  --    110–115  → fill_blank: artículos y palabras (Ej. 2)
  --    120–125  → order_sentence: ordena la frase (Ej. 3)
  --    130–137  → fill_blank: corrige el error (Ej. 4)
  --    140      → match_pairs: empareja (Ej. 5)
  --    150–157  → multiple_choice: verdadero o falso (Ej. 6)
  --    160–167  → fill_blank: traducción ES→NL (Ej. 7)
  --    170–175  → fill_blank: traducción NL→ES (Ej. 8)
  --    180      → write_answer: mini producción (Ej. 9)
  --    190–192  → fill_blank: completa el diálogo (Ej. 10)
  -- ══════════════════════════════════════════════════════════════════════════════

  -- ── EJ. 1 — Kies het juiste werkwoord (fill_blank) ───────────────────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 100, 'fill_blank',
    'Ik ___ graag koffie. (willen — ik)',
    'wil',
    '"Willen" → ik wil',
    '"Willen" es irregular: ik wil (sin -len). Ejemplo: Ik wil graag koffie.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 101, 'fill_blank',
    'Hij ___ een broodje kaas. (nemen — hij)',
    'neemt',
    '"Nemen" → hij neemt',
    '"Nemen" → ik neem, jij neemt, hij neemt, wij nemen.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 102, 'fill_blank',
    '___ ik de rekening? (mogen — ik)',
    'Mag',
    '"Mogen" → ik mag',
    '"Mag ik…?" es la forma educada de pedir algo. "Mogen" → ik mag, jij mag, hij mag.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 103, 'fill_blank',
    'Mag ik hier ___? (zitten)',
    'zitten',
    'El infinitivo viene después de "mag ik"',
    'Después de un verbo modal (mag, wil, kan) el segundo verbo va en infinitivo: Mag ik hier zitten?',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 104, 'fill_blank',
    'Zij ___ thee en water. (nemen — zij pl.)',
    'nemen',
    '"Nemen" → zij (plural) nemen',
    '"Nemen" → wij nemen, jullie nemen, zij nemen (plural = infinitivo).',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 105, 'fill_blank',
    'Wij ___ graag binnen zitten. (willen — wij)',
    'willen',
    '"Willen" → wij willen',
    '"Willen" → wij willen, jullie willen, zij willen.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 106, 'fill_blank',
    '___ jij cola? (willen — jij, pregunta)',
    'Wil',
    'En preguntas, el verbo va primero. "Willen" → jij wil',
    'En preguntas, el verbo se coloca antes del sujeto: Wil jij…? (la -len desaparece en ik/jij/hij).',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 107, 'fill_blank',
    '___ jij soep? → pregunta con jij (nemen)',
    'Neem',
    'La -t desaparece en preguntas con jij: "Neemt jij" → "Neem jij"',
    'Regla: cuando el sujeto "jij" sigue al verbo en una pregunta, la -t desaparece. Neem jij soep?',
    NULL)
  RETURNING id INTO v_item_id;

  -- ── EJ. 2 — Maak de zin compleet (fill_blank: artículos y palabras) ─────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 110, 'fill_blank',
    'Ik wil graag ___ koffie. (artículo correcto)',
    'een',
    'Se trata de uno / una → onbepaald lidwoord',
    '"Een" es el artículo indefinido en neerlandés, igual para de-woorden y het-woorden.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 111, 'fill_blank',
    'Mag ik ___ rekening, alstublieft? (artículo determinado)',
    'de',
    '"Rekening" es un de-woord',
    '"De rekening" — la cuenta. "De" es el artículo determinado para de-woorden.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 112, 'fill_blank',
    'Wij nemen ___ soep. (artículo indefinido)',
    'een',
    'Soep es un de-woord, pero aquí no es definido',
    '"Een soep" = una sopa. Se usa "een" cuando no es un referente específico.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 113, 'fill_blank',
    'Hij neemt ___ broodje kaas. (artículo indefinido)',
    'een',
    '"Broodje kaas" es het-woord',
    '"Een broodje kaas" — un bocadillo de queso. Het broodje → een broodje.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 114, 'fill_blank',
    'Wil jij ___ thee? (artículo indefinido)',
    'een',
    '"Een" para cualquier artículo indefinido',
    '"Een thee" = un té. En neerlandés no distinguimos género en el artículo indefinido.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 115, 'fill_blank',
    'Mag ik ___ pinnen? (adverbio de lugar)',
    'hier',
    '"Aquí" en neerlandés',
    '"Hier" = aquí. Mag ik hier pinnen? = ¿Puedo pagar con tarjeta aquí?',
    NULL)
  RETURNING id INTO v_item_id;

  -- ── EJ. 3 — Zet de woorden in de goede volgorde (order_sentence) ────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 120, 'order_sentence',
    'Ordena: "Quiero café por favor" → graag / ik / koffie / wil',
    'Ik wil graag koffie.',
    'El verbo va en segunda posición; "graag" justo después del verbo',
    'Orden: sujeto + verbo + graag + complemento. Ik wil graag koffie.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'graag', false),
    (v_item_id, 2, 'ik',    false),
    (v_item_id, 3, 'koffie',false),
    (v_item_id, 4, 'wil',   false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 121, 'order_sentence',
    'Ordena: "¿Me trae la cuenta?" → de rekening / mag / ik',
    'Mag ik de rekening?',
    'Las preguntas empiezan con el verbo modal',
    'Orden en preguntas con "mag": verbo + sujeto + complemento. Mag ik de rekening?',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'de rekening', false),
    (v_item_id, 2, 'mag',         false),
    (v_item_id, 3, 'ik',          false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 122, 'order_sentence',
    'Ordena: "Él toma una cola" → neemt / hij / een cola',
    'Hij neemt een cola.',
    'Sujeto + verbo + complemento',
    'Orden normal: sujeto + verbo + complemento. Hij neemt een cola.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'neemt',   false),
    (v_item_id, 2, 'hij',     false),
    (v_item_id, 3, 'een cola',false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 123, 'order_sentence',
    'Ordena: "¿Quieres té?" → jij / wil / thee',
    'Wil jij thee?',
    'Las preguntas empiezan con el verbo',
    'En preguntas: verbo + jij. Wil jij thee? (no hay -t porque jij sigue al verbo).',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'jij',  false),
    (v_item_id, 2, 'wil',  false),
    (v_item_id, 3, 'thee', false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 124, 'order_sentence',
    'Ordena: "Pedimos patatas fritas y ensalada" → nemen / wij / friet en salade',
    'Wij nemen friet en salade.',
    'Sujeto + verbo + complemento',
    'Orden normal: wij + nemen + complemento. Wij nemen friet en salade.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'nemen',          false),
    (v_item_id, 2, 'wij',            false),
    (v_item_id, 3, 'friet en salade',false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 125, 'order_sentence',
    'Ordena: "¿Podemos sentarnos aquí?" → mogen / wij / hier / zitten',
    'Mogen wij hier zitten?',
    'Modal + sujeto + adverbio + infinitivo',
    'Orden: modal (mogen) + sujeto (wij) + adverbio (hier) + infinitivo (zitten). Mogen wij hier zitten?',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'mogen',  false),
    (v_item_id, 2, 'wij',    false),
    (v_item_id, 3, 'hier',   false),
    (v_item_id, 4, 'zitten', false);

  -- ── EJ. 4 — Verbeter de zinnen (fill_blank: corrige el error) ───────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 130, 'fill_blank',
    'Error: "Ik willen graag koffie." → ¿cuál es la forma correcta de willen con ik?',
    'wil',
    '"Willen" para ik es solo "wil"',
    'Correcto: Ik wil graag koffie. El verbo "willen" con "ik" no lleva -len al final.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 131, 'fill_blank',
    'Error: "Jij wil een thee?" → ¿cómo corriges el orden en una pregunta?',
    'Wil jij een thee?',
    'En preguntas el verbo va primero',
    'Correcto: Wil jij een thee? En neerlandés las preguntas invierten el orden: verbo + sujeto.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 132, 'fill_blank',
    'Error: "Ik wil nemen een broodje kaas." → ¿cuál es la forma más natural (una sola estructura)?',
    'Ik neem een broodje kaas.',
    'Elige: "Ik wil graag…" o "Ik neem…", no mezcles',
    'Correcto: Ik neem een broodje kaas. O también: Ik wil graag een broodje kaas. No se combinan los dos verbos.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 133, 'fill_blank',
    'Error: "Hij neem soep." → ¿cuál es la forma correcta de nemen con hij?',
    'neemt',
    '"Nemen" → hij neemt (raíz + -t)',
    'Correcto: Hij neemt soep. Para hij/zij/het se añade -t a la raíz: neem + t = neemt.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 134, 'fill_blank',
    'Error: "Neemt jij friet?" → ¿cuál es la forma correcta cuando jij sigue al verbo?',
    'Neem jij friet?',
    'La -t desaparece cuando jij sigue al verbo',
    'Correcto: Neem jij friet? La -t de "neemt" desaparece en preguntas con "jij": neemt → neem.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 135, 'fill_blank',
    'Error: "Ik wil koffie graag." → ¿dónde va "graag"?',
    'Ik wil graag koffie.',
    '"Graag" siempre va justo después del verbo',
    'Correcto: Ik wil graag koffie. "Graag" siempre sigue inmediatamente al verbo modal.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 136, 'fill_blank',
    'Error: "Wij wil salade." → ¿cuál es la forma correcta de willen con wij?',
    'willen',
    '"Willen" → wij willen',
    'Correcto: Wij willen salade. Para wij/jullie/zij se usa la forma completa "willen".',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 137, 'fill_blank',
    'Error: "Ik kan pinnen?" → ¿cuál es la forma correcta para pedir permiso educadamente?',
    'Mag ik pinnen?',
    'Para pedir permiso se usa "mogen", no "kunnen"',
    'Correcto: Mag ik pinnen? "Mogen" = poder / tener permiso. "Kunnen" = ser capaz de.',
    NULL)
  RETURNING id INTO v_item_id;

  -- ── EJ. 5 — Koppel de zinnen (match_pairs) ───────────────────────────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 140, 'match_pairs',
    'Une cada frase o expresión con su respuesta o continuación natural',
    '',
    NULL,
    NULL,
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO match_pair_items (practice_item_id, sort_order, left_text, right_text) VALUES
    (v_item_id, 1, 'Ik wil graag…',  '…een koffie.'),
    (v_item_id, 2, 'Mag ik…',        '…de rekening?'),
    (v_item_id, 3, 'Ik neem…',       '…een cola.'),
    (v_item_id, 4, 'Nog iets?',      'Nee, dat is alles.'),
    (v_item_id, 5, 'Dank u wel.',    'Graag gedaan.'),
    (v_item_id, 6, 'Mag ik hier…',   '…zitten?');

  -- ── EJ. 6 — Waar of niet waar? (multiple_choice: verdadero/falso) ───────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 150, 'multiple_choice',
    '¿Es correcto? "Mag ik…?" es una forma educada de pedir algo.',
    'Verdadero',
    'Piensa en el significado de "mogen"',
    'Verdadero. "Mag ik…?" = ¿Puedo…? / ¿Me da…? Es la forma más educada de pedir.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', true),
    (v_item_id, 2, 'Falso',     false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 151, 'multiple_choice',
    '¿Es correcto? "Ik neem…" se usa cuando ya has elegido lo que quieres.',
    'Verdadero',
    'Piensa en la diferencia entre "querer" y "elegir"',
    'Verdadero. "Nemen" = tomar / pedir. Se usa cuando ya has decidido: Ik neem een cola.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', true),
    (v_item_id, 2, 'Falso',     false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 152, 'multiple_choice',
    '¿Es correcto? "Ik wil graag…" suena más natural que "Ik wil…".',
    'Verdadero',
    'Piensa en el papel de "graag"',
    'Verdadero. "Graag" suaviza la frase y la hace más amable y natural.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', true),
    (v_item_id, 2, 'Falso',     false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 153, 'multiple_choice',
    '¿Es correcto? En preguntas con jij, siempre mantenemos la -t.',
    'Falso',
    'Recuerda la regla de la -t en preguntas',
    'Falso. La -t desaparece cuando jij sigue al verbo: Neemt jij → Neem jij.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', false),
    (v_item_id, 2, 'Falso',     true);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 154, 'multiple_choice',
    '¿Es correcto? "Nog iets?" significa "¿algo más?".',
    'Verdadero',
    'Esta expresión la usa el camarero',
    'Verdadero. "Nog iets?" = ¿Algo más? Es una expresión muy frecuente en cafés y tiendas.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', true),
    (v_item_id, 2, 'Falso',     false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 155, 'multiple_choice',
    '¿Es correcto? "De rekening" significa "la cuenta".',
    'Verdadero',
    'Recuerda el vocabulario de pagar',
    'Verdadero. "De rekening" = la cuenta. Mag ik de rekening? = ¿Me trae la cuenta?',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', true),
    (v_item_id, 2, 'Falso',     false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 156, 'multiple_choice',
    '¿Es correcto? "Ik wil koffie graag" es el orden más natural.',
    'Falso',
    'Recuerda dónde va "graag"',
    'Falso. El orden correcto es: Ik wil graag koffie. "Graag" va siempre justo después del verbo.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', false),
    (v_item_id, 2, 'Falso',     true);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 157, 'multiple_choice',
    '¿Es correcto? "Mag ik pinnen?" significa "¿Puedo pagar con tarjeta?".',
    'Verdadero',
    'Piensa en el significado de "pinnen"',
    'Verdadero. "Pinnen" = pagar con tarjeta (PIN). "Mag ik pinnen?" es la forma estándar de preguntarlo.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', true),
    (v_item_id, 2, 'Falso',     false);

  -- ── EJ. 7 — Vertaal naar het Nederlands (fill_blank: ES→NL) ─────────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 160, 'fill_blank',
    'Traduce: "Quiero un café, por favor." → Ik wil graag een koffie, ___.',
    'alstublieft.',
    '"Por favor" (formal) en neerlandés',
    '"Alstublieft" es la forma formal de "por favor". Informal: "alsjeblieft".',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 161, 'fill_blank',
    'Traduce: "Tomo un bocadillo de queso." → Ik ___ een broodje kaas.',
    'neem',
    '"Nemen" → ik neem',
    '"Ik neem" = tomo / elijo. "Nemen" → ik neem (raíz irregular).',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 162, 'fill_blank',
    'Traduce: "¿Puedo pagar con tarjeta?" → Mag ik ___?',
    'pinnen',
    '"Pagar con tarjeta" en neerlandés es un solo verbo',
    '"Pinnen" = pagar con tarjeta. Mag ik pinnen? es la forma estándar.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 163, 'fill_blank',
    'Traduce: "¿Puedo sentarme aquí?" → Mag ik ___ zitten?',
    'hier',
    '"Aquí" en neerlandés',
    '"Hier" = aquí. Mag ik hier zitten? = ¿Puedo sentarme aquí?',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 164, 'fill_blank',
    'Traduce: "¿Algo más?" (expresión de una sola frase)',
    'Nog iets?',
    'Expresión de una sola frase muy frecuente',
    '"Nog iets?" = ¿Algo más? Expresión muy usada en cafés, tiendas y restaurantes.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 165, 'fill_blank',
    'Traduce: "No, eso es todo." (expresión de una sola frase)',
    'Nee, dat is alles.',
    'Respuesta frecuente a "Nog iets?"',
    '"Nee, dat is alles." = No, eso es todo. Es la respuesta estándar a "Nog iets?".',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 166, 'fill_blank',
    'Traduce: "Queremos sopa." → Wij ___ soep.',
    'willen',
    '"Willen" → wij willen',
    '"Willen" → wij willen. También es correcto: Wij nemen soep (si ya han decidido).',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 167, 'fill_blank',
    'Traduce: "¿Quieres té?" → ___ jij thee?',
    'Wil',
    'En preguntas el verbo va primero',
    '"Wil jij thee?" = ¿Quieres té? Orden: verbo + jij. La forma es "wil" (no "wilt") porque jij sigue al verbo.',
    NULL)
  RETURNING id INTO v_item_id;

  -- ── EJ. 8 — Vertaal naar het Spaans (fill_blank: NL→ES) ─────────────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 170, 'fill_blank',
    'Traduce: "Ik wil graag thee."',
    'Quiero té.',
    '"Wil graag" expresa deseo educado',
    '"Ik wil graag thee" = Quiero té. "Graag" suaviza la frase en neerlandés.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 171, 'fill_blank',
    'Traduce: "Mag ik de rekening?"',
    '¿Me trae la cuenta?',
    '"Rekening" = cuenta',
    '"Mag ik de rekening?" = ¿Me trae la cuenta? / ¿Puedo pedir la cuenta?',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 172, 'fill_blank',
    'Traduce: "Hij neemt friet."',
    'Él pide / toma patatas fritas.',
    '"Friet" = patatas fritas',
    '"Hij neemt friet" = Él pide / toma patatas fritas. "Nemen" en contexto de pedido = pedir.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 173, 'fill_blank',
    'Traduce: "Wij willen koffie."',
    'Queremos café.',
    '"Willen" = querer',
    '"Wij willen koffie" = Queremos café. "Willen" en plural = willen.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 174, 'fill_blank',
    'Traduce: "Dank u wel."',
    'Gracias.',
    'Expresión de agradecimiento formal',
    '"Dank u wel" = Gracias (formal). Informal: "dank je wel".',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 175, 'fill_blank',
    'Traduce: "Mag ik hier zitten?"',
    '¿Puedo sentarme aquí?',
    '"Zitten" = estar sentado / sentarse',
    '"Mag ik hier zitten?" = ¿Puedo sentarme aquí? "Zitten" = sentarse / estar sentado.',
    NULL)
  RETURNING id INTO v_item_id;

  -- ── EJ. 9 — Mini producción (write_answer: escribe tus propias frases) ───────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 180, 'write_answer',
    'Escribe 6 frases propias: (1) con "Ik wil graag…", (2) con "Ik neem…", (3) con "Mag ik…?", (4) pregunta con "Wil jij…?", (5) usa "Nog iets?", (6) usa "Nee, dat is alles."',
    'Ik wil graag een thee. | Ik neem een soep. | Mag ik de rekening? | Wil jij koffie? | Nog iets? | Nee, dat is alles.',
    'Puedes usar el vocabulario de la lección: koffie, thee, cola, water, broodje, soep, friet, salade…',
    'Ejemplos modelo: Ik wil graag een thee. / Ik neem een soep. / Mag ik de rekening? / Wil jij koffie? / Nog iets? / Nee, dat is alles.',
    NULL)
  RETURNING id INTO v_item_id;

  -- ── EJ. 10 — Maak de dialoog af (fill_blank: completa el diálogo) ────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 190, 'fill_blank',
    'Completa el diálogo. Medewerker: "Goedemiddag. Wat wilt u?" → Klant: "___" (pide un café)',
    'Ik wil graag een koffie.',
    'Usa "Ik wil graag…"',
    'Respuesta modelo: Ik wil graag een koffie. También válido: Ik neem een koffie.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 191, 'fill_blank',
    'Completa el diálogo. Medewerker: "Nog iets?" → Klant: "___" (pide también un bocadillo)',
    'Ja, ik neem ook een broodje.',
    'Usa "Ik neem ook…"',
    'Respuesta modelo: Ja, ik neem ook een broodje. "Ook" = también.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 192, 'fill_blank',
    'Completa el diálogo. Medewerker: "Dat is €6." → Klant: "___" (pregunta si puede pagar con tarjeta)',
    'Mag ik pinnen?',
    'Usa "Mag ik…?"',
    'Respuesta modelo: Mag ik pinnen? Es la forma estándar de preguntar si puedes pagar con tarjeta.',
    NULL)
  RETURNING id INTO v_item_id;

  RAISE NOTICE '✓ Lección m3-les-2-grammatica cargada correctamente.';
  RAISE NOTICE '  · Vocabulario: 18 palabras';
  RAISE NOTICE '  · Frases: 10';
  RAISE NOTICE '  · Diálogo: 13 líneas';
  RAISE NOTICE '  · Ejercicios: 10 secciones, ~45 practice_items en total';

END $$;
