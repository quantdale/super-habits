-- Durable per-user quota for paid Edge Function model calls.
-- The table is intentionally private to service_role; clients can never
-- choose their own user id or reset their usage through PostgREST.

CREATE TABLE IF NOT EXISTS public.ai_request_quota (
  user_id          UUID NOT NULL,
  request_class    TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, request_class),
  CONSTRAINT ai_request_quota_class_format CHECK (request_class ~ '^[a-z_]+$'),
  CONSTRAINT ai_request_quota_count_nonnegative CHECK (request_count >= 0)
);

ALTER TABLE public.ai_request_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_request_quota FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_request_quota TO service_role;

CREATE OR REPLACE FUNCTION public.consume_ai_request_quota(
  p_user_id UUID,
  p_request_class TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  retry_after_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_started_at TIMESTAMPTZ;
  v_count INTEGER;
  v_window_end TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL
     OR p_request_class IS NULL
     OR p_request_class !~ '^[a-z_]+$'
     OR p_limit < 1
     OR p_window_seconds < 1
     OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid AI quota arguments';
  END IF;

  INSERT INTO public.ai_request_quota (
    user_id, request_class, window_started_at, request_count
  )
  VALUES (p_user_id, p_request_class, v_now, 1)
  ON CONFLICT (user_id, request_class) DO UPDATE
  SET window_started_at = CASE
        WHEN v_now >= public.ai_request_quota.window_started_at
          + (p_window_seconds * INTERVAL '1 second')
        THEN v_now
        ELSE public.ai_request_quota.window_started_at
      END,
      request_count = CASE
        WHEN v_now >= public.ai_request_quota.window_started_at
          + (p_window_seconds * INTERVAL '1 second')
        THEN 1
        ELSE public.ai_request_quota.request_count + 1
      END
  RETURNING ai_request_quota.window_started_at, ai_request_quota.request_count
    INTO v_started_at, v_count;

  v_window_end := v_started_at + (p_window_seconds * INTERVAL '1 second');
  RETURN QUERY
  SELECT
    v_count <= p_limit,
    GREATEST(p_limit - v_count, 0),
    CASE
      WHEN v_count <= p_limit THEN 0
      ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_window_end - v_now)))::INTEGER)
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_request_quota(UUID, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_request_quota(UUID, TEXT, INTEGER, INTEGER)
  TO service_role;
