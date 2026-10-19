-- R3-07/08/09: idempotent immutable uploads, server content verification and
-- owner-serialized sequence allocation. Apply after the two protocol migrations.
-- No legacy content is rewritten. Automatic collection remains disabled.
BEGIN;

CREATE TABLE public.backup_generation_sequence_reservation (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_id text NOT NULL,
  sequence bigint NOT NULL CHECK (sequence > 0 AND sequence <= 9007199254740991),
  PRIMARY KEY (user_id, snapshot_id),
  UNIQUE (user_id, sequence)
);
CREATE TABLE public.backup_generation_publication (
  user_id uuid NOT NULL,
  snapshot_id text NOT NULL,
  sequence bigint NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, snapshot_id),
  FOREIGN KEY (user_id, snapshot_id) REFERENCES public.backup_generation(user_id, snapshot_id)
    ON DELETE RESTRICT
);
ALTER TABLE public.backup_generation_sequence_reservation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_generation_publication ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_generation_sequence_reservation, public.backup_generation_publication
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.backup_generation_sequence_reservation, public.backup_generation_publication
  TO authenticated;
GRANT ALL ON public.backup_generation_sequence_reservation, public.backup_generation_publication
  TO service_role;
CREATE POLICY backup_generation_reservation_select_owner
  ON public.backup_generation_sequence_reservation FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY backup_generation_publication_select_owner
  ON public.backup_generation_publication FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Preserve the existing published head on upgrades. No cleanup may delete it.
INSERT INTO public.backup_generation_publication(user_id, snapshot_id, sequence)
SELECT user_id, snapshot_id, sequence FROM public.backup_generation_head;

CREATE FUNCTION public.backup_generation_capabilities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog
AS $$ SELECT jsonb_build_object(
  'protocol_version', 1, 'content_verification_version', 1,
  'sequence_reservation_version', 1, 'backup_schema_version', 2,
  'scope_version', 7, 'settings_version', 5) $$;
REVOKE ALL ON FUNCTION public.backup_generation_capabilities() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.backup_generation_capabilities() TO authenticated;

CREATE FUNCTION public.reserve_backup_generation_sequence(p_snapshot_id text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE v_owner uuid := (SELECT auth.uid()); v_sequence bigint;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'sequence reservation requires an authenticated owner' USING ERRCODE='42501';
  END IF;
  IF p_snapshot_id IS NULL OR length(p_snapshot_id) NOT BETWEEN 1 AND 256 THEN
    RAISE EXCEPTION 'invalid snapshot identity' USING ERRCODE='23514';
  END IF;
  -- One lock namespace for reservation, upload insertion and publication. This
  -- also serializes FIRST publication, when there is no head row to lock yet.
  PERFORM pg_advisory_xact_lock(hashtextextended('superhabits.backup:' || v_owner::text, 0));
  SELECT sequence INTO v_sequence FROM public.backup_generation
    WHERE user_id=v_owner AND snapshot_id=p_snapshot_id;
  IF FOUND THEN RETURN v_sequence; END IF;
  SELECT sequence INTO v_sequence FROM public.backup_generation_sequence_reservation
    WHERE user_id=v_owner AND snapshot_id=p_snapshot_id;
  IF FOUND THEN RETURN v_sequence; END IF;
  SELECT COALESCE(max(sequence),0)+1 INTO v_sequence FROM (
    SELECT sequence FROM public.backup_generation WHERE user_id=v_owner
    UNION ALL SELECT sequence FROM public.backup_generation_sequence_reservation WHERE user_id=v_owner
  ) AS existing;
  INSERT INTO public.backup_generation_sequence_reservation VALUES(v_owner,p_snapshot_id,v_sequence);
  RETURN v_sequence;
END $$;
REVOKE ALL ON FUNCTION public.reserve_backup_generation_sequence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_backup_generation_sequence(text) TO authenticated;

CREATE FUNCTION public.backup_generation_require_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('superhabits.backup:' || NEW.user_id::text, 0));
  IF NOT EXISTS(SELECT 1 FROM public.backup_generation_sequence_reservation
    WHERE user_id=NEW.user_id AND snapshot_id=NEW.snapshot_id AND sequence=NEW.sequence)
    AND NOT EXISTS(SELECT 1 FROM public.backup_generation
      WHERE user_id=NEW.user_id AND snapshot_id=NEW.snapshot_id AND sequence=NEW.sequence) THEN
    RAISE EXCEPTION 'generation sequence must be reserved by its authenticated owner' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER backup_generation_reserved_insert BEFORE INSERT ON public.backup_generation
  FOR EACH ROW EXECUTE FUNCTION public.backup_generation_require_reservation();

CREATE OR REPLACE FUNCTION public.backup_generation_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $$
BEGIN
  IF ROW(NEW.user_id,NEW.snapshot_id,NEW.sequence,NEW.protocol_version,
    NEW.backup_schema_version,NEW.scope_version,NEW.settings_version,NEW.manifest,
    NEW.manifest_checksum,NEW.captured_at) IS DISTINCT FROM
    ROW(OLD.user_id,OLD.snapshot_id,OLD.sequence,OLD.protocol_version,
    OLD.backup_schema_version,OLD.scope_version,OLD.settings_version,OLD.manifest,
    OLD.manifest_checksum,OLD.captured_at) THEN
    RAISE EXCEPTION 'backup_generation certified content is immutable' USING ERRCODE='23514';
  END IF;
  RETURN OLD;
END $$;

-- PostgreSQL upsert executes UPDATE even when the bytes are identical. RLS must
-- admit the owner's UPDATE; the trigger decides whether it is a legal retry.
CREATE POLICY backup_generation_chunk_update_owner ON public.backup_generation_chunk
  FOR UPDATE TO authenticated USING ((SELECT auth.uid())=user_id)
  WITH CHECK ((SELECT auth.uid())=user_id);
CREATE OR REPLACE FUNCTION public.backup_generation_chunk_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $$
BEGIN
  IF ROW(NEW.user_id,NEW.snapshot_id,NEW.entity,NEW.ordinal,NEW.payload,NEW.checksum)
    IS DISTINCT FROM ROW(OLD.user_id,OLD.snapshot_id,OLD.entity,OLD.ordinal,OLD.payload,OLD.checksum) THEN
    RAISE EXCEPTION 'backup_generation_chunk content and identity are immutable' USING ERRCODE='23514';
  END IF;
  RETURN OLD;
END $$;
CREATE FUNCTION public.backup_generation_chunk_insert_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('superhabits.backup:' || NEW.user_id::text, 0));
  IF (EXISTS(SELECT 1 FROM public.backup_generation_publication
      WHERE user_id=NEW.user_id AND snapshot_id=NEW.snapshot_id)
    OR EXISTS(SELECT 1 FROM public.backup_generation g
      JOIN public.backup_generation_head h ON h.user_id=g.user_id AND h.sequence>=g.sequence
      WHERE g.user_id=NEW.user_id AND g.snapshot_id=NEW.snapshot_id))
    AND NOT EXISTS(SELECT 1 FROM public.backup_generation_chunk
      WHERE user_id=NEW.user_id AND snapshot_id=NEW.snapshot_id
        AND entity=NEW.entity AND ordinal=NEW.ordinal) THEN
    RAISE EXCEPTION 'published generation cannot receive additional chunks' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER backup_generation_chunk_sealed_insert BEFORE INSERT ON public.backup_generation_chunk
  FOR EACH ROW EXECUTE FUNCTION public.backup_generation_chunk_insert_guard();
REVOKE DELETE ON public.backup_generation, public.backup_generation_chunk FROM authenticated;

-- Canonicalize only each row's TOP LEVEL keys, exactly as capture.ts does.
-- json (not jsonb) retains the original numeric/string value representation;
-- nested values are deliberately not re-sorted. Empty entity => SHA256('[]').
CREATE FUNCTION public.backup_generation_canonical_rows(p_rows json)
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT SECURITY INVOKER SET search_path = pg_catalog
AS $$
DECLARE v_row json; v_result text := '['; v_first boolean := true; v_object text;
BEGIN
  IF json_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'entity payload must be an array' USING ERRCODE='23514';
  END IF;
  FOR v_row IN SELECT value FROM json_array_elements(p_rows) LOOP
    IF json_typeof(v_row) <> 'object' THEN
      RAISE EXCEPTION 'entity row must be an object' USING ERRCODE='23514';
    END IF;
    IF (SELECT count(*) <> count(DISTINCT key) FROM json_each(v_row)) THEN
      RAISE EXCEPTION 'duplicate row key' USING ERRCODE='23514';
    END IF;
    SELECT '{' || COALESCE(string_agg(to_json(key)::text || ':' || value::text, ',' ORDER BY key COLLATE "C"),'') || '}'
      INTO v_object FROM json_each(v_row);
    IF NOT v_first THEN v_result := v_result || ','; END IF;
    v_result := v_result || v_object; v_first := false;
  END LOOP;
  RETURN v_result || ']';
END $$;
REVOKE ALL ON FUNCTION public.backup_generation_canonical_rows(json) FROM PUBLIC, anon, authenticated;

-- Frozen schema-2/scope-7 domain descriptors, derived from backupValidators.ts.
-- Optional really means absent-compatible only for optionalColumnRule; the old
-- nullable rules still require the field to exist. Keep this version frozen.
CREATE FUNCTION public.backup_generation_js_length(p_value text)
RETURNS integer LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path=pg_catalog
AS $$ SELECT COALESCE(sum(CASE WHEN ascii(c)>65535 THEN 2 ELSE 1 END),0)::integer
  FROM regexp_split_to_table(p_value,'') AS t(c) $$;
CREATE FUNCTION public.backup_generation_valid_date(p_value text)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path=pg_catalog
AS $$ SELECT p_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  AND pg_input_is_valid(p_value,'date') $$;
CREATE FUNCTION public.backup_generation_validate_row(p_entity text,p_row jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE STRICT SECURITY INVOKER SET search_path=pg_catalog
AS $validate$
DECLARE
  v_contract constant jsonb := $contract${
"todos":{"columns":["id","title","notes","completed","due_date","priority","sort_order","recurrence","recurrence_id","created_at","updated_at","deleted_at","project_id","goal_id","completed_at"],"fields":{"id":{"nullable":false,"kind":"id"},"title":{"nullable":false,"kind":"string","maxLength":500},"notes":{"nullable":true,"kind":"string","maxLength":10000},"completed":{"nullable":false,"kind":"enum","min":0,"values":[0,1]},"due_date":{"nullable":true,"kind":"string","maxLength":1000},"priority":{"nullable":false,"kind":"enum","values":["urgent","normal","low"]},"sort_order":{"nullable":false,"kind":"integer","min":0},"recurrence":{"nullable":true,"kind":"enum","values":["daily"]},"recurrence_id":{"nullable":true,"kind":"string","maxLength":1000},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"},"deleted_at":{"nullable":true,"kind":"timestamp"},"project_id":{"nullable":true,"kind":"id","optional":true},"goal_id":{"nullable":true,"kind":"id","optional":true},"completed_at":{"nullable":true,"kind":"timestamp","optional":true}}},
"habits":{"columns":["id","name","target_per_day","reminder_time","category","icon","color","rule_history","created_at","updated_at","deleted_at","project_id","goal_id","status","lifecycle_history"],"fields":{"id":{"nullable":false,"kind":"id"},"name":{"nullable":false,"kind":"string","maxLength":300},"target_per_day":{"nullable":false,"kind":"integer","min":1},"reminder_time":{"nullable":true,"kind":"string","maxLength":1000},"category":{"nullable":false,"kind":"enum","values":["anytime","morning","afternoon","evening"]},"icon":{"nullable":false,"kind":"enum","values":["check-circle","favorite","local-drink","menu-book","fitness-center","wb-sunny","bedtime","self-improvement","water-drop","coffee","psychology","spa"]},"color":{"nullable":false,"kind":"string","maxLength":50},"rule_history":{"nullable":false,"kind":"habit_rules","maxLength":50000},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"},"deleted_at":{"nullable":true,"kind":"timestamp"},"project_id":{"nullable":true,"kind":"id","optional":true},"goal_id":{"nullable":true,"kind":"id","optional":true},"status":{"nullable":false,"kind":"enum","values":["active","paused","archived"],"optional":true},"lifecycle_history":{"nullable":true,"kind":"habit_lifecycle","optional":true,"maxLength":50000}}},
"habit_completions":{"columns":["id","habit_id","date_key","count","created_at","updated_at"],"fields":{"id":{"nullable":false,"kind":"id"},"habit_id":{"nullable":false,"kind":"id"},"date_key":{"nullable":false,"kind":"date"},"count":{"nullable":false,"kind":"integer","min":0},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"}}},
"calorie_entries":{"columns":["id","food_name","calories","protein","carbs","fats","fiber","meal_type","consumed_on","created_at","updated_at","deleted_at"],"fields":{"id":{"nullable":false,"kind":"id"},"food_name":{"nullable":false,"kind":"string","maxLength":300},"calories":{"nullable":false,"kind":"integer","min":0},"protein":{"nullable":false,"kind":"number","min":0},"carbs":{"nullable":false,"kind":"number","min":0},"fats":{"nullable":false,"kind":"number","min":0},"fiber":{"nullable":false,"kind":"number","min":0},"meal_type":{"nullable":false,"kind":"enum","values":["breakfast","lunch","dinner","snack"]},"consumed_on":{"nullable":false,"kind":"date"},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"},"deleted_at":{"nullable":true,"kind":"timestamp"}}},
"saved_meals":{"columns":["id","food_name","calories","protein","carbs","fats","fiber","meal_type","use_count","last_used_at","created_at"],"fields":{"id":{"nullable":false,"kind":"id"},"food_name":{"nullable":false,"kind":"string","maxLength":300},"calories":{"nullable":false,"kind":"integer","min":0},"protein":{"nullable":false,"kind":"number","min":0},"carbs":{"nullable":false,"kind":"number","min":0},"fats":{"nullable":false,"kind":"number","min":0},"fiber":{"nullable":false,"kind":"number","min":0},"meal_type":{"nullable":false,"kind":"string","maxLength":1000},"use_count":{"nullable":false,"kind":"integer","min":0},"last_used_at":{"nullable":false,"kind":"timestamp"},"created_at":{"nullable":false,"kind":"timestamp"}}},
"workout_routines":{"columns":["id","name","description","goal_tag","created_at","updated_at","deleted_at"],"fields":{"id":{"nullable":false,"kind":"id"},"name":{"nullable":false,"kind":"string","maxLength":300},"description":{"nullable":true,"kind":"string","maxLength":5000},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"},"deleted_at":{"nullable":true,"kind":"timestamp"},"goal_tag":{"nullable":true,"kind":"string","maxLength":300,"optional":true}}},
"routine_exercises":{"columns":["id","routine_id","name","sort_order","catalog_exercise_id","modality","unilateral","supports_external_load","notes","superset_group","progression_mode","progression_increment","progression_min_reps","progression_max_reps","created_at","updated_at","deleted_at"],"fields":{"id":{"nullable":false,"kind":"id"},"routine_id":{"nullable":false,"kind":"id"},"name":{"nullable":false,"kind":"string","maxLength":300},"sort_order":{"nullable":false,"kind":"integer","min":0},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"},"deleted_at":{"nullable":true,"kind":"timestamp"},"catalog_exercise_id":{"nullable":true,"kind":"string","maxLength":null,"optional":true},"modality":{"nullable":false,"kind":"enum","values":["weighted_strength","bodyweight","timed","cardio"],"optional":true},"unilateral":{"nullable":false,"kind":"enum","values":[0,1],"optional":true},"supports_external_load":{"nullable":false,"kind":"enum","values":[0,1],"optional":true},"notes":{"nullable":true,"kind":"string","maxLength":10000,"optional":true},"superset_group":{"nullable":true,"kind":"string","maxLength":300,"optional":true},"progression_mode":{"nullable":false,"kind":"enum","values":["none","linear","double"],"optional":true},"progression_increment":{"nullable":true,"kind":"number","min":0,"optional":true},"progression_min_reps":{"nullable":true,"kind":"integer","min":1,"optional":true},"progression_max_reps":{"nullable":true,"kind":"integer","min":1,"optional":true}}},
"routine_exercise_sets":{"columns":["id","exercise_id","set_number","active_seconds","rest_seconds","target_reps_min","target_reps_max","target_load","target_duration_seconds","target_distance","target_pace","created_at","updated_at","deleted_at"],"fields":{"id":{"nullable":false,"kind":"id"},"exercise_id":{"nullable":false,"kind":"id"},"set_number":{"nullable":false,"kind":"integer","min":1},"active_seconds":{"nullable":false,"kind":"integer","min":0},"rest_seconds":{"nullable":false,"kind":"integer","min":0},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"},"deleted_at":{"nullable":true,"kind":"timestamp"},"target_reps_min":{"nullable":true,"kind":"integer","min":1,"optional":true},"target_reps_max":{"nullable":true,"kind":"integer","min":1,"optional":true},"target_load":{"nullable":true,"kind":"number","min":0,"optional":true},"target_duration_seconds":{"nullable":true,"kind":"integer","min":0,"optional":true},"target_distance":{"nullable":true,"kind":"number","min":0,"optional":true},"target_pace":{"nullable":true,"kind":"number","min":0,"optional":true}}},
"workout_logs":{"columns":["id","routine_id","notes","completed_at","created_at","started_at","ended_at","duration_seconds","routine_name"],"fields":{"id":{"nullable":false,"kind":"id"},"routine_id":{"nullable":false,"kind":"id"},"notes":{"nullable":true,"kind":"string","maxLength":10000},"completed_at":{"nullable":false,"kind":"timestamp"},"created_at":{"nullable":false,"kind":"timestamp"},"started_at":{"nullable":true,"kind":"timestamp","optional":true},"ended_at":{"nullable":true,"kind":"timestamp","optional":true},"duration_seconds":{"nullable":true,"kind":"integer","min":0,"optional":true},"routine_name":{"nullable":true,"kind":"string","maxLength":300,"optional":true}}},
"workout_session_exercises":{"columns":["id","log_id","exercise_name","sets_completed","catalog_exercise_id","modality","unilateral","supports_external_load","created_at"],"fields":{"id":{"nullable":false,"kind":"id"},"log_id":{"nullable":false,"kind":"id"},"exercise_name":{"nullable":false,"kind":"string","maxLength":300},"sets_completed":{"nullable":false,"kind":"integer","min":0},"created_at":{"nullable":false,"kind":"timestamp"},"catalog_exercise_id":{"nullable":true,"kind":"string","maxLength":null,"optional":true},"modality":{"nullable":false,"kind":"enum","values":["weighted_strength","bodyweight","timed","cardio"],"optional":true},"unilateral":{"nullable":false,"kind":"enum","values":[0,1],"optional":true},"supports_external_load":{"nullable":false,"kind":"enum","values":[0,1],"optional":true}}},
"workout_session_sets":{"columns":["id","session_exercise_id","set_number","weight","reps","weight_unit","completed","duration_seconds","distance","pace","effort_value","effort_scale","created_at"],"fields":{"id":{"nullable":false,"kind":"id"},"session_exercise_id":{"nullable":false,"kind":"id"},"set_number":{"nullable":false,"kind":"integer","min":1},"weight":{"nullable":true,"kind":"number","min":0,"exclusiveMin":false},"reps":{"nullable":true,"kind":"integer","min":0},"weight_unit":{"nullable":true,"kind":"enum","values":["kg","lb"]},"completed":{"nullable":false,"kind":"enum","values":[0,1]},"created_at":{"nullable":false,"kind":"timestamp"},"duration_seconds":{"nullable":true,"kind":"integer","min":0,"optional":true},"distance":{"nullable":true,"kind":"number","min":0,"optional":true},"pace":{"nullable":true,"kind":"number","min":0,"optional":true},"effort_value":{"nullable":true,"kind":"number","min":0,"optional":true},"effort_scale":{"nullable":true,"kind":"enum","values":["rir","rpe"],"optional":true}}},
"pomodoro_sessions":{"columns":["id","started_at","ended_at","duration_seconds","session_type","created_at","linked_todo_id","linked_todo_title","note"],"fields":{"id":{"nullable":false,"kind":"id"},"started_at":{"nullable":false,"kind":"timestamp"},"ended_at":{"nullable":false,"kind":"timestamp"},"duration_seconds":{"nullable":false,"kind":"integer","min":0},"session_type":{"nullable":false,"kind":"enum","values":["focus","break","short_break","long_break"]},"created_at":{"nullable":false,"kind":"timestamp"},"linked_todo_id":{"nullable":true,"kind":"id","optional":true},"linked_todo_title":{"nullable":true,"kind":"string","maxLength":null,"optional":true},"note":{"nullable":true,"kind":"string","maxLength":null,"optional":true}}},
"linked_action_rules":{"columns":["id","status","direction_policy","bidirectional_group_id","source_feature","source_entity_type","source_entity_id","trigger_type","target_feature","target_entity_type","target_entity_id","effect_type","effect_payload","created_at","updated_at","deleted_at"],"fields":{"id":{"nullable":false,"kind":"id"},"status":{"nullable":false,"kind":"enum","values":["active","paused"]},"direction_policy":{"nullable":false,"kind":"enum","values":["one_way","bidirectional_peer"]},"bidirectional_group_id":{"nullable":true,"kind":"string","maxLength":1000},"source_feature":{"nullable":false,"kind":"enum","values":["todos","habits","calories","workout","pomodoro"]},"source_entity_type":{"nullable":false,"kind":"source_entity","mapping":{"todos":["todo"],"habits":["habit"],"calories":["calorie_log"],"workout":["workout_routine"],"pomodoro":["pomodoro_timer"]}},"source_entity_id":{"nullable":true,"kind":"string","maxLength":1000},"trigger_type":{"nullable":false,"kind":"enum","values":["todo.completed","habit.progress_incremented","habit.completed_for_day","calorie.entry_logged","workout.completed","pomodoro.focus_completed"]},"target_feature":{"nullable":false,"kind":"enum","values":["todos","habits","calories","workout","pomodoro"]},"target_entity_type":{"nullable":false,"kind":"target_entity","mapping":{"todos":["todo"],"habits":["habit"],"calories":["calorie_log"],"workout":["workout_routine"],"pomodoro":["pomodoro_session"]}},"target_entity_id":{"nullable":true,"kind":"string","maxLength":1000},"effect_type":{"nullable":false,"kind":"enum","values":["todo.complete","habit.increment","habit.ensure_daily_target","calorie.log","workout.log","pomodoro.log"]},"effect_payload":{"nullable":false,"kind":"object_json","maxLength":50000},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"},"deleted_at":{"nullable":true,"kind":"timestamp"}}},
"weekly_reviews":{"columns":["id","week_key","week_start_date","week_end_date","next_week_start_date","completed_at","status","summary_payload","plan_payload","reflection","created_at","updated_at","deleted_at"],"fields":{"id":{"nullable":false,"kind":"id"},"week_key":{"nullable":false,"kind":"string","maxLength":1000},"week_start_date":{"nullable":false,"kind":"string","maxLength":1000},"week_end_date":{"nullable":false,"kind":"string","maxLength":1000},"next_week_start_date":{"nullable":false,"kind":"string","maxLength":1000},"completed_at":{"nullable":true,"kind":"timestamp"},"status":{"nullable":false,"kind":"enum","values":["draft","completed"]},"summary_payload":{"nullable":false,"kind":"string","maxLength":1000},"plan_payload":{"nullable":false,"kind":"string","maxLength":1000},"reflection":{"nullable":false,"kind":"string","maxLength":1000},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"},"deleted_at":{"nullable":true,"kind":"timestamp"}}},
"projects":{"columns":["id","name","description","color","status","target_date","sort_order","created_at","updated_at","deleted_at","completed_at"],"fields":{"id":{"nullable":false,"kind":"id"},"name":{"nullable":false,"kind":"string","maxLength":300},"description":{"nullable":true,"kind":"string","maxLength":5000},"color":{"nullable":false,"kind":"string","maxLength":50},"status":{"nullable":false,"kind":"enum","values":["active","paused","completed","archived"]},"target_date":{"nullable":true,"kind":"date"},"sort_order":{"nullable":false,"kind":"integer","min":0},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"},"deleted_at":{"nullable":true,"kind":"timestamp"},"completed_at":{"nullable":true,"kind":"timestamp"}}},
"goals":{"columns":["id","project_id","title","description","horizon","target_date","status","progress_percent","created_at","updated_at","deleted_at","completed_at"],"fields":{"id":{"nullable":false,"kind":"id"},"project_id":{"nullable":true,"kind":"id","optional":true},"title":{"nullable":false,"kind":"string","maxLength":500},"description":{"nullable":true,"kind":"string","maxLength":5000},"horizon":{"nullable":false,"kind":"enum","values":["week","month","quarter","year","custom"]},"target_date":{"nullable":true,"kind":"date"},"status":{"nullable":false,"kind":"enum","values":["active","paused","completed","archived"]},"progress_percent":{"nullable":false,"kind":"integer","min":0},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"},"deleted_at":{"nullable":true,"kind":"timestamp"},"completed_at":{"nullable":true,"kind":"timestamp"}}},
"daily_plans":{"columns":["id","date_key","intention","top_todo_ids","top_todo_titles","focus_target_minutes","notes","reflection","energy_score","status","created_at","updated_at","deleted_at","completed_at"],"fields":{"id":{"nullable":false,"kind":"id"},"date_key":{"nullable":false,"kind":"date"},"intention":{"nullable":true,"kind":"string","maxLength":1000},"top_todo_ids":{"nullable":false,"kind":"string","maxLength":1000},"top_todo_titles":{"nullable":true,"kind":"string","maxLength":1000,"optional":true},"focus_target_minutes":{"nullable":false,"kind":"integer","min":0},"notes":{"nullable":true,"kind":"string","maxLength":10000},"reflection":{"nullable":true,"kind":"string","maxLength":1000},"energy_score":{"nullable":true,"kind":"integer","min":0},"status":{"nullable":false,"kind":"enum","values":["draft","committed","completed"]},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"},"deleted_at":{"nullable":true,"kind":"timestamp"},"completed_at":{"nullable":true,"kind":"timestamp"}}},
"custom_exercises":{"columns":["id","name","description","aliases","instructions","primary_area","secondary_areas","equipment","modality","unilateral","supports_external_load","created_at","updated_at","deleted_at"],"fields":{"id":{"nullable":false,"kind":"id"},"name":{"nullable":false,"kind":"string","maxLength":300},"description":{"nullable":true,"kind":"string","maxLength":5000},"aliases":{"nullable":true,"kind":"string_array_json","maxLength":5000,"optional":true},"instructions":{"nullable":true,"kind":"string","maxLength":1000,"optional":true},"primary_area":{"nullable":false,"kind":"string","maxLength":1000},"secondary_areas":{"nullable":false,"kind":"string_array_json","maxLength":5000},"equipment":{"nullable":true,"kind":"string","maxLength":1000},"modality":{"nullable":false,"kind":"enum","values":["weighted_strength","bodyweight","timed","cardio"]},"unilateral":{"nullable":false,"kind":"enum","values":[0,1]},"supports_external_load":{"nullable":false,"kind":"enum","values":[0,1],"optional":true},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"},"deleted_at":{"nullable":true,"kind":"timestamp"}}},
"workout_weekly_plan":{"columns":["id","weekday","routine_id","plan_kind","note","created_at","updated_at","deleted_at"],"fields":{"id":{"nullable":false,"kind":"id"},"weekday":{"nullable":false,"kind":"integer","min":1,"max":7},"routine_id":{"nullable":true,"kind":"id"},"plan_kind":{"nullable":false,"kind":"enum","values":["workout","rest"]},"note":{"nullable":true,"kind":"string","maxLength":500},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"},"deleted_at":{"nullable":true,"kind":"timestamp"}}},
"workout_schedule_overrides":{"columns":["id","date_key","override_kind","routine_id","moved_from_date_key","note","created_at","updated_at","deleted_at"],"fields":{"id":{"nullable":false,"kind":"id"},"date_key":{"nullable":false,"kind":"date"},"override_kind":{"nullable":false,"kind":"enum","values":["workout","rest"]},"routine_id":{"nullable":true,"kind":"id"},"moved_from_date_key":{"nullable":true,"kind":"date"},"note":{"nullable":true,"kind":"string","maxLength":500},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"},"deleted_at":{"nullable":true,"kind":"timestamp"}}},
"body_weight_entries":{"columns":["id","measured_on","measured_at","weight","unit","note","created_at","updated_at","deleted_at"],"fields":{"id":{"nullable":false,"kind":"id"},"measured_on":{"nullable":false,"kind":"date"},"measured_at":{"nullable":false,"kind":"timestamp"},"weight":{"nullable":false,"kind":"number","min":0,"exclusiveMin":true},"unit":{"nullable":false,"kind":"enum","values":["kg","lb"]},"note":{"nullable":true,"kind":"string","maxLength":500},"created_at":{"nullable":false,"kind":"timestamp"},"updated_at":{"nullable":false,"kind":"timestamp"},"deleted_at":{"nullable":true,"kind":"timestamp"}}}
}$contract$::jsonb;
  v_spec jsonb := v_contract->p_entity; v_field text; v_rule jsonb; v_value jsonb;
  v_kind text; v_text text; v_valid boolean; v_json jsonb; v_item jsonb; v_day jsonb;
BEGIN
  IF v_spec IS NULL OR jsonb_typeof(p_row) <> 'object' THEN
    RAISE EXCEPTION 'unknown entity or non-object recovery row %',p_entity USING ERRCODE='23514';
  END IF;
  FOR v_field IN SELECT jsonb_object_keys(p_row) LOOP
    IF v_field<>'user_id' AND NOT(v_spec->'columns' ? v_field) THEN
      RAISE EXCEPTION 'unknown recovery column %.%',p_entity,v_field USING ERRCODE='23514';
    END IF;
  END LOOP;
  FOR v_field,v_rule IN SELECT key,value FROM jsonb_each(v_spec->'fields') LOOP
    IF NOT(p_row ? v_field) THEN
      IF COALESCE((v_rule->>'optional')::boolean,false) THEN CONTINUE; END IF;
      RAISE EXCEPTION 'required recovery field %.% missing',p_entity,v_field USING ERRCODE='23514';
    END IF;
    v_value:=p_row->v_field; v_kind:=v_rule->>'kind'; v_text:=p_row->>v_field;
    IF v_value='null'::jsonb AND COALESCE((v_rule->>'nullable')::boolean,false) THEN CONTINUE; END IF;
    v_valid:=false;
    IF v_kind='id' THEN
      v_valid:=jsonb_typeof(v_value)='string' AND v_text ~ '^[a-z0-9]+_[0-9]+(_[a-z0-9]+)?$'
        AND public.backup_generation_js_length(v_text)<=100;
    ELSIF v_kind='string' THEN
      v_valid:=jsonb_typeof(v_value)='string' AND (v_rule->>'maxLength' IS NULL
        OR public.backup_generation_js_length(v_text)<=(v_rule->>'maxLength')::integer);
    ELSIF v_kind IN ('number','integer') THEN
      IF jsonb_typeof(v_value)='number' THEN
        v_valid:=abs(v_text::numeric)<=1.7976931348623157e308 AND (v_kind<>'integer' OR (v_text::numeric=trunc(v_text::numeric)))
          AND (v_rule->>'min' IS NULL OR v_text::numeric>=(v_rule->>'min')::numeric)
          AND (v_rule->>'max' IS NULL OR v_text::numeric<=(v_rule->>'max')::numeric)
          AND (NOT COALESCE((v_rule->>'exclusiveMin')::boolean,false)
            OR v_text::numeric>(v_rule->>'min')::numeric);
      END IF;
    ELSIF v_kind='enum' THEN
      v_valid:=(v_rule->'values') @> jsonb_build_array(v_value);
    ELSIF v_kind='timestamp' THEN
      -- Stored timestamps are ISO; PostgreSQL relative/time-only forms are not JS restore timestamps.
      v_valid:=jsonb_typeof(v_value)='string' AND v_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([Tt ][0-9]{2}:[0-9]{2}(:[0-5][0-9]([.][0-9]+)?)?([Zz]|[+-][0-9]{2}(:?[0-9]{2})?)?)?$'
        AND pg_input_is_valid(v_text,'timestamp with time zone')
        AND lower(v_text) NOT IN ('infinity','-infinity');
    ELSIF v_kind='date' THEN
      v_valid:=jsonb_typeof(v_value)='string' AND public.backup_generation_valid_date(v_text);
    ELSIF v_kind IN ('source_entity','target_entity') THEN
      v_valid:=COALESCE((v_rule->'mapping'->(p_row->>CASE WHEN v_kind='source_entity'
        THEN 'source_feature' ELSE 'target_feature' END)) @> jsonb_build_array(v_value),false);
    ELSIF v_kind IN ('string_array_json','object_json','habit_rules','habit_lifecycle') THEN
      IF jsonb_typeof(v_value)='string'
        AND public.backup_generation_js_length(v_text)<=(v_rule->>'maxLength')::integer THEN
        BEGIN v_json:=v_text::jsonb; EXCEPTION WHEN OTHERS THEN v_json:=NULL; END;
        IF v_kind='object_json' THEN v_valid:=jsonb_typeof(v_json)='object';
        ELSIF jsonb_typeof(v_json)='array' THEN
          v_valid:=true;
          FOR v_item IN SELECT value FROM jsonb_array_elements(v_json) LOOP
            IF v_kind='string_array_json' THEN
              IF jsonb_typeof(v_item)<>'string' OR public.backup_generation_js_length(v_item#>>'{}')>100 THEN v_valid:=false; END IF;
            ELSIF jsonb_typeof(v_item)<>'object' THEN v_valid:=false;
            ELSIF v_kind='habit_rules' THEN
              IF NOT COALESCE(public.backup_generation_valid_date(v_item->>'effective_from_date'),false)
                OR jsonb_typeof(v_item->'weekdays') IS DISTINCT FROM 'array'
                OR jsonb_typeof(v_item->'target_per_day') IS DISTINCT FROM 'number'
                OR COALESCE(v_item->>'target_per_day','') !~ '^[1-9][0-9]*$' THEN v_valid:=false;
              ELSE
                FOR v_day IN SELECT value FROM jsonb_array_elements(v_item->'weekdays') LOOP
                  IF jsonb_typeof(v_day)<>'number' OR v_day::text !~ '^[1-7]$' THEN v_valid:=false; END IF;
                END LOOP;
              END IF;
            ELSE
              IF v_item->>'status' IS NULL OR NOT(v_item->>'status'=ANY(ARRAY['paused','archived']))
                OR NOT COALESCE(public.backup_generation_valid_date(v_item->>'from_date_key'),false)
                OR NOT(v_item ? 'to_date_key')
                OR (v_item->'to_date_key'<>'null'::jsonb AND NOT COALESCE(public.backup_generation_valid_date(v_item->>'to_date_key'),false)) THEN v_valid:=false; END IF;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END IF;
    IF NOT COALESCE(v_valid,false) THEN
      RAISE EXCEPTION 'invalid recovery field %.% (%)',p_entity,v_field,v_kind USING ERRCODE='23514';
    END IF;
  END LOOP;
END $validate$;
REVOKE ALL ON FUNCTION public.backup_generation_js_length(text),
  public.backup_generation_valid_date(text),public.backup_generation_validate_row(text,jsonb)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.publish_backup_generation(
  p_snapshot_id text, p_expected_previous_sequence bigint,
  p_expected_chunk_count integer, p_manifest_checksum text
)
RETURNS public.backup_generation_head LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  v_owner uuid := (SELECT auth.uid()); v_generation public.backup_generation;
  v_head public.backup_generation_head; v_manifest jsonb; v_entity text;
  v_entities constant text[] := ARRAY['todos','habits','habit_completions','calorie_entries',
    'saved_meals','workout_routines','routine_exercises','routine_exercise_sets','workout_logs',
    'workout_session_exercises','pomodoro_sessions','linked_action_rules','weekly_reviews',
    'projects','goals','daily_plans','workout_session_sets','custom_exercises',
    'workout_weekly_plan','workout_schedule_overrides','body_weight_entries'];
  v_chunk record; v_expected_rows bigint; v_rows bigint; v_ordinal integer;
  v_total_chunks integer := 0; v_combined text; v_canonical text; v_last_id text;
  v_row json; v_row_id text; v_payload json; v_graph jsonb := '{}'::jsonb;
  v_relation record; v_source jsonb; v_target text; v_settings jsonb;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'publication requires an authenticated owner' USING ERRCODE='42501';
  END IF;
  IF p_expected_previous_sequence IS NULL OR p_expected_previous_sequence < 0
    OR p_expected_chunk_count IS NULL OR p_expected_chunk_count < 1 THEN
    RAISE EXCEPTION 'invalid publication precondition' USING ERRCODE='23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('superhabits.backup:' || v_owner::text,0));
  SELECT * INTO v_generation FROM public.backup_generation
    WHERE user_id=v_owner AND snapshot_id=p_snapshot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'generation does not exist for this owner' USING ERRCODE='P0002'; END IF;
  IF ROW(v_generation.protocol_version,v_generation.backup_schema_version,
    v_generation.scope_version,v_generation.settings_version) IS DISTINCT FROM ROW(1,2,7,5) THEN
    RAISE EXCEPTION 'unsupported generation scope' USING ERRCODE='23514';
  END IF;
  IF encode(sha256(convert_to(v_generation.manifest,'UTF8')),'hex')
      IS DISTINCT FROM v_generation.manifest_checksum
    OR p_manifest_checksum IS DISTINCT FROM v_generation.manifest_checksum THEN
    RAISE EXCEPTION 'manifest bytes checksum mismatch' USING ERRCODE='23514';
  END IF;
  IF public.backup_generation_canonical_rows(v_generation.manifest::json) <> v_generation.manifest THEN
    RAISE EXCEPTION 'manifest envelope is not canonical' USING ERRCODE='23514';
  END IF;
  v_manifest := v_generation.manifest::jsonb;
  IF jsonb_typeof(v_manifest) <> 'array' OR jsonb_array_length(v_manifest) <> 1
    OR jsonb_typeof(v_manifest->0) <> 'object' THEN
    RAISE EXCEPTION 'invalid generation manifest envelope' USING ERRCODE='23514';
  END IF;
  v_manifest := v_manifest->0;
  IF (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(v_manifest) AS k(key))
    IS DISTINCT FROM ARRAY['backupSchemaVersion','capturedAt','entities','protocolVersion',
      'scopeVersion','sequence','settingsChecksum','settingsVersion','snapshotId']::text[]
    OR v_manifest->'protocolVersion' IS DISTINCT FROM '1'::jsonb
    OR v_manifest->'backupSchemaVersion' IS DISTINCT FROM '2'::jsonb
    OR v_manifest->'scopeVersion' IS DISTINCT FROM '7'::jsonb
    OR v_manifest->'settingsVersion' IS DISTINCT FROM '5'::jsonb
    OR v_manifest->'sequence' IS DISTINCT FROM to_jsonb(v_generation.sequence)
    OR v_manifest->>'snapshotId' IS DISTINCT FROM v_generation.snapshot_id
    OR (v_manifest->>'capturedAt')::timestamptz IS DISTINCT FROM v_generation.captured_at
    OR jsonb_typeof(v_manifest->'entities') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'manifest metadata does not match generation' USING ERRCODE='23514';
  END IF;
  IF (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(v_manifest->'entities') AS k(key))
    IS DISTINCT FROM (SELECT array_agg(e ORDER BY e) FROM unnest(v_entities || ARRAY['user_backup_settings']) AS t(e)) THEN
    RAISE EXCEPTION 'manifest entity scope is incomplete or unknown' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM public.backup_generation_chunk WHERE user_id=v_owner AND snapshot_id=p_snapshot_id
    AND NOT(entity=ANY(v_entities || ARRAY['user_backup_settings']))) THEN
    RAISE EXCEPTION 'unknown generation chunk entity' USING ERRCODE='23514';
  END IF;
  FOREACH v_entity IN ARRAY v_entities LOOP
    IF jsonb_typeof(v_manifest->'entities'->v_entity) IS DISTINCT FROM 'object'
      OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(v_manifest->'entities'->v_entity) AS k(key))
        IS DISTINCT FROM ARRAY['checksum','rows']::text[]
      OR jsonb_typeof(v_manifest->'entities'->v_entity->'rows') IS DISTINCT FROM 'number'
      OR (v_manifest->'entities'->v_entity->>'rows') !~ '^(0|[1-9][0-9]*)$'
      OR (v_manifest->'entities'->v_entity->>'checksum') !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'invalid manifest entity description %',v_entity USING ERRCODE='23514';
    END IF;
    v_expected_rows := (v_manifest->'entities'->v_entity->>'rows')::bigint;
    v_rows := 0; v_ordinal := 0; v_combined := '['; v_last_id := NULL;
    FOR v_chunk IN SELECT * FROM public.backup_generation_chunk
      WHERE user_id=v_owner AND snapshot_id=p_snapshot_id AND entity=v_entity ORDER BY ordinal LOOP
      IF v_chunk.ordinal <> v_ordinal OR encode(sha256(convert_to(v_chunk.payload,'UTF8')),'hex') <> v_chunk.checksum
        OR octet_length(convert_to(v_chunk.payload,'UTF8')) > 131072 THEN
        RAISE EXCEPTION 'chunk ordinal, checksum or byte budget mismatch for %',v_entity USING ERRCODE='23514';
      END IF;
      v_payload := v_chunk.payload::json;
      v_canonical := public.backup_generation_canonical_rows(v_payload);
      IF v_canonical <> v_chunk.payload OR json_array_length(v_payload) NOT BETWEEN 1 AND 250
        OR json_array_length(v_payload) > v_expected_rows-v_rows THEN
        RAISE EXCEPTION 'invalid canonical bounded chunk for %',v_entity USING ERRCODE='23514';
      END IF;
      FOR v_row IN SELECT value FROM json_array_elements(v_payload) LOOP
        v_row_id := v_row->>'id';
        IF json_typeof(v_row->'id') IS DISTINCT FROM 'string' OR length(v_row_id)=0
          OR (v_last_id IS NOT NULL AND v_row_id COLLATE "C" <= v_last_id COLLATE "C") THEN
          RAISE EXCEPTION 'missing, duplicate or unordered entity identity for %',v_entity USING ERRCODE='23514';
        END IF;
        PERFORM public.backup_generation_validate_row(v_entity,v_row::jsonb);
        v_last_id := v_row_id;
      END LOOP;
      IF v_ordinal > 0 THEN v_combined := v_combined || ','; END IF;
      v_combined := v_combined || substring(v_canonical FROM 2 FOR length(v_canonical)-2);
      v_rows := v_rows + json_array_length(v_payload);
      v_ordinal := v_ordinal+1; v_total_chunks := v_total_chunks+1;
    END LOOP;
    v_combined := v_combined || ']';
    IF v_rows <> v_expected_rows OR encode(sha256(convert_to(v_combined,'UTF8')),'hex')
      IS DISTINCT FROM v_manifest->'entities'->v_entity->>'checksum' THEN
      RAISE EXCEPTION 'entity row count or checksum mismatch for %',v_entity USING ERRCODE='23514';
    END IF;
    v_graph := v_graph || jsonb_build_object(v_entity,v_combined::jsonb);
  END LOOP;
  SELECT * INTO v_chunk FROM public.backup_generation_chunk
    WHERE user_id=v_owner AND snapshot_id=p_snapshot_id AND entity='user_backup_settings' AND ordinal=0;
  IF NOT FOUND THEN RAISE EXCEPTION 'settings chunk is missing' USING ERRCODE='23514'; END IF;
  v_settings := v_chunk.payload::jsonb;
  IF jsonb_typeof(v_settings) <> 'object'
    OR octet_length(convert_to(v_chunk.payload,'UTF8')) > 131072
    OR EXISTS(SELECT 1 FROM unnest(ARRAY['calorieGoal','pomodoroSettings','theme','workoutPreferences']) AS f(key)
      WHERE v_settings ? key AND jsonb_typeof(v_settings->key) NOT IN ('object','array','null'))
    OR (SELECT count(*) FROM public.backup_generation_chunk
      WHERE user_id=v_owner AND snapshot_id=p_snapshot_id AND entity='user_backup_settings') <> 1
    OR encode(sha256(convert_to(v_chunk.payload,'UTF8')),'hex') IS DISTINCT FROM v_chunk.checksum
    OR v_chunk.checksum IS DISTINCT FROM v_manifest->>'settingsChecksum'
    OR v_manifest->'entities'->'user_backup_settings' IS DISTINCT FROM
      jsonb_build_object('rows',1,'checksum',v_chunk.checksum) THEN
    RAISE EXCEPTION 'settings payload integrity mismatch' USING ERRCODE='23514';
  END IF;
  v_total_chunks := v_total_chunks+1;
  IF v_total_chunks <> p_expected_chunk_count THEN
    RAISE EXCEPTION 'publication chunk count mismatch' USING ERRCODE='23514';
  END IF;

  -- Relationship integrity uses the same retained-parent semantics as Restore
  -- V2: tombstones are valid parents, missing parents are not.
  FOR v_relation IN SELECT * FROM (VALUES
    ('habit_completions','habit_id','habits',false),
    ('routine_exercises','routine_id','workout_routines',false),
    ('routine_exercise_sets','exercise_id','routine_exercises',false),
    ('workout_logs','routine_id','workout_routines',false),
    ('workout_session_exercises','log_id','workout_logs',false),
    ('workout_session_sets','session_exercise_id','workout_session_exercises',false),
    ('workout_weekly_plan','routine_id','workout_routines',true),
    ('workout_schedule_overrides','routine_id','workout_routines',true),
    ('todos','project_id','projects',true),('todos','goal_id','goals',true),
    ('goals','project_id','projects',true),('habits','project_id','projects',true),
    ('habits','goal_id','goals',true)
  ) AS r(entity,column_name,target,optional) LOOP
    FOR v_source IN SELECT value FROM jsonb_array_elements(v_graph->v_relation.entity) LOOP
      v_target := v_source->>v_relation.column_name;
      IF v_relation.optional AND COALESCE(v_target,'')='' THEN CONTINUE; END IF;
      IF v_target IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_graph->v_relation.target) AS t(value)
        WHERE value->>'id'=v_target) THEN
        RAISE EXCEPTION 'missing parent %.% -> %',v_relation.entity,v_relation.column_name,v_relation.target USING ERRCODE='23514';
      END IF;
    END LOOP;
  END LOOP;

  -- Mirror Restore V2's remaining graph/unique-key constraints before advancing
  -- the authoritative head. A checksummed but unimportable generation is unsafe.
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_graph->'habit_completions') AS t(value)
    GROUP BY value->>'habit_id',value->>'date_key' HAVING count(*)>1)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_graph->'saved_meals') AS t(value)
      GROUP BY lower(value->>'food_name') HAVING count(*)>1)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_graph->'workout_weekly_plan') AS t(value)
      WHERE COALESCE(value->'deleted_at','null'::jsonb)='null'::jsonb
      GROUP BY value->>'weekday' HAVING count(*)>1)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_graph->'workout_schedule_overrides') AS t(value)
      WHERE COALESCE(value->'deleted_at','null'::jsonb)='null'::jsonb
      GROUP BY value->>'date_key' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'duplicate recovery unique key' USING ERRCODE='23514';
  END IF;
  FOR v_source IN SELECT value FROM jsonb_array_elements(v_graph->'routine_exercises') LOOP
    v_target:=v_source->>'catalog_exercise_id';
    IF v_target IS NOT NULL AND v_target !~ '^builtin_[a-z0-9_]+$'
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_graph->'custom_exercises') AS t(value)
        WHERE value->>'id'=v_target) THEN
      RAISE EXCEPTION 'missing custom catalog exercise' USING ERRCODE='23514';
    END IF;
  END LOOP;
  FOR v_source IN SELECT value FROM jsonb_array_elements(v_graph->'daily_plans') LOOP
    BEGIN v_settings:=(v_source->>'top_todo_ids')::jsonb; EXCEPTION WHEN OTHERS THEN v_settings:=NULL; END;
    IF jsonb_typeof(v_settings)='array' THEN
      FOR v_row IN SELECT value::json FROM jsonb_array_elements(v_settings) LOOP
        IF json_typeof(v_row)='string' AND NOT EXISTS(
          SELECT 1 FROM jsonb_array_elements(v_graph->'todos') AS t(value) WHERE value->>'id'=v_row#>>'{}') THEN
          RAISE EXCEPTION 'daily plan references missing todo' USING ERRCODE='23514';
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  SELECT * INTO v_head FROM public.backup_generation_head WHERE user_id=v_owner;
  IF FOUND THEN
    IF v_generation.sequence=v_head.sequence AND v_head.snapshot_id=p_snapshot_id THEN RETURN v_head; END IF;
    IF v_generation.sequence<=v_head.sequence THEN RAISE EXCEPTION 'generation is stale' USING ERRCODE='23514'; END IF;
    IF v_head.sequence<>p_expected_previous_sequence THEN
      RAISE EXCEPTION 'head advanced concurrently' USING ERRCODE='40001';
    END IF;
  ELSIF p_expected_previous_sequence<>0 THEN
    RAISE EXCEPTION 'expected previous head does not exist' USING ERRCODE='40001';
  END IF;
  INSERT INTO public.backup_generation_publication(user_id,snapshot_id,sequence)
    VALUES(v_owner,p_snapshot_id,v_generation.sequence) ON CONFLICT DO NOTHING;
  INSERT INTO public.backup_generation_head(user_id,snapshot_id,sequence)
    VALUES(v_owner,p_snapshot_id,v_generation.sequence)
    ON CONFLICT(user_id) DO UPDATE SET snapshot_id=EXCLUDED.snapshot_id,
      sequence=EXCLUDED.sequence,updated_at=now() RETURNING * INTO v_head;
  RETURN v_head;
END $$;
REVOKE ALL ON FUNCTION public.publish_backup_generation(text,bigint,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_backup_generation(text,bigint,integer,text) TO authenticated;

-- Trigger/helper entrypoints are not public RPCs. Trigger execution itself does
-- not require caller EXECUTE; only the two narrow owner RPCs above are exposed.
REVOKE ALL ON FUNCTION public.backup_generation_require_reservation(),
  public.backup_generation_chunk_insert_guard(),public.backup_generation_immutable(),
  public.backup_generation_chunk_immutable() FROM PUBLIC,anon,authenticated;
COMMIT;
