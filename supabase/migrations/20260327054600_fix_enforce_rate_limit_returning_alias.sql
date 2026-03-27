-- Fix RETURNING alias in enforce_rate_limit to avoid runtime SQL errors.
CREATE OR REPLACE FUNCTION public.enforce_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF p_key IS NULL OR length(btrim(p_key)) = 0 THEN
    RAISE EXCEPTION 'p_key is required';
  END IF;
  IF p_limit <= 0 THEN
    RAISE EXCEPTION 'p_limit must be > 0';
  END IF;
  IF p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'p_window_seconds must be > 0';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.edge_rate_limits AS rl (key, window_start, request_count, updated_at)
  VALUES (p_key, v_window_start, 1, v_now)
  ON CONFLICT (key) DO UPDATE SET
    window_start = CASE
      WHEN rl.window_start = EXCLUDED.window_start THEN rl.window_start
      ELSE EXCLUDED.window_start
    END,
    request_count = CASE
      WHEN rl.window_start = EXCLUDED.window_start THEN rl.request_count + 1
      ELSE 1
    END,
    updated_at = v_now
  RETURNING rl.request_count INTO v_count;

  RETURN QUERY
  SELECT
    (v_count <= p_limit) AS allowed,
    GREATEST(p_limit - v_count, 0) AS remaining,
    v_window_start + (p_window_seconds || ' seconds')::interval AS reset_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_rate_limit(text, integer, integer) TO service_role;
