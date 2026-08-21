-- Daily-plan priority title snapshots (UI implementation campaign, Wave I).
--
-- Strictly additive; preserves all existing rows. Local counterpart:
-- migration 21 in core/db/client.ts adds the same nullable column so plan
-- saves can snapshot the display titles of top_todo_ids at write time.
-- The sync adapter upserts whole rows, so an app updated before this
-- migration degrades safely (the new column is simply not sent) instead of
-- failing push with an unknown-column error; once applied, remote rows carry
-- the snapshot and views fall back to live lookups when it is NULL.

ALTER TABLE public.daily_plans
  ADD COLUMN IF NOT EXISTS top_todo_titles TEXT;
