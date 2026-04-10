-- Run this once in the Supabase SQL Editor
-- Creates the match_pair_items table for match_pairs exercises

CREATE TABLE IF NOT EXISTS match_pair_items (
  id               BIGSERIAL PRIMARY KEY,
  practice_item_id BIGINT NOT NULL REFERENCES practice_items(id) ON DELETE CASCADE,
  sort_order       INT NOT NULL DEFAULT 0,
  left_text        TEXT NOT NULL,
  right_text       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS match_pair_items_practice_item_id_idx
  ON match_pair_items (practice_item_id);
