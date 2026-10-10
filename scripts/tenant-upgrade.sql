-- Corrections applied to both newly provisioned and previously bootstrapped databases.
DROP FUNCTION IF EXISTS showtime_due_tenants();
DROP FUNCTION IF EXISTS showtime_due_tenants(text,integer);
CREATE FUNCTION showtime_due_tenants(after_id text, batch_size integer DEFAULT 25) RETURNS TABLE(organization_id text) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
 SELECT DISTINCT m.organization_id FROM public.tenant_members m WHERE m.organization_id>after_id ORDER BY m.organization_id LIMIT LEAST(GREATEST(batch_size,1),100)
$f$;
REVOKE ALL ON FUNCTION showtime_due_tenants(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION showtime_due_tenants(text,integer) TO showtime_worker;
CREATE TABLE IF NOT EXISTS showtime_recovery_cursor(id text PRIMARY KEY,last_tenant text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON showtime_recovery_cursor FROM PUBLIC,showtime_app,showtime_auth,showtime_control;
GRANT SELECT,INSERT,UPDATE ON showtime_recovery_cursor TO showtime_worker;
INSERT INTO showtime_recovery_cursor(id) VALUES('tenant-recovery') ON CONFLICT DO NOTHING;
DO $receipts$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='outbox_tenant_identity') THEN ALTER TABLE outbox ADD CONSTRAINT outbox_tenant_identity UNIQUE(organization_id,id); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='event_receipt_tenant') THEN ALTER TABLE event_receipts ADD CONSTRAINT event_receipt_tenant FOREIGN KEY(organization_id,event_id) REFERENCES outbox(organization_id,id) ON DELETE CASCADE; END IF;
END $receipts$;
GRANT SELECT ON calendar_tokens TO showtime_auth;
DROP POLICY IF EXISTS auth_calendar_discovery ON calendar_tokens;
CREATE POLICY auth_calendar_discovery ON calendar_tokens FOR SELECT TO showtime_auth USING(true);
DO $documents$
DECLARE row record;
BEGIN
 FOR row IN SELECT conname,conrelid::regclass AS tbl FROM pg_constraint WHERE contype='f' AND confrelid='records'::regclass AND conrelid IN ('document_buffers'::regclass,'document_updates'::regclass) LOOP
  EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',row.tbl,row.conname);
 END LOOP;
END $documents$;
ALTER TABLE document_buffers ADD CONSTRAINT buffer_record_tenant FOREIGN KEY(organization_id,file_id) REFERENCES records(organization_id,id) ON DELETE CASCADE;
ALTER TABLE document_updates ADD CONSTRAINT update_record_tenant FOREIGN KEY(organization_id,file_id) REFERENCES records(organization_id,id) ON DELETE CASCADE;
DO $scope$
DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['timers','attendance_timers','outbox','audit','calendar_tokens','push_subscriptions'] LOOP
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name=tbl AND column_name='department_id') AND NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname=tbl||'_department_tenant') THEN
   EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY(organization_id,department_id) REFERENCES departments(organization_id,id)',tbl,tbl||'_department_tenant');
  END IF;
 END LOOP;
END $scope$;
-- Explicitly forwarded support content is the only global business projection.
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON support_requests;
CREATE POLICY tenant_scope ON support_requests TO showtime_app,showtime_worker
 USING (organization_id=nullif(current_setting('app.tenant_id',true),'') AND
 (current_user='showtime_worker' OR (user_id=nullif(current_setting('app.user_id',true),'') AND showtime_has_membership(organization_id,user_id))))
 WITH CHECK (organization_id=nullif(current_setting('app.tenant_id',true),'') AND
 (current_user='showtime_worker' OR (user_id=nullif(current_setting('app.user_id',true),'') AND showtime_has_membership(organization_id,user_id))));
DROP POLICY IF EXISTS support_operator_read ON support_requests;
CREATE POLICY support_operator_read ON support_requests FOR SELECT TO showtime_control USING(true);
DROP POLICY IF EXISTS support_operator_update ON support_requests;
GRANT SELECT,INSERT,UPDATE,DELETE ON support_requests TO showtime_app,showtime_worker;
REVOKE UPDATE(status,version,updated_at) ON support_requests FROM showtime_control;
GRANT SELECT ON support_requests TO showtime_control;
