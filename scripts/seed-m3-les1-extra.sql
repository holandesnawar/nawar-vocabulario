-- ============================================================
-- Módulo 3 — Lección 1: Eten en drinken
-- Vocabulario extra + Frases útiles + Ejercicios nuevos
--
-- Cómo ejecutar:
--   Pega este SQL en el editor SQL de Supabase y ejecuta.
--
-- Notas:
--   · audio_url = NULL en todos los registros — añadir manualmente después.
--   · Los sort_order empiezan en 100 para no solapar con el contenido
--     ya existente (sort_order 1-99).
--   · Los ejercicios listen_and_choose usan TTS automáticamente sobre
--     el texto entre comillas del question_text.
-- ============================================================

DO $$
DECLARE
  v_lesson_id BIGINT;
  v_item_id   BIGINT;
BEGIN

  -- ── Obtener el ID de la lección ──────────────────────────────────────────
  SELECT l.id INTO v_lesson_id
  FROM lessons l
  JOIN modules m ON m.id = l.module_id
  WHERE l.slug = 'm3-les-1-eten-en-drinken'
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Lección m3-les-1-eten-en-drinken no encontrada. Verifica el slug.';
  END IF;

  -- ── Limpiar datos anteriores (idempotente) ───────────────────────────────
  DELETE FROM match_pair_items
    WHERE practice_item_id IN (
      SELECT id FROM practice_items WHERE lesson_id = v_lesson_id AND sort_order >= 100
    );
  DELETE FROM practice_options
    WHERE practice_item_id IN (
      SELECT id FROM practice_items WHERE lesson_id = v_lesson_id AND sort_order >= 100
    );
  DELETE FROM practice_items  WHERE lesson_id = v_lesson_id AND sort_order >= 100;
  DELETE FROM phrases          WHERE lesson_id = v_lesson_id AND sort_order >= 100;
  DELETE FROM vocabulary_items WHERE lesson_id = v_lesson_id AND sort_order >= 100;

  -- ══════════════════════════════════════════════════════════════════════════
  --  VOCABULARIO EXTRA  (organizado por secciones mediante sort_order)
  -- ══════════════════════════════════════════════════════════════════════════

  -- ── Sección: Comida y bebida — conceptos base (100-109) ─────────────────
  INSERT INTO vocabulary_items (lesson_id, sort_order, article, word_nl, translation_es, audio_url) VALUES
    (v_lesson_id, 100, 'het', 'het eten',      'la comida',                      NULL),
    (v_lesson_id, 101, 'het', 'het drinken',   'la bebida',                      NULL),
    (v_lesson_id, 102, 'het', 'het ontbijt',   'el desayuno',                    NULL),
    (v_lesson_id, 103, 'de',  'de lunch',      'el almuerzo',                    NULL),
    (v_lesson_id, 104, 'het', 'het avondeten', 'la cena',                        NULL),
    (v_lesson_id, 105, 'de',  'de boterham',   'el bocadillo / rebanada de pan', NULL),
    (v_lesson_id, 106, 'de',  'de ham',        'el jamón',                       NULL),
    (v_lesson_id, 107, 'de',  'de yoghurt',    'el yogur',                       NULL),
    (v_lesson_id, 108, 'het', 'het sap',       'el zumo',                        NULL),
    (v_lesson_id, 109, 'het', 'het ei',        'el huevo',                       NULL);

  -- ── Sección: Frutas (120-122) ────────────────────────────────────────────
  INSERT INTO vocabulary_items (lesson_id, sort_order, article, word_nl, translation_es, audio_url) VALUES
    (v_lesson_id, 120, 'de', 'de appel',  'la manzana', NULL),
    (v_lesson_id, 121, 'de', 'de banaan', 'el plátano', NULL);

  -- ── Sección: Verduras (130-132) ──────────────────────────────────────────
  INSERT INTO vocabulary_items (lesson_id, sort_order, article, word_nl, translation_es, audio_url) VALUES
    (v_lesson_id, 130, 'de', 'de aardappel', 'la patata', NULL),
    (v_lesson_id, 131, 'de', 'de tomaat',    'el tomate', NULL),
    (v_lesson_id, 132, 'de', 'de komkommer', 'el pepino', NULL);

  -- ── Sección: Carnes (140) ────────────────────────────────────────────────
  INSERT INTO vocabulary_items (lesson_id, sort_order, article, word_nl, translation_es, audio_url) VALUES
    (v_lesson_id, 140, 'de', 'de kip', 'el pollo', NULL);

  -- ── Sección: Cantidades pequeñas / diminutivos (150-155) ─────────────────
  INSERT INTO vocabulary_items (lesson_id, sort_order, article, word_nl, translation_es, audio_url) VALUES
    (v_lesson_id, 150, 'het', 'het hapje',   'el bocado / snack pequeño', NULL),
    (v_lesson_id, 151, 'het', 'het slokje',  'el sorbito',                NULL),
    (v_lesson_id, 152, 'het', 'het stukje',  'el trocito',                NULL),
    (v_lesson_id, 153, 'het', 'het glaasje', 'el vasito',                 NULL),
    (v_lesson_id, 154, 'het', 'het kopje',   'la tacita',                 NULL),
    (v_lesson_id, 155, 'het', 'het broodje', 'el bocadillo / panecillo',  NULL);

  -- ── Sección: Supermercado — personas y lugares (160-167) ─────────────────
  INSERT INTO vocabulary_items (lesson_id, sort_order, article, word_nl, translation_es, audio_url) VALUES
    (v_lesson_id, 160, 'de', 'de klant',           'el cliente',   NULL),
    (v_lesson_id, 161, 'de', 'de medewerker',      'el empleado',  NULL),
    (v_lesson_id, 162, 'de', 'de kassamedewerker', 'el cajero',    NULL),
    (v_lesson_id, 163, 'de', 'de zuivel',          'los lácteos',  NULL),
    (v_lesson_id, 164, 'de', 'de pasta',           'la pasta',     NULL),
    (v_lesson_id, 165, 'de', 'de afdeling',        'la sección',   NULL),
    (v_lesson_id, 166, 'de', 'de ingang',          'la entrada',   NULL),
    (v_lesson_id, 167, 'de', 'de uitgang',         'la salida',    NULL);

  -- ── Sección: Verbos clave (170-177) ─────────────────────────────────────
  INSERT INTO vocabulary_items (lesson_id, sort_order, article, word_nl, translation_es, audio_url) VALUES
    (v_lesson_id, 170, NULL, 'kopen',  'comprar',                  NULL),
    (v_lesson_id, 171, NULL, 'zoeken', 'buscar',                   NULL),
    (v_lesson_id, 172, NULL, 'vinden', 'encontrar',                NULL),
    (v_lesson_id, 173, NULL, 'nemen',  'coger / tomar',            NULL),
    (v_lesson_id, 174, NULL, 'staan',  'estar de pie (colocado)',  NULL),
    (v_lesson_id, 175, NULL, 'liggen', 'estar tumbado (colocado)', NULL),
    (v_lesson_id, 176, NULL, 'helpen', 'ayudar',                   NULL),
    (v_lesson_id, 177, NULL, 'pinnen', 'pagar con tarjeta',        NULL);

  -- ══════════════════════════════════════════════════════════════════════════
  --  FRASES ÚTILES (100-123)
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO phrases (lesson_id, sort_order, phrase_nl, translation_es, audio_url) VALUES
    (v_lesson_id, 100, 'Ik eet brood met kaas.',                      'Como pan con queso.',                          NULL),
    (v_lesson_id, 101, 'Ik drink koffie.',                            'Bebo café.',                                   NULL),
    (v_lesson_id, 102, 'Ik drink thee.',                              'Bebo té.',                                     NULL),
    (v_lesson_id, 103, 'Ik eet fruit.',                               'Como fruta.',                                  NULL),
    (v_lesson_id, 104, 'Ik eet soep met brood.',                      'Como sopa con pan.',                           NULL),
    (v_lesson_id, 105, 'Als ontbijt eet ik brood.',                   'De desayuno como pan.',                        NULL),
    (v_lesson_id, 106, 'Als lunch eet ik een boterham met kaas.',     'De almuerzo como un bocadillo con queso.',     NULL),
    (v_lesson_id, 107, 'Als avondeten eet ik rijst met groenten.',    'De cena como arroz con verduras.',             NULL),
    (v_lesson_id, 108, 'Ik koop melk in de supermarkt.',             'Compro leche en el supermercado.',              NULL),
    (v_lesson_id, 109, 'Ik neem een mandje.',                         'Cojo una cesta.',                              NULL),
    (v_lesson_id, 110, 'Waar vind ik de melk?',                       '¿Dónde encuentro la leche?',                  NULL),
    (v_lesson_id, 111, 'Waar is de kassa?',                           '¿Dónde está la caja?',                        NULL),
    (v_lesson_id, 112, 'Mag ik pinnen, alstublieft?',                 '¿Puedo pagar con tarjeta, por favor?',        NULL),
    (v_lesson_id, 113, 'De melk staat bij de zuivel.',               'La leche está en la sección de lácteos.',      NULL),
    (v_lesson_id, 114, 'De rijst ligt bij de pasta.',                 'El arroz está junto a la pasta.',              NULL),
    (v_lesson_id, 115, 'Een pak melk.',                               'Un cartón de leche.',                          NULL),
    (v_lesson_id, 116, 'Een fles water.',                             'Una botella de agua.',                         NULL),
    (v_lesson_id, 117, 'Een blik soep.',                              'Una lata de sopa.',                            NULL),
    (v_lesson_id, 118, 'Een zak rijst.',                              'Una bolsa de arroz.',                          NULL),
    (v_lesson_id, 119, 'Een doos fruit.',                             'Una caja de fruta.',                           NULL),
    (v_lesson_id, 120, 'Ik neem een slokje water.',                   'Doy un sorbito de agua.',                      NULL),
    (v_lesson_id, 121, 'Ik eet een hapje.',                           'Como un bocado.',                              NULL),
    (v_lesson_id, 122, 'Ik wil een kopje koffie.',                    'Quiero una tacita de café.',                   NULL),
    (v_lesson_id, 123, 'Ik koop een broodje en een fles water.',      'Compro un panecillo y una botella de agua.',   NULL);

  -- ══════════════════════════════════════════════════════════════════════════
  --  EJERCICIOS
  --  Orden de secciones:
  --    100-106  → fill_blank: conjugar verbos
  --    110-116  → multiple_choice: ¿eten of drinken?
  --    120-125  → listen_and_choose: escucha y elige
  --    130-133  → order_sentence: ordena la frase
  --    140-142  → match_pairs: empareja vocabulario
  --    150-153  → word_scramble: deletrea la palabra
  -- ══════════════════════════════════════════════════════════════════════════

  -- ── SECCIÓN 1: Conjugar verbos (fill_blank) ──────────────────────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 100, 'fill_blank',
    'Als ontbijt ___ ik brood. (conjugar: eten)',
    'eet',
    'La raíz de "eten" es "eet" para ik/jij/hij.',
    '"Eten" → ik eet, jij eet, hij eet, wij eten, jullie eten, zij eten.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 101, 'fill_blank',
    'Ik ___ elke ochtend sap. (conjugar: drinken)',
    'drink',
    'La raíz de "drinken" es "drink".',
    '"Drinken" → ik drink, jij drinkt, hij drinkt, wij drinken.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 102, 'fill_blank',
    'Ik ___ melk in de supermarkt. (conjugar: kopen)',
    'koop',
    'La raíz de "kopen" es "koop".',
    '"Kopen" → ik koop, jij koopt, hij koopt, wij kopen.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 103, 'fill_blank',
    'Waar ___ ik de yoghurt? (conjugar: vinden)',
    'vind',
    'La raíz de "vinden" es "vind".',
    '"Vinden" → ik vind, jij vindt, hij vindt, wij vinden.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 104, 'fill_blank',
    'Ik ___ een mandje bij de ingang. (conjugar: nemen)',
    'neem',
    '"Nemen" es irregular: ik neem (raíz cambia).',
    '"Nemen" → ik neem, jij neemt, hij neemt, wij nemen. Verbo irregular.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 105, 'fill_blank',
    'Ik ___ de kassa. (conjugar: zoeken)',
    'zoek',
    'La raíz de "zoeken" es "zoek".',
    '"Zoeken" → ik zoek, jij zoekt, hij zoekt, wij zoeken.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 106, 'fill_blank',
    'De medewerker ___ de klant. (conjugar: helpen — hij/zij)',
    'helpt',
    'Para hij/zij/het añadimos -t a la raíz "help".',
    '"Helpen" → ik help, jij helpt, hij helpt, wij helpen.',
    NULL)
  RETURNING id INTO v_item_id;

  -- ── SECCIÓN 2: ¿Eten of drinken? (multiple_choice) ───────────────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 110, 'multiple_choice',
    '¿Qué verbo usas con "de melk"?',
    'drinken',
    'La leche es un líquido.',
    '"Ik drink melk." — Los líquidos usan "drinken".',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'eten',    false),
    (v_item_id, 2, 'drinken', true);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 111, 'multiple_choice',
    '¿Qué verbo usas con "een ei"?',
    'eten',
    'El huevo es sólido.',
    '"Ik eet een ei." — Los alimentos sólidos usan "eten".',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'drinken', false),
    (v_item_id, 2, 'eten',    true);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 112, 'multiple_choice',
    '¿Qué verbo usas con "het sap"?',
    'drinken',
    'El zumo es una bebida.',
    '"Ik drink het sap." — Los zumos son líquidos.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'eten',    false),
    (v_item_id, 2, 'drinken', true);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 113, 'multiple_choice',
    '¿Qué verbo usas con "een appel"?',
    'eten',
    'La manzana es sólida.',
    '"Ik eet een appel." — Las frutas sólidas usan "eten".',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'drinken', false),
    (v_item_id, 2, 'eten',    true);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 114, 'multiple_choice',
    '¿Qué verbo usas con "de yoghurt"?',
    'eten',
    'El yogur se toma con cuchara.',
    '"Ik eet yoghurt." — El yogur se come, aunque sea cremoso.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'drinken', false),
    (v_item_id, 2, 'eten',    true);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 115, 'multiple_choice',
    '¿Qué verbo usas con "de soep"?',
    'eten',
    'En neerlandés la sopa se "come", aunque sea líquida.',
    '"Ik eet soep." — Truco: si lleva cuchara, suele ser "eten".',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'drinken', false),
    (v_item_id, 2, 'eten',    true);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 116, 'multiple_choice',
    '¿Qué verbo usas con "de koffie"?',
    'drinken',
    'El café es una bebida caliente.',
    '"Ik drink koffie." — Los líquidos usan "drinken".',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'eten',    false),
    (v_item_id, 2, 'drinken', true);

  -- ── SECCIÓN 3: Escucha y elige (listen_and_choose) ───────────────────────
  -- El texto entre comillas en question_text se reproduce con TTS.

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 120, 'listen_and_choose',
    '¿Cuál es la traducción correcta de "Ik drink water"?',
    'Bebo agua.',
    'Escucha el verbo: ¿es eten o drinken?',
    '"Drinken" = beber, "water" = agua.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Como pan.',      false),
    (v_item_id, 2, 'Bebo agua.',     true),
    (v_item_id, 3, 'Compro leche.',  false),
    (v_item_id, 4, 'Tengo sed.',     false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 121, 'listen_and_choose',
    '¿Cuál es la traducción correcta de "Ik eet fruit"?',
    'Como fruta.',
    'Escucha el verbo y el sustantivo.',
    '"Eten" = comer, "fruit" = fruta.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Bebo té.',          false),
    (v_item_id, 2, 'Como fruta.',       true),
    (v_item_id, 3, 'Busco el zumo.',    false),
    (v_item_id, 4, 'Tengo hambre.',     false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 122, 'listen_and_choose',
    '¿Cuál es la traducción correcta de "Mag ik pinnen, alstublieft"?',
    '¿Puedo pagar con tarjeta, por favor?',
    '"Pinnen" = pagar con tarjeta. "Alstublieft" = por favor (formal).',
    '"Mag ik" = ¿puedo?, "pinnen" = pagar con tarjeta.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, '¿Puedo comer aquí?',                      false),
    (v_item_id, 2, '¿Cuánto cuesta?',                         false),
    (v_item_id, 3, '¿Puedo pagar con tarjeta, por favor?',    true),
    (v_item_id, 4, '¿Dónde está la salida?',                  false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 123, 'listen_and_choose',
    '¿Cuál es la traducción correcta de "De melk staat bij de zuivel"?',
    'La leche está en la sección de lácteos.',
    '"Staan" = estar (de pie/colocado). "Zuivel" = lácteos.',
    '"Staan" describe objetos verticales como botellas o cartones.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'El zumo está junto a la pasta.',           false),
    (v_item_id, 2, 'La leche está en la sección de lácteos.', true),
    (v_item_id, 3, 'El pan está en la panadería.',             false),
    (v_item_id, 4, 'La carne está en la nevera.',              false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 124, 'listen_and_choose',
    '¿Cuál es la traducción correcta de "Ik wil een kopje koffie"?',
    'Quiero una tacita de café.',
    '"Kopje" es el diminutivo de "kop" (taza).',
    '"Wil" = quiero, "kopje" = tacita (diminutivo).',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Quiero un vaso de agua.',    false),
    (v_item_id, 2, 'Quiero una tacita de café.', true),
    (v_item_id, 3, 'Bebo una cerveza.',          false),
    (v_item_id, 4, 'Como un bocadillo.',         false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 125, 'listen_and_choose',
    '¿Cuál es la traducción correcta de "Als ontbijt eet ik brood"?',
    'De desayuno como pan.',
    '"Ontbijt" = desayuno. "Als" = de / como (para indicar el momento).',
    'Cuando "Als ontbijt" va al inicio, el sujeto va detrás del verbo.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'De desayuno como pan.',        true),
    (v_item_id, 2, 'Para cenar bebo leche.',        false),
    (v_item_id, 3, 'Compro pan en el desayuno.',    false),
    (v_item_id, 4, 'Como almuerzo bebo café.',      false);

  -- ── SECCIÓN 4: Ordenar frases (order_sentence) ───────────────────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 130, 'order_sentence',
    'Ordena las palabras: "Compro leche en el supermercado."',
    'Ik koop melk in de supermarkt.',
    '"Kopen" = comprar. El verbo va siempre en segunda posición.',
    'En neerlandés: sujeto + verbo + objeto + lugar.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Ik',          false),
    (v_item_id, 2, 'koop',        false),
    (v_item_id, 3, 'melk',        false),
    (v_item_id, 4, 'in',          false),
    (v_item_id, 5, 'de',          false),
    (v_item_id, 6, 'supermarkt.', false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 131, 'order_sentence',
    'Ordena las palabras: "Como un bocadillo con jamón."',
    'Ik eet een boterham met ham.',
    '"Met" = con. "Boterham" = rebanada de pan / bocadillo.',
    '"Met" enlaza el alimento con su acompañamiento.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Ik',       false),
    (v_item_id, 2, 'eet',      false),
    (v_item_id, 3, 'een',      false),
    (v_item_id, 4, 'boterham', false),
    (v_item_id, 5, 'met',      false),
    (v_item_id, 6, 'ham.',     false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 132, 'order_sentence',
    'Ordena las palabras: "¿Dónde está la caja?"',
    'Waar is de kassa?',
    '"Waar" = dónde. En preguntas el verbo va en segunda posición.',
    'Preguntas: palabra interrogativa + verbo + sujeto.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Waar',   false),
    (v_item_id, 2, 'is',     false),
    (v_item_id, 3, 'de',     false),
    (v_item_id, 4, 'kassa?', false);

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 133, 'order_sentence',
    'Ordena las palabras: "De cena como arroz con verduras."',
    'Als avondeten eet ik rijst met groenten.',
    '"Als avondeten" va al inicio → el sujeto va después del verbo.',
    'Regla de inversión: si el adverbio de tiempo va al inicio, sujeto y verbo se invierten.',
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO practice_options (practice_item_id, sort_order, option_text, is_correct) VALUES
    (v_item_id, 1, 'Als',       false),
    (v_item_id, 2, 'avondeten', false),
    (v_item_id, 3, 'eet',       false),
    (v_item_id, 4, 'ik',        false),
    (v_item_id, 5, 'rijst',     false),
    (v_item_id, 6, 'met',       false),
    (v_item_id, 7, 'groenten.', false);

  -- ── SECCIÓN 5: Emparejar vocabulario (match_pairs) ───────────────────────

  -- Las comidas del día
  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 140, 'match_pairs',
    'Empareja las comidas del día con su traducción.',
    'match',
    'Hay tres momentos principales para comer en un día.',
    NULL,
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO match_pair_items (practice_item_id, sort_order, left_text, right_text) VALUES
    (v_item_id, 1, 'het ontbijt',   'el desayuno'),
    (v_item_id, 2, 'de lunch',      'el almuerzo'),
    (v_item_id, 3, 'het avondeten', 'la cena'),
    (v_item_id, 4, 'het eten',      'la comida'),
    (v_item_id, 5, 'het drinken',   'la bebida');

  -- El supermercado
  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 141, 'match_pairs',
    'Empareja las palabras del supermercado con su traducción.',
    'match',
    'Piensa en personas, lugares y secciones.',
    NULL,
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO match_pair_items (practice_item_id, sort_order, left_text, right_text) VALUES
    (v_item_id, 1, 'de klant',      'el cliente'),
    (v_item_id, 2, 'de medewerker', 'el empleado'),
    (v_item_id, 3, 'de ingang',     'la entrada'),
    (v_item_id, 4, 'de uitgang',    'la salida'),
    (v_item_id, 5, 'de zuivel',     'los lácteos');

  -- Cantidades pequeñas (diminutivos)
  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 142, 'match_pairs',
    'Empareja los diminutivos con su traducción.',
    'match',
    'Todos terminan en -je: son versiones pequeñas de la forma base.',
    NULL,
    NULL)
  RETURNING id INTO v_item_id;
  INSERT INTO match_pair_items (practice_item_id, sort_order, left_text, right_text) VALUES
    (v_item_id, 1, 'het hapje',   'el bocado'),
    (v_item_id, 2, 'het slokje',  'el sorbito'),
    (v_item_id, 3, 'het stukje',  'el trocito'),
    (v_item_id, 4, 'het glaasje', 'el vasito'),
    (v_item_id, 5, 'het kopje',   'la tacita');

  -- ── SECCIÓN 6: Deletrear palabras (word_scramble) ────────────────────────

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 150, 'word_scramble',
    'Ordena las letras para formar la palabra que significa "comprar".',
    'kopen',
    'Empieza por "k" y tiene 5 letras.',
    '"Kopen" = comprar. Conjugado: ik koop, jij koopt.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 151, 'word_scramble',
    'Ordena las letras para formar la palabra que significa "el desayuno".',
    'ontbijt',
    'Empieza por "o" y tiene 7 letras.',
    '"Het ontbijt" = el desayuno.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 152, 'word_scramble',
    'Ordena las letras para formar la palabra que significa "encontrar".',
    'vinden',
    'Empieza por "v" y tiene 6 letras.',
    '"Vinden" = encontrar. Ik vind de melk bij de zuivel.',
    NULL)
  RETURNING id INTO v_item_id;

  INSERT INTO practice_items
    (lesson_id, sort_order, type, question_text, correct_answer, hint, explanation, audio_url)
  VALUES (v_lesson_id, 153, 'word_scramble',
    'Ordena las letras para formar la palabra que significa "pagar con tarjeta".',
    'pinnen',
    'Empieza por "p" y tiene 6 letras. Muy común en los Países Bajos.',
    '"Pinnen" = pagar con tarjeta. Casi todo se paga con tarjeta en NL.',
    NULL)
  RETURNING id INTO v_item_id;

  RAISE NOTICE 'Todo insertado correctamente para la lección ID: %', v_lesson_id;

END $$;
