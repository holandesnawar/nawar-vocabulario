-- ============================================================
-- Módulo 3 — Lección 3: Grammatica | Vragende woorden
--
-- Cómo ejecutar:
--   Pega este SQL en el editor SQL de Supabase y ejecuta.
--
-- Notas:
--   · El script crea la lección si no existe (idempotente).
--   · audio_url = NULL en todos los registros — añadir manualmente después.
--   · Estructura de la lección:
--       vocabulario      1–17
--       frases           1–10
--       lezen text       1 texto + 8 preguntas de comprensión
--       diálogo          líneas 1–12
--       ejercicios       100–173
--   · Rangos de ejercicios:
--       100–106  fill_blank:      kies het vragende woord
--       110–114  order_sentence:  maak een vraag
--       120–127  multiple_choice: waar of niet waar?
--       130      match_pairs:     koppel vraagwoord aan betekenis
--       140–144  fill_blank:      negatie met "geen"
--       150–155  fill_blank:      verbeter de zinnen
--       160–165  fill_blank:      vertaal naar het Nederlands
--       170–173  fill_blank:      completa el diálogo
-- ============================================================

DO $$
DECLARE
  v_module_id       BIGINT;
  v_lesson_id       BIGINT;
  v_dialogue_id     BIGINT;
  v_lezen_text_id   BIGINT;
  v_lezen_ex_id     BIGINT;
  v_item_id         BIGINT;
BEGIN

  -- ── Obtener el ID del módulo ─────────────────────────────────────────────────
  SELECT id INTO v_module_id FROM modules WHERE slug = 'boodschappen' LIMIT 1;
  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'Módulo "boodschappen" no encontrado. Verifica el slug.';
  END IF;

  -- ── Buscar lección por slug o por módulo+orden ──────────────────────────────
  SELECT id INTO v_lesson_id
  FROM lessons
  WHERE slug = 'm3-les-3-grammatica'
     OR (module_id = v_module_id AND sort_order = 3 AND is_extra = false)
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    INSERT INTO lessons (module_id, slug, title_nl, title_es, sort_order, is_extra)
    VALUES (
      v_module_id,
      'm3-les-3-grammatica',
      'Les 3 — Grammatica | Vragende woorden',
      'Hacer preguntas en neerlandés',
      3,
      false
    )
    RETURNING id INTO v_lesson_id;
    RAISE NOTICE 'Lección creada con ID: %', v_lesson_id;
  ELSE
    UPDATE lessons SET
      slug       = 'm3-les-3-grammatica',
      title_nl   = 'Les 3 — Grammatica | Vragende woorden',
      title_es   = 'Hacer preguntas en neerlandés',
      module_id  = v_module_id,
      sort_order = 3,
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
  DELETE FROM lezen_exercise_options
    WHERE lezen_exercise_id IN (
      SELECT e.id FROM lezen_exercises e
      JOIN lezen_texts t ON t.id = e.lezen_text_id
      WHERE t.lesson_id = v_lesson_id
    );
  DELETE FROM lezen_exercises
    WHERE lezen_text_id IN (SELECT id FROM lezen_texts WHERE lesson_id = v_lesson_id);
  DELETE FROM lezen_texts WHERE lesson_id = v_lesson_id;

  -- ══════════════════════════════════════════════════════════════════════════════
  --  VOCABULARIO
  -- ══════════════════════════════════════════════════════════════════════════════

  -- ── Palabras interrogativas (1–5) ────────────────────────────────────────────
  INSERT INTO vocabulary_items (lesson_id, sort_order, article, word_nl, translation_es, audio_url) VALUES
    (v_lesson_id,  1, NULL, 'wat',      'qué',                   NULL),
    (v_lesson_id,  2, NULL, 'waar',     'dónde',                 NULL),
    (v_lesson_id,  3, NULL, 'wanneer',  'cuándo',                NULL),
    (v_lesson_id,  4, NULL, 'wie',      'quién',                 NULL),
    (v_lesson_id,  5, NULL, 'hoeveel',  'cuánto / cuánta / cuántos', NULL);

  -- ── Comida y bebida (6–12) ───────────────────────────────────────────────────
  INSERT INTO vocabulary_items (lesson_id, sort_order, article, word_nl, translation_es, audio_url) VALUES
    (v_lesson_id,  6, 'de',  'de koffie',  'el café',        NULL),
    (v_lesson_id,  7, 'de',  'de thee',    'el té',          NULL),
    (v_lesson_id,  8, 'het', 'het water',  'el agua',        NULL),
    (v_lesson_id,  9, 'het', 'het broodje','el bocadillo',   NULL),
    (v_lesson_id, 10, 'de',  'de suiker',  'el azúcar',      NULL),
    (v_lesson_id, 11, 'het', 'het vlees',  'la carne',       NULL),
    (v_lesson_id, 12, 'de',  'de vis',     'el pescado',     NULL);

  -- ── Verbos útiles (13–16) ────────────────────────────────────────────────────
  INSERT INTO vocabulary_items (lesson_id, sort_order, article, word_nl, translation_es, audio_url) VALUES
    (v_lesson_id, 13, NULL, 'drinken', 'beber',   NULL),
    (v_lesson_id, 14, NULL, 'eten',    'comer',   NULL),
    (v_lesson_id, 15, NULL, 'willen',  'querer',  NULL),
    (v_lesson_id, 16, NULL, 'komen',   'venir',   NULL);

  -- ── Palabra clave de negación (17) ──────────────────────────────────────────
  INSERT INTO vocabulary_items (lesson_id, sort_order, article, word_nl, translation_es, audio_url) VALUES
    (v_lesson_id, 17, NULL, 'geen', 'no / ningún / ninguna', NULL);

  -- ══════════════════════════════════════════════════════════════════════════════
  --  FRASES ÚTILES
  -- ══════════════════════════════════════════════════════════════════════════════
  INSERT INTO phrases (lesson_id, sort_order, phrase_nl, translation_es, audio_url) VALUES
    (v_lesson_id,  1, 'Drink je koffie?',           '¿Bebes café?',                NULL),
    (v_lesson_id,  2, 'Wil je thee?',               '¿Quieres té?',                NULL),
    (v_lesson_id,  3, 'Wat drink je?',              '¿Qué bebes?',                 NULL),
    (v_lesson_id,  4, 'Waar eet je?',               '¿Dónde comes?',               NULL),
    (v_lesson_id,  5, 'Wanneer eten we?',            '¿Cuándo comemos?',            NULL),
    (v_lesson_id,  6, 'Wie komt er?',               '¿Quién viene?',               NULL),
    (v_lesson_id,  7, 'Hoeveel suiker wil je?',     '¿Cuánta azúcar quieres?',     NULL),
    (v_lesson_id,  8, 'Nee, ik drink geen koffie.', 'No, no bebo café.',           NULL),
    (v_lesson_id,  9, 'Ja, ik wil thee.',           'Sí, quiero té.',              NULL),
    (v_lesson_id, 10, 'Ik eet geen vlees.',         'No como carne.',              NULL);

  -- ══════════════════════════════════════════════════════════════════════════════
  --  LEZEN — Tekst + Begripsvaagen
  -- ══════════════════════════════════════════════════════════════════════════════

  INSERT INTO lezen_texts (lesson_id, sort_order, text_nl, text_es)
  VALUES (
    v_lesson_id,
    1,
    E'Ana en Tom zitten in een café. Het is gezellig.\n\nAna drinkt koffie en Tom drinkt thee. Ze eten ook iets. Tom eet een broodje kaas. Ana eet geen broodje – ze neemt een salade.\n\nDe ober vraagt: "Hoeveel suiker wilt u?" Ana wil twee suiker in haar koffie. Tom wil geen suiker.\n\nLater stuurt Sam een bericht: "Wie is er in het café? En wanneer eten jullie vanavond? Ik wil ook komen!" Tom antwoordt: "Wij eten om zeven uur thuis. Kom je ook?"',
    E'Ana y Tom están sentados en un café. Es muy agradable.\n\nAna bebe café y Tom bebe té. También comen algo. Tom come un bocadillo de queso. Ana no come bocadillo — toma una ensalada.\n\nEl camarero pregunta: "¿Cuánta azúcar quiere?" Ana quiere dos azúcares en su café. Tom no quiere azúcar.\n\nMás tarde Sam envía un mensaje: "¿Quién está en el café? ¿Y cuándo coméis esta noche? ¡Yo también quiero venir!" Tom responde: "Comemos a las siete en casa. ¿Vienes también?"'
  )
  RETURNING id INTO v_lezen_text_id;

  -- ── Pregunta 1: Wat drinkt Ana? ──────────────────────────────────────────────
  INSERT INTO lezen_exercises (lezen_text_id, sort_order, type, prompt, correct_answer, hint, explanation)
  VALUES (v_lezen_text_id, 1, 'multiple_choice', 'Wat drinkt Ana?', 'koffie', NULL,
    'Ana drinkt koffie. Tom drinkt thee.')
  RETURNING id INTO v_lezen_ex_id;
  INSERT INTO lezen_exercise_options (lezen_exercise_id, sort_order, option_text) VALUES
    (v_lezen_ex_id, 1, 'koffie'),
    (v_lezen_ex_id, 2, 'thee'),
    (v_lezen_ex_id, 3, 'water');

  -- ── Pregunta 2: Wat drinkt Tom? ──────────────────────────────────────────────
  INSERT INTO lezen_exercises (lezen_text_id, sort_order, type, prompt, correct_answer, hint, explanation)
  VALUES (v_lezen_text_id, 2, 'multiple_choice', 'Wat drinkt Tom?', 'thee', NULL,
    'Tom drinkt thee. Ana drinkt koffie.')
  RETURNING id INTO v_lezen_ex_id;
  INSERT INTO lezen_exercise_options (lezen_exercise_id, sort_order, option_text) VALUES
    (v_lezen_ex_id, 1, 'koffie'),
    (v_lezen_ex_id, 2, 'thee'),
    (v_lezen_ex_id, 3, 'sap');

  -- ── Pregunta 3: Eet Ana een broodje? ─────────────────────────────────────────
  INSERT INTO lezen_exercises (lezen_text_id, sort_order, type, prompt, correct_answer, hint, explanation)
  VALUES (v_lezen_text_id, 3, 'multiple_choice', 'Eet Ana een broodje?', 'Nee', NULL,
    'Ana eet geen broodje — ze neemt een salade.')
  RETURNING id INTO v_lezen_ex_id;
  INSERT INTO lezen_exercise_options (lezen_exercise_id, sort_order, option_text) VALUES
    (v_lezen_ex_id, 1, 'Ja'),
    (v_lezen_ex_id, 2, 'Nee');

  -- ── Pregunta 4: Wat eet Tom? ──────────────────────────────────────────────────
  INSERT INTO lezen_exercises (lezen_text_id, sort_order, type, prompt, correct_answer, hint, explanation)
  VALUES (v_lezen_text_id, 4, 'multiple_choice', 'Wat eet Tom?', 'een broodje kaas', NULL,
    'Tom eet een broodje kaas.')
  RETURNING id INTO v_lezen_ex_id;
  INSERT INTO lezen_exercise_options (lezen_exercise_id, sort_order, option_text) VALUES
    (v_lezen_ex_id, 1, 'een salade'),
    (v_lezen_ex_id, 2, 'een broodje kaas'),
    (v_lezen_ex_id, 3, 'soep');

  -- ── Pregunta 5: Hoeveel suiker wil Ana? ──────────────────────────────────────
  INSERT INTO lezen_exercises (lezen_text_id, sort_order, type, prompt, correct_answer, hint, explanation)
  VALUES (v_lezen_text_id, 5, 'multiple_choice', 'Hoeveel suiker wil Ana?', 'twee suiker', NULL,
    'Ana wil twee suiker in haar koffie.')
  RETURNING id INTO v_lezen_ex_id;
  INSERT INTO lezen_exercise_options (lezen_exercise_id, sort_order, option_text) VALUES
    (v_lezen_ex_id, 1, 'één suiker'),
    (v_lezen_ex_id, 2, 'twee suiker'),
    (v_lezen_ex_id, 3, 'geen suiker');

  -- ── Pregunta 6: Wil Tom suiker? ──────────────────────────────────────────────
  INSERT INTO lezen_exercises (lezen_text_id, sort_order, type, prompt, correct_answer, hint, explanation)
  VALUES (v_lezen_text_id, 6, 'multiple_choice', 'Wil Tom suiker?', 'Nee', NULL,
    'Tom wil geen suiker.')
  RETURNING id INTO v_lezen_ex_id;
  INSERT INTO lezen_exercise_options (lezen_exercise_id, sort_order, option_text) VALUES
    (v_lezen_ex_id, 1, 'Ja'),
    (v_lezen_ex_id, 2, 'Nee');

  -- ── Pregunta 7: Wie stuurt een bericht? ──────────────────────────────────────
  INSERT INTO lezen_exercises (lezen_text_id, sort_order, type, prompt, correct_answer, hint, explanation)
  VALUES (v_lezen_text_id, 7, 'multiple_choice', 'Wie stuurt een bericht?', 'Sam', NULL,
    'Sam stuurt een bericht aan Tom.')
  RETURNING id INTO v_lezen_ex_id;
  INSERT INTO lezen_exercise_options (lezen_exercise_id, sort_order, option_text) VALUES
    (v_lezen_ex_id, 1, 'Ana'),
    (v_lezen_ex_id, 2, 'Tom'),
    (v_lezen_ex_id, 3, 'Sam');

  -- ── Pregunta 8: Wanneer eten ze vanavond? ────────────────────────────────────
  INSERT INTO lezen_exercises (lezen_text_id, sort_order, type, prompt, correct_answer, hint, explanation)
  VALUES (v_lezen_text_id, 8, 'multiple_choice', 'Wanneer eten ze vanavond?', 'om zeven uur', NULL,
    'Tom antwoordt: "Wij eten om zeven uur thuis."')
  RETURNING id INTO v_lezen_ex_id;
  INSERT INTO lezen_exercise_options (lezen_exercise_id, sort_order, option_text) VALUES
    (v_lezen_ex_id, 1, 'om zes uur'),
    (v_lezen_ex_id, 2, 'om zeven uur'),
    (v_lezen_ex_id, 3, 'om acht uur');

  -- ══════════════════════════════════════════════════════════════════════════════
  --  DIÁLOGO PRINCIPAL — In een café
  -- ══════════════════════════════════════════════════════════════════════════════
  INSERT INTO dialogues (lesson_id, title, context, audio_url, slow_audio_url)
  VALUES (
    v_lesson_id,
    'Dialoog – In een café',
    'Een klant bestelt in een Nederlands café en gebruikt vragende woorden.',
    NULL,
    NULL
  )
  RETURNING id INTO v_dialogue_id;

  INSERT INTO dialogue_lines (dialogue_id, sort_order, speaker, text_nl, text_es, audio_url) VALUES
    (v_dialogue_id,  1, 'Ober',  'Goedemiddag! Wat wilt u drinken?',              'Buenas tardes. ¿Qué quiere beber?',         NULL),
    (v_dialogue_id,  2, 'Klant', 'Ik wil graag een koffie.',                      'Quiero un café.',                           NULL),
    (v_dialogue_id,  3, 'Ober',  'Hoeveel suiker wilt u?',                        '¿Cuánta azúcar quiere?',                    NULL),
    (v_dialogue_id,  4, 'Klant', 'Twee suiker, alstublieft.',                     'Dos azúcares, por favor.',                  NULL),
    (v_dialogue_id,  5, 'Ober',  'Wilt u ook iets eten?',                         '¿Quiere también algo de comer?',            NULL),
    (v_dialogue_id,  6, 'Klant', 'Ja. Wat heeft u?',                              'Sí. ¿Qué tienen?',                          NULL),
    (v_dialogue_id,  7, 'Ober',  'Wij hebben broodjes, soep en salade.',          'Tenemos bocadillos, sopa y ensalada.',       NULL),
    (v_dialogue_id,  8, 'Klant', 'Ik neem een broodje kaas.',                     'Tomo un bocadillo de queso.',               NULL),
    (v_dialogue_id,  9, 'Ober',  'Prima. Wilt u nog iets?',                       'Perfecto. ¿Quiere algo más?',               NULL),
    (v_dialogue_id, 10, 'Klant', 'Nee, dat is alles. Mag ik pinnen?',             'No, eso es todo. ¿Puedo pagar con tarjeta?',NULL),
    (v_dialogue_id, 11, 'Ober',  'Ja, natuurlijk. Dat is €7,50.',                 'Sí, claro. Son 7,50 €.',                    NULL),
    (v_dialogue_id, 12, 'Klant', 'Dank u wel.',                                   'Gracias.',                                  NULL);

  -- ══════════════════════════════════════════════════════════════════════════════
  --  EJERCICIOS
  -- ══════════════════════════════════════════════════════════════════════════════

  -- ── EJ. 1 — Kies het vragende woord (fill_blank) ────────────────────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 100, 'fill_blank',
    '______ drink je? (¿qué bebes?)',
    'Wat',
    '"Wat" = qué',
    '"Wat" se usa para preguntar por una cosa. Wat drink je? = ¿Qué bebes?',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 101, 'fill_blank',
    '______ eet je? (¿dónde comes?)',
    'Waar',
    '"Waar" = dónde',
    '"Waar" se usa para preguntar por un lugar. Waar eet je? = ¿Dónde comes?',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 102, 'fill_blank',
    '______ eten we? (¿cuándo comemos?)',
    'Wanneer',
    '"Wanneer" = cuándo',
    '"Wanneer" se usa para preguntar por el momento. Wanneer eten we? = ¿Cuándo comemos?',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 103, 'fill_blank',
    '______ komt er? (¿quién viene?)',
    'Wie',
    '"Wie" = quién',
    '"Wie" se usa para preguntar por una persona. Wie komt er? = ¿Quién viene?',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 104, 'fill_blank',
    '______ suiker wil je? (¿cuánta azúcar quieres?)',
    'Hoeveel',
    '"Hoeveel" = cuánto / cuánta',
    '"Hoeveel" se usa para preguntar por cantidad. Hoeveel suiker wil je? = ¿Cuánta azúcar quieres?',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 105, 'fill_blank',
    'Nee, ik drink ______ koffie. (respuesta negativa)',
    'geen',
    '"Geen" se usa para negar un sustantivo',
    '"Geen" + sustantivo = negación. Nee, ik drink geen koffie. = No, no bebo café.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 106, 'fill_blank',
    '______ wil thee? (¿quién quiere té?)',
    'Wie',
    '"Wie" se usa para personas',
    '"Wie wil thee?" = ¿Quién quiere té? "Wie" pregunta siempre por una persona.',
    NULL)
  RETURNING id INTO v_item_id;

  -- ── EJ. 2 — Maak een vraag (order_sentence) ─────────────────────────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 110, 'order_sentence',
    'Ordena: "¿Qué bebes?" → drink / jij / wat',
    'Wat drink jij?',
    'La palabra interrogativa va primero, después verbo + sujeto',
    'Estructura W-vraag: palabra interrogativa + verbo + sujeto. Wat drink jij?',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'drink', false),
    (v_item_id, 2, 'jij',   false),
    (v_item_id, 3, 'wat',   false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 111, 'order_sentence',
    'Ordena: "¿Bebes café?" → koffie / drink / jij',
    'Drink jij koffie?',
    'Las preguntas de sí/no empiezan con el verbo',
    'Ja/nee-vraag: verbo + sujeto + complemento. Drink jij koffie?',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'koffie', false),
    (v_item_id, 2, 'drink',  false),
    (v_item_id, 3, 'jij',    false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 112, 'order_sentence',
    'Ordena: "¿Cuánta azúcar quieres?" → suiker / hoeveel / wil / je',
    'Hoeveel suiker wil je?',
    '"Hoeveel" va primero, luego el complemento, después verbo + sujeto',
    'Estructura: hoeveel + sustantivo + verbo + sujeto. Hoeveel suiker wil je?',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'suiker',  false),
    (v_item_id, 2, 'hoeveel', false),
    (v_item_id, 3, 'wil',     false),
    (v_item_id, 4, 'je',      false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 113, 'order_sentence',
    'Ordena: "¿Cuándo comemos?" → wanneer / eten / we',
    'Wanneer eten we?',
    '"Wanneer" va primero, después verbo + sujeto',
    'Estructura W-vraag: wanneer + verbo + sujeto. Wanneer eten we?',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'wanneer', false),
    (v_item_id, 2, 'eten',    false),
    (v_item_id, 3, 'we',      false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 114, 'order_sentence',
    'Ordena: "¿Quién viene?" → er / wie / komt',
    'Wie komt er?',
    '"Wie" va primero, después verbo + sujeto',
    'Estructura W-vraag: wie + verbo + er. "Er" es una partícula muy común en esta frase.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'er',   false),
    (v_item_id, 2, 'wie',  false),
    (v_item_id, 3, 'komt', false);

  -- ── EJ. 3 — Waar of niet waar? (multiple_choice) ────────────────────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 120, 'multiple_choice',
    '¿Es correcto? Una pregunta de sí/no suele empezar con el verbo.',
    'Verdadero',
    'Piensa en el orden en "Drink je koffie?"',
    'Verdadero. Ja/nee-vragen: verbo + sujeto + resto. Ejemplo: Drink je koffie?',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', true),
    (v_item_id, 2, 'Falso',     false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 121, 'multiple_choice',
    '¿Es correcto? "Wat drink jij?" es una estructura correcta.',
    'Verdadero',
    'Piensa en la estructura W-vraag',
    'Verdadero. W-vraag: palabra interrogativa + verbo + sujeto. Wat drink jij? = ¿Qué bebes?',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', true),
    (v_item_id, 2, 'Falso',     false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 122, 'multiple_choice',
    '¿Es correcto? "Jij drinkt koffie?" es la forma estándar de hacer una pregunta.',
    'Falso',
    'Recuerda el orden de palabras en una pregunta',
    'Falso. La forma correcta es "Drink jij koffie?" — el verbo va antes del sujeto en las preguntas.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', false),
    (v_item_id, 2, 'Falso',     true);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 123, 'multiple_choice',
    '¿Es correcto? "Geen" se usa para negar un sustantivo.',
    'Verdadero',
    'Piensa en "Nee, ik drink geen koffie."',
    'Verdadero. "Geen" + sustantivo = negación. Nee, ik drink geen koffie. = No, no bebo café.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', true),
    (v_item_id, 2, 'Falso',     false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 124, 'multiple_choice',
    '¿Es correcto? "Hoeveel" significa "cuánto / cuánta".',
    'Verdadero',
    'Recuerda el vocabulario de la lección',
    'Verdadero. "Hoeveel" = cuánto / cuánta / cuántos. Se usa para preguntar por cantidad.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', true),
    (v_item_id, 2, 'Falso',     false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 125, 'multiple_choice',
    '¿Es correcto? "Waar" significa "cuándo".',
    'Falso',
    'Distingue entre "waar" y "wanneer"',
    'Falso. "Waar" = dónde. "Wanneer" = cuándo. No las confundas.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', false),
    (v_item_id, 2, 'Falso',     true);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 126, 'multiple_choice',
    '¿Es correcto? "Wie komt er?" significa "¿Quién viene?".',
    'Verdadero',
    'Recuerda que "wie" = quién',
    'Verdadero. "Wie komt er?" = ¿Quién viene? "Er" es una partícula de lugar muy frecuente.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', true),
    (v_item_id, 2, 'Falso',     false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 127, 'multiple_choice',
    '¿Es correcto? En preguntas con "jij", el verbo pierde la -t: "Drinkt jij" → "Drink jij".',
    'Verdadero',
    'Recuerda la regla de la -t en preguntas',
    'Verdadero. Cuando "jij" sigue al verbo en una pregunta, la -t desaparece. Drinkt → drink.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Verdadero', true),
    (v_item_id, 2, 'Falso',     false);

  -- ── EJ. 4 — Koppel het vragende woord (match_pairs) ─────────────────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 130, 'match_pairs',
    'Une cada palabra interrogativa con su significado en español',
    '',
    NULL,
    NULL,
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO match_pair_items (practice_item_id, sort_order, left_text, right_text) VALUES
    (v_item_id, 1, 'wat',      'qué'),
    (v_item_id, 2, 'waar',     'dónde'),
    (v_item_id, 3, 'wanneer',  'cuándo'),
    (v_item_id, 4, 'wie',      'quién'),
    (v_item_id, 5, 'hoeveel',  'cuánto / cuánta');

  -- ── EJ. 5 — Negatie met "geen" (fill_blank) ──────────────────────────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 140, 'fill_blank',
    'Drink je koffie? → Nee, ik drink ______ koffie.',
    'geen',
    '"Geen" para negar un sustantivo',
    '"Geen" + sustantivo = negación. Ik drink geen koffie = No bebo café.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 141, 'fill_blank',
    'Wil je thee? → Nee, ik wil ______ thee.',
    'geen',
    '"Geen" para negar un sustantivo',
    '"Geen" + sustantivo = negación. Ik wil geen thee = No quiero té.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 142, 'fill_blank',
    'Eet je vlees? → Nee, ik eet ______ vlees.',
    'geen',
    '"Geen" se usa siempre antes del sustantivo',
    '"Geen" + sustantivo = negación. Ik eet geen vlees = No como carne.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 143, 'fill_blank',
    'Wil je suiker? → Nee, ik wil ______ suiker.',
    'geen',
    '"Geen" para negar un sustantivo',
    '"Geen" + sustantivo = negación. Ik wil geen suiker = No quiero azúcar.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 144, 'fill_blank',
    'Neem je een broodje? → Nee, ik neem ______ broodje.',
    'geen',
    '"Geen" se usa delante de "broodje" (sustantivo)',
    '"Geen" + sustantivo = negación. Ik neem geen broodje = No tomo bocadillo.',
    NULL)
  RETURNING id INTO v_item_id;

  -- ── EJ. 6 — Verbeter de zinnen (fill_blank: corrige el error) ───────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 150, 'fill_blank',
    'Error: "Jij drinkt koffie?" → ¿cuál es la forma correcta con el orden de pregunta?',
    'Drink jij koffie?',
    'En preguntas, el verbo va antes del sujeto',
    'Correcto: Drink jij koffie? En neerlandés, las preguntas invierten el orden: verbo + sujeto.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 151, 'fill_blank',
    'Error: "Wat jij drinkt?" → ¿cuál es el orden correcto?',
    'Wat drink jij?',
    'Después de la palabra interrogativa va el verbo, no el sujeto',
    'Correcto: Wat drink jij? Estructura W-vraag: wat + verbo + sujeto.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 152, 'fill_blank',
    'Error: "Drinkt jij thee?" → ¿cuál es la forma correcta? (recuerda: la -t desaparece)',
    'Drink jij thee?',
    'La -t desaparece cuando jij sigue al verbo en una pregunta',
    'Correcto: Drink jij thee? La -t de "drinkt" desaparece porque "jij" sigue al verbo.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 153, 'fill_blank',
    'Error: "Hoeveel jij wil suiker?" → ¿cuál es el orden correcto?',
    'Hoeveel suiker wil jij?',
    'Estructura: hoeveel + sustantivo + verbo + sujeto',
    'Correcto: Hoeveel suiker wil jij? El sustantivo sigue a "hoeveel", luego verbo + sujeto.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 154, 'fill_blank',
    'Error: "Ik drink geen koffie ja." → ¿cómo queda la respuesta negativa correcta?',
    'Nee, ik drink geen koffie.',
    'Una respuesta negativa empieza con "Nee"',
    'Correcto: Nee, ik drink geen koffie. Las respuestas negativas empiezan con "Nee", no terminan con "ja".',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 155, 'fill_blank',
    'Error: "Waar jij eet?" → ¿cuál es el orden correcto?',
    'Waar eet jij?',
    'Después de la palabra interrogativa va el verbo',
    'Correcto: Waar eet jij? Estructura W-vraag: waar + verbo + sujeto.',
    NULL)
  RETURNING id INTO v_item_id;

  -- ── EJ. 7 — Vertaal naar het Nederlands (fill_blank: ES→NL) ─────────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 160, 'fill_blank',
    '¿Bebes café? → ______ (en neerlandés)',
    'Drink jij koffie?',
    'Ja/nee-vraag: verbo + sujeto + complemento',
    'Correcto: Drink jij koffie? Estructura de pregunta sí/no.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 161, 'fill_blank',
    '¿Qué bebes? → ______ (en neerlandés)',
    'Wat drink jij?',
    '"Wat" = qué. W-vraag: wat + verbo + sujeto',
    'Correcto: Wat drink jij? Estructura W-vraag con "wat".',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 162, 'fill_blank',
    '¿Dónde comes? → ______ (en neerlandés)',
    'Waar eet jij?',
    '"Waar" = dónde. W-vraag: waar + verbo + sujeto',
    'Correcto: Waar eet jij? Estructura W-vraag con "waar".',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 163, 'fill_blank',
    '¿Cuándo comemos? → ______ (en neerlandés)',
    'Wanneer eten we?',
    '"Wanneer" = cuándo. W-vraag: wanneer + verbo + sujeto',
    'Correcto: Wanneer eten we? Estructura W-vraag con "wanneer".',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 164, 'fill_blank',
    'No, no bebo café. → ______ (en neerlandés)',
    'Nee, ik drink geen koffie.',
    '"Nee" + "geen" + sustantivo = respuesta negativa',
    'Correcto: Nee, ik drink geen koffie. Estructura de respuesta negativa con "geen".',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 165, 'fill_blank',
    '¿Quién viene? → ______ (en neerlandés)',
    'Wie komt er?',
    '"Wie" = quién. W-vraag: wie + verbo + er',
    'Correcto: Wie komt er? "Er" es una partícula muy frecuente con "wie komt".',
    NULL)
  RETURNING id INTO v_item_id;

  -- ── EJ. 8 — Completa el diálogo (fill_blank) ─────────────────────────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 170, 'fill_blank',
    'Ober: "______ wilt u drinken?" (completa la pregunta del camarero)',
    'Wat',
    '"Wat" = qué — pregunta por una cosa',
    'El camarero pregunta: Wat wilt u drinken? = ¿Qué quiere beber?',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 171, 'fill_blank',
    'Klant: "Ik wil ______ een koffie." (completa con la palabra que suaviza la petición)',
    'graag',
    '"Graag" hace la petición más amable y natural',
    '"Graag" = con gusto / por favor (suaviza la petición). Ik wil graag een koffie.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 172, 'fill_blank',
    'Ober: "______ suiker wilt u?" (pregunta por cantidad)',
    'Hoeveel',
    '"Hoeveel" = cuánto / cuánta — pregunta por cantidad',
    'Hoeveel suiker wilt u? = ¿Cuánta azúcar quiere? "Hoeveel" pregunta por cantidad.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 173, 'fill_blank',
    'Klant: "Nee, ______ is alles." (completa la frase de cierre)',
    'dat',
    '"Dat is alles" = eso es todo',
    'Nee, dat is alles. = No, eso es todo. Frase muy útil para cerrar un pedido.',
    NULL)
  RETURNING id INTO v_item_id;

END $$;
