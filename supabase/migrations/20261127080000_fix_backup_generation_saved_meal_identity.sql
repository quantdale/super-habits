-- Align immutable saved-meal uniqueness with SQLite's ASCII-only NOCASE.
-- Keep the Scope 7–10 verifier and its private RPC privileges in place.
BEGIN;

CREATE OR REPLACE FUNCTION public.backup_generation_publish_v1(
  p_snapshot_id text, p_expected_previous_sequence bigint,
  p_expected_chunk_count integer, p_manifest_checksum text
)
RETURNS public.backup_generation_head LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  v_owner uuid := (SELECT auth.uid()); v_generation public.backup_generation;
  v_head public.backup_generation_head; v_manifest jsonb; v_entity text;
  v_entities text[] := ARRAY['todos','habits','habit_completions','calorie_entries',
    'saved_meals','workout_routines','routine_exercises','routine_exercise_sets','workout_logs',
    'workout_session_exercises','pomodoro_sessions','linked_action_rules','weekly_reviews',
    'projects','goals','daily_plans','workout_session_sets','custom_exercises',
    'workout_weekly_plan','workout_schedule_overrides','body_weight_entries'];
  v_reward_entities constant text[] := ARRAY['gamification_events','gamification_streak_freezes',
    'gamification_quests','gamification_badges'];
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
  IF ROW(v_generation.protocol_version,v_generation.backup_schema_version,v_generation.settings_version) IS DISTINCT FROM ROW(1,2,5)
    OR v_generation.scope_version NOT IN (7,8,9,10) THEN
    RAISE EXCEPTION 'unsupported generation scope' USING ERRCODE='23514';
  END IF;
  IF v_generation.scope_version >= 8 THEN
    v_entities := array_append(v_entities, 'todo_recurrence_series');
  END IF;
  IF v_generation.scope_version = 10 THEN
    v_entities := v_entities || v_reward_entities;
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
    OR v_manifest->'scopeVersion' IS DISTINCT FROM to_jsonb(v_generation.scope_version)
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
        IF v_generation.scope_version = 7 AND v_entity = 'todos'
          AND v_row::jsonb ?| ARRAY['recurrence_date_key','recurrence_touched'] THEN
          RAISE EXCEPTION 'scope 7 cannot certify scope 8 occurrence metadata' USING ERRCODE='23514';
        END IF;
        IF v_generation.scope_version < 9 AND v_entity = 'todos'
          AND v_row::jsonb ? 'recurrence_spawned_by_id' THEN
          RAISE EXCEPTION 'historical scope cannot certify scope 9 completion provenance' USING ERRCODE='23514';
        END IF;
        IF v_entity = ANY(v_reward_entities) THEN
          PERFORM public.backup_generation_validate_reward_row(v_entity,v_row::jsonb);
        ELSE
          PERFORM public.backup_generation_validate_row(v_entity,v_row::jsonb);
        END IF;
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

  IF v_generation.scope_version >= 8 THEN
    FOR v_source IN SELECT value FROM jsonb_array_elements(v_graph->'todos') LOOP
      IF v_source->>'recurrence' = 'daily' AND COALESCE(v_source->>'recurrence_id','') <> ''
        AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_graph->'todo_recurrence_series') AS s(value)
          WHERE value->>'id' = v_source->>'recurrence_id') THEN
        RAISE EXCEPTION 'missing recurring-series parent' USING ERRCODE='23514';
      END IF;
    END LOOP;
  END IF;

  IF v_generation.scope_version >= 9 THEN
    FOR v_source IN SELECT value FROM jsonb_array_elements(v_graph->'todos') LOOP
      v_target := v_source->>'recurrence_spawned_by_id';
      IF v_target IS NOT NULL AND (v_target = v_source->>'id' OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_graph->'todos') AS t(value) WHERE value->>'id'=v_target
      )) THEN
        RAISE EXCEPTION 'missing or self completion-spawn parent' USING ERRCODE='23514';
      END IF;
    END LOOP;
  END IF;

  -- Mirror Restore V2's remaining graph/unique-key constraints before advancing
  -- the authoritative head. A checksummed but unimportable generation is unsafe.
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_graph->'gamification_events') AS t(value)
    GROUP BY value->>'event_kind',value->>'source_key' HAVING count(*)>1)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_graph->'habit_completions') AS t(value)
    GROUP BY value->>'habit_id',value->>'date_key' HAVING count(*)>1)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_graph->'saved_meals') AS t(value)
      GROUP BY translate(value->>'food_name', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')
      HAVING count(*)>1)
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

REVOKE ALL ON FUNCTION public.backup_generation_publish_v1(text,bigint,integer,text)
  FROM PUBLIC, anon, authenticated;

COMMIT;
