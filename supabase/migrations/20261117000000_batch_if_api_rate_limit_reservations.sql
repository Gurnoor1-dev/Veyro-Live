create or replace function public.reserve_if_api_requests(p_count integer)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  request_count integer;
  oldest_request timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  if p_count is null or p_count < 1 or p_count > 20 then
    raise exception 'p_count must be between 1 and 20';
  end if;

  update private.if_api_rate_limit_lock
    set touched_at = v_now
    where id = true;

  delete from private.if_api_request_events
    where requested_at <= v_now - interval '2 minutes';

  select count(*), min(requested_at)
    into request_count, oldest_request
    from private.if_api_request_events
    where requested_at > v_now - interval '1 minute';

  if request_count + p_count > 20 then
    return query select false,
      greatest(1, ceil(extract(epoch from (oldest_request + interval '1 minute' - v_now)))::integer);
    return;
  end if;

  insert into private.if_api_request_events(requested_at)
    select v_now from generate_series(1, p_count);

  return query select true, 0;
end;
$function$;

revoke all on function public.reserve_if_api_requests(integer) from public, anon, authenticated;
grant execute on function public.reserve_if_api_requests(integer) to service_role;
