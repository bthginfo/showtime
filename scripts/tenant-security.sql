-- Application and worker roles never own tables and cannot bypass row security.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO showtime_app,showtime_auth,showtime_worker,showtime_control;
CREATE OR REPLACE FUNCTION showtime_has_membership(tenant text,person text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $function$
 SELECT EXISTS(SELECT 1 FROM public.tenant_members WHERE organization_id=tenant AND user_id=person AND status='active')
$function$;
REVOKE ALL ON FUNCTION showtime_has_membership(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION showtime_has_membership(text,text) TO showtime_app,showtime_worker;
-- The membership gate is deliberately owner-managed; FORCE applies to all business data.
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members NO FORCE ROW LEVEL SECURITY;
DO $policies$
DECLARE item record;
BEGIN
 FOR item IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='organization_id' LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',item.table_name);
  IF item.table_name <> 'tenant_members' THEN EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',item.table_name); END IF;
  EXECUTE format('DROP POLICY IF EXISTS tenant_scope ON public.%I',item.table_name);
  EXECUTE format('CREATE POLICY tenant_scope ON public.%I TO showtime_app,showtime_worker USING (organization_id=nullif(current_setting(''app.tenant_id'',true),'''') AND (current_user=''showtime_worker'' OR public.showtime_has_membership(organization_id,nullif(current_setting(''app.user_id'',true),'''')))) WITH CHECK (organization_id=nullif(current_setting(''app.tenant_id'',true),'''') AND (current_user=''showtime_worker'' OR public.showtime_has_membership(organization_id,nullif(current_setting(''app.user_id'',true),''''))))',item.table_name);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO showtime_app,showtime_worker',item.table_name);
 END LOOP;
END $policies$;
-- Identity credentials are accessible only to the trusted authentication service.
DO $identity$
DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['app_user','app_session','app_account','app_verification','auth_rate_limit','profile_preferences'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format('DROP POLICY IF EXISTS auth_service ON public.%I',tbl);
  EXECUTE format('CREATE POLICY auth_service ON public.%I TO showtime_auth USING (true) WITH CHECK (true)',tbl);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO showtime_auth',tbl);
 END LOOP;
END $identity$;
CREATE POLICY tenant_directory ON app_user FOR SELECT TO showtime_app,showtime_worker USING(id=nullif(current_setting('app.user_id',true),'') OR showtime_has_membership(nullif(current_setting('app.tenant_id',true),''),id));
GRANT SELECT ON app_user TO showtime_app,showtime_worker;
CREATE POLICY own_appearance ON profile_preferences TO showtime_app USING(user_id=nullif(current_setting('app.user_id',true),'')) WITH CHECK(user_id=nullif(current_setting('app.user_id',true),''));
GRANT SELECT,INSERT,UPDATE ON profile_preferences TO showtime_app;
-- Discovery contains affiliations and grants, never theater records, HR or document bodies.
DO $discovery$
DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['organizations','departments','tenant_members','memberships','permission_grants','tenant_settings','platform_admins'] LOOP
  EXECUTE format('GRANT SELECT ON public.%I TO showtime_auth',tbl);
  EXECUTE format('DROP POLICY IF EXISTS auth_discovery ON public.%I',tbl);
  EXECUTE format('CREATE POLICY auth_discovery ON public.%I FOR SELECT TO showtime_auth USING(true)',tbl);
 END LOOP;
END $discovery$;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_scope ON organizations TO showtime_app,showtime_worker USING(id=nullif(current_setting('app.tenant_id',true),'') AND (current_user='showtime_worker' OR showtime_has_membership(id,nullif(current_setting('app.user_id',true),''))));
GRANT SELECT ON organizations TO showtime_app,showtime_worker;
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins FORCE ROW LEVEL SECURITY;
-- Control plane owns onboarding and affiliations but has no business-data privileges.
DO $control$
DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['organizations','departments','tenant_settings','tenant_members','memberships','permission_grants','module_activations','invitations','platform_admins'] LOOP
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO showtime_control',tbl);
  EXECUTE format('DROP POLICY IF EXISTS control_plane ON public.%I',tbl);
  EXECUTE format('CREATE POLICY control_plane ON public.%I TO showtime_control USING(true) WITH CHECK(true)',tbl);
 END LOOP;
END $control$;
CREATE OR REPLACE FUNCTION showtime_due_tenants() RETURNS TABLE(organization_id text) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
 SELECT DISTINCT m.organization_id FROM public.tenant_members m LIMIT 500
$f$;
REVOKE ALL ON FUNCTION showtime_due_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION showtime_due_tenants() TO showtime_worker;
ALTER TABLE timers DROP CONSTRAINT IF EXISTS timers_user_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS timers_tenant_user ON timers(organization_id,user_id);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_tenant_user ON attendance_timers(organization_id,user_id);
ALTER TABLE records ADD CONSTRAINT record_parent_tenant FOREIGN KEY(organization_id,parent_id) REFERENCES records(organization_id,id);
ALTER TABLE records ADD CONSTRAINT record_production_tenant FOREIGN KEY(organization_id,production_id) REFERENCES records(organization_id,id);
ALTER TABLE record_history ADD CONSTRAINT history_record_tenant FOREIGN KEY(organization_id,record_id) REFERENCES records(organization_id,id) ON DELETE CASCADE;
ALTER TABLE collaborative_documents ADD CONSTRAINT document_record_tenant FOREIGN KEY(organization_id,file_id) REFERENCES records(organization_id,id) ON DELETE CASCADE;
-- Tenant aliases, identifiers and ACLs in JSON are still validated by the command service.
