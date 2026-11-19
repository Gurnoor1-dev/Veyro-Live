do $$
declare
  automation_job_id bigint;
begin
  select jobid into automation_job_id
  from cron.job
  where jobname = 'veyro-live-automation'
  order by jobid
  limit 1;

  if automation_job_id is null then
    raise notice 'VEYRO Live automation cron job was not found; no schedule changed.';
  else
    perform cron.alter_job(automation_job_id, schedule := '*/5 * * * *');
  end if;
end
$$;
