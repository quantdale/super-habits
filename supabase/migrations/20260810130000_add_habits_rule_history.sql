-- Habit Engine V2: preserve effective-dated schedule and target history.
--
-- Existing rows intentionally retain the empty-array default. The application
-- treats an absent/empty history as the established every-day legacy rule, so
-- this additive migration does not invent historical creation dates.
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS rule_history TEXT NOT NULL DEFAULT '[]';
