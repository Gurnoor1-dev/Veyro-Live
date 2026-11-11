-- Enforce the Infinite Flight staff-approved 20 PublicApi v3 requests/minute
-- allowance across all VEYRO Edge Function instances with an atomic rolling window.
CREATE TABLE IF NOT EXISTS private.if_api_request_events (
  id bigint generated always as identity primary key,
  requested_at timestamptz not null default clock_timestamp()
);
CREATE INDEX IF NOT EXISTS if_api_request_events_requested_at_idx
  ON private.if_api_request_events(requested_at);

CREATE TABLE IF NOT EXISTS private.if_api_rate_limit_lock (
  id boolean primary key default true check (id),
  touched_at timestamptz not null default clock_timestamp()
);
INSERT INTO private.if_api_rate_limit_lock(id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.consume_if_api_request()
RETURNS TABLE(allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_count integer;
  oldest_request timestamptz;
  current_time timestamptz := clock_timestamp();
BEGIN
  UPDATE private.if_api_rate_limit_lock SET touched_at = current_time WHERE id = true;
  DELETE FROM private.if_api_request_events WHERE requested_at <= current_time - interval '2 minutes';
  SELECT count(*), min(requested_at) INTO request_count, oldest_request
    FROM private.if_api_request_events
    WHERE requested_at > current_time - interval '1 minute';
  IF request_count >= 20 THEN
    RETURN QUERY SELECT false,
      greatest(1, ceil(extract(epoch FROM (oldest_request + interval '1 minute' - current_time)))::integer);
    RETURN;
  END IF;
  INSERT INTO private.if_api_request_events(requested_at) VALUES (current_time);
  RETURN QUERY SELECT true, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_if_api_request() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_if_api_request() TO service_role;
REVOKE ALL ON private.if_api_request_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.if_api_rate_limit_lock FROM PUBLIC, anon, authenticated;
