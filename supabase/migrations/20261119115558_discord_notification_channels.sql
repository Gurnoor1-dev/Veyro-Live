-- Give each automated VEYRO Live notification its own Discord destination.
ALTER TABLE public.discord_settings
  ADD COLUMN IF NOT EXISTS landing_dispatch_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS unassigned_legs_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS schedule_revisor_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS activity_log_channel_id TEXT;

COMMENT ON COLUMN public.discord_settings.landing_dispatch_channel_id IS 'Discord channel for confirmed landing dispatch notifications.';
COMMENT ON COLUMN public.discord_settings.unassigned_legs_channel_id IS 'Discord channel for initial unassigned schedule announcements and self-service crew claims.';
COMMENT ON COLUMN public.discord_settings.schedule_revisor_channel_id IS 'Discord channel for schedule revisor notifications and self-service crew claims.';
COMMENT ON COLUMN public.discord_settings.activity_log_channel_id IS 'Discord channel reserved for organisation activity log notifications.';
