alter table public.live_automation_events
  drop constraint if exists live_automation_events_event_type_check;
alter table public.live_automation_events
  add constraint live_automation_events_event_type_check
  check (event_type in ('landing_dispatch','schedule_revisor','initial_schedule_open'));
