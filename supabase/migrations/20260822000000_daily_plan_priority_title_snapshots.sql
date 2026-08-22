-- Daily-plan priority title snapshots (UI implementation campaign, Wave I).
--
-- Strictly additive; preserves all existing rows. Local counterpart:
-- migration 21 in core/db/client.ts adds the same nullable column so plan
-- saves can snapshot the display titles of top_todo_ids at write time.
-- The sync adapter projects rows onto BACKUP_ENTITY_COLUMNS, so an app whose
-- canonical daily_plans columns already include this field sends it once the
-- migration is applied; older clients simply never send it and views fall
-- back to live lookups when it is NULL.

ALTER TABLE public.daily_plans
  ADD COLUMN IF NOT EXISTS top_todo_titles TEXT;
