-- Tighten public function execution and mutable search paths, index foreign keys,
-- and avoid duplicate permissive RLS policies for the same operations.

ALTER FUNCTION public.rls_auto_enable() SET search_path = pg_catalog;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog;

CREATE INDEX IF NOT EXISTS audit_events_actor_user_id_idx ON public.audit_events(actor_user_id);
CREATE INDEX IF NOT EXISTS audit_events_organization_id_idx ON public.audit_events(organization_id);
CREATE INDEX IF NOT EXISTS booking_requests_reviewed_by_idx ON public.booking_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS if_connections_connected_by_idx ON public.if_connections(connected_by);
CREATE INDEX IF NOT EXISTS oauth_pending_connections_user_id_idx ON public.oauth_pending_connections(user_id);
CREATE INDEX IF NOT EXISTS oauth_transactions_user_id_idx ON public.oauth_transactions(user_id);
CREATE INDEX IF NOT EXISTS organization_memberships_user_id_idx ON public.organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS organizations_created_by_idx ON public.organizations(created_by);

DROP POLICY IF EXISTS memberships_admin_manage ON public.organization_memberships;
CREATE POLICY memberships_admin_insert ON public.organization_memberships
  FOR INSERT TO authenticated WITH CHECK (private.is_org_admin(organization_id));
CREATE POLICY memberships_admin_update ON public.organization_memberships
  FOR UPDATE TO authenticated USING (private.is_org_admin(organization_id))
  WITH CHECK (private.is_org_admin(organization_id));
CREATE POLICY memberships_admin_delete ON public.organization_memberships
  FOR DELETE TO authenticated USING (private.is_org_admin(organization_id));

DROP POLICY IF EXISTS discord_settings_admin_read ON public.discord_settings;
DROP POLICY IF EXISTS discord_settings_admin_write ON public.discord_settings;
CREATE POLICY discord_settings_admin_select ON public.discord_settings
  FOR SELECT TO authenticated USING (private.is_org_admin(organization_id));
CREATE POLICY discord_settings_admin_insert ON public.discord_settings
  FOR INSERT TO authenticated WITH CHECK (private.is_org_admin(organization_id));
CREATE POLICY discord_settings_admin_update ON public.discord_settings
  FOR UPDATE TO authenticated USING (private.is_org_admin(organization_id))
  WITH CHECK (private.is_org_admin(organization_id));
CREATE POLICY discord_settings_admin_delete ON public.discord_settings
  FOR DELETE TO authenticated USING (private.is_org_admin(organization_id));
