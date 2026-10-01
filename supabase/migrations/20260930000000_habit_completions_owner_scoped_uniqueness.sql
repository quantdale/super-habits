-- Owner-scoped uniqueness for habit_completions.
--
-- The same class of defect the V2 closure remediation fixed for `saved_meals`:
-- a GLOBAL unique constraint whose scope is narrower than the owner.
--
--   habit_completions_habit_date_unique UNIQUE (habit_id, date_key)
--
-- `habit_id` is a TEXT id, not a per-account sequence, and the table is
-- pushed by the one-way backup from every device. A global constraint on
-- (habit_id, date_key) therefore means two accounts that happen to share a
-- habit id cannot both record a completion for the same date: the second
-- upsert affects ZERO rows while returning HTTP 200, so the push looked
-- successful, the outbox record was dropped, and the backup manifest went on to
-- certify a count and checksum for a row the remote never stored. RLS cannot
-- make a uniqueness constraint owner-scoped — the constraint itself has to
-- carry the owner column.
--
-- The local product semantic is one row per (habit, local date key) PER DEVICE
-- with an owner column, so the remote contract becomes
-- UNIQUE (user_id, habit_id, date_key).
--
-- The already-applied 20260815100000_add_backup_completeness_v2.sql is
-- historical input and is NOT rewritten. The index is created after the drop in
-- the same transaction, so no window with an unguarded table exists for writes
-- that bypass RLS. Pre-existing duplicates cannot exist: the global constraint
-- was strictly stronger than the new one.

ALTER TABLE public.habit_completions
  DROP CONSTRAINT habit_completions_habit_date_unique;

CREATE UNIQUE INDEX IF NOT EXISTS uq_habit_completions_owner_habit_date
  ON public.habit_completions (user_id, habit_id, date_key);
