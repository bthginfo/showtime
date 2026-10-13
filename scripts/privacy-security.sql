-- No clinical processing on the current hosting contract. This projection executes
-- in PostgreSQL, before application/export/worker processes receive JSON content.
CREATE OR REPLACE FUNCTION showtime_medical_category(code text,label text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $f$
 SELECT lower(code||' '||label) ~ '(sick|krank|attest|diagnos|allerg|medical|gesundheit)'
$f$;
CREATE OR REPLACE FUNCTION showtime_safe_record_data(kind text,payload jsonb,dept text,viewer text,team_dept text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $f$
DECLARE category_name text; paid boolean; clinical boolean; personal boolean; output jsonb; k text;
BEGIN
 IF kind='leave' THEN RETURN payload-'reason'; END IF;
 IF kind<>'events' THEN RETURN payload; END IF;
 SELECT data->>'name' INTO category_name FROM public.records
 WHERE records.kind='calendarCategories' AND department_id=dept AND data->>'key'=payload->>'category' LIMIT 1;
 clinical:=public.showtime_medical_category(coalesce(payload->>'category',''),coalesce(category_name,''));
 personal:=coalesce(payload->'participantIds','[]'::jsonb)<>'[]'::jsonb AND coalesce((payload->>'allDay')::boolean,false);
 paid:=(payload->>'creditUnit'='weekly-sixth' OR lower(coalesce(payload->>'category','')||' '||coalesce(category_name,'')) ~ '(vacation|urlaub|holiday|feiertag|sick|krank)')
  AND regexp_replace(lower(coalesce(payload->>'category','')),'[^a-z0-9]','','g') NOT IN ('abf','rest','ruhetag','halfdayoff','halberfreiertag')
  AND regexp_replace(lower(coalesce(category_name,'')),'[^a-z0-9]','','g') NOT IN ('abf','rest','ruhetag','halfdayoff','halberfreiertag');
 IF clinical OR (personal AND coalesce(payload->>'category','') IN ('absence','vacation','holiday','holiday-compensation','abf','rest','half-day-off') AND NOT (coalesce(payload->'participantIds','[]'::jsonb) ? viewer)) THEN
  output:='{}'::jsonb;
  FOREACH k IN ARRAY ARRAY['start','end','participantIds','allDay','recurrence','until','exceptions','cancelled','blocksTime','theaterTimezone','leaveId'] LOOP
    IF payload ? k THEN output:=output||jsonb_build_object(k,payload->k); END IF;
  END LOOP;
  output:=output||jsonb_build_object('category','absence','title','Abwesenheit','location','','productionId','','actorIds','[]'::jsonb,'resourceId','','bookingId','','privacyNeutral',true);
 ELSE output:=payload; END IF;
 -- The accounting entitlement is independent of the cause and private to time access.
 IF personal AND (coalesce(payload->'participantIds','[]'::jsonb) ? viewer OR team_dept=dept) THEN
   output:=output||jsonb_build_object('creditUnit',CASE WHEN paid THEN 'weekly-sixth' ELSE 'none' END);
 ELSE output:=output-'creditUnit'; END IF;
 RETURN output;
END $f$;
REVOKE ALL ON FUNCTION showtime_safe_record_data(text,jsonb,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION showtime_safe_record_data(text,jsonb,text,text,text) TO showtime_app,showtime_worker;
GRANT EXECUTE ON FUNCTION showtime_medical_category(text,text) TO showtime_app,showtime_worker;
CREATE OR REPLACE FUNCTION showtime_safe_snapshot(payload jsonb) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $f$
 SELECT payload||jsonb_build_object('events',coalesce((SELECT jsonb_agg(e||jsonb_build_object('data',showtime_safe_record_data('events',coalesce(e->'data','{}'::jsonb),coalesce(e->>'departmentId',''),'', ''))) FROM jsonb_array_elements(coalesce(payload->'events','[]'::jsonb)) e),'[]'::jsonb))
$f$;
REVOKE ALL ON FUNCTION showtime_safe_snapshot(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION showtime_safe_snapshot(jsonb) TO showtime_app,showtime_worker;
CREATE OR REPLACE FUNCTION showtime_safe_event_payload(event_type text,payload jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $f$
 SELECT CASE WHEN event_type='ServiceChangedV1' THEN (payload-ARRAY['text','description','reason','title'])||jsonb_build_object('title','Kalenderänderung') ELSE payload END
$f$;
REVOKE ALL ON FUNCTION showtime_safe_event_payload(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION showtime_safe_event_payload(text,jsonb) TO showtime_app,showtime_worker;
DO $privacy$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['privacy_policies','privacy_entries','privacy_erasure_ledger'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format('DROP POLICY IF EXISTS tenant_scope ON %I',tbl);
  EXECUTE format('CREATE POLICY tenant_scope ON %I TO showtime_app,showtime_worker USING (organization_id=nullif(current_setting(''app.tenant_id'',true),'''') AND (current_user=''showtime_worker'' OR showtime_has_membership(organization_id,nullif(current_setting(''app.user_id'',true),'''')))) WITH CHECK (organization_id=nullif(current_setting(''app.tenant_id'',true),'''') AND (current_user=''showtime_worker'' OR showtime_has_membership(organization_id,nullif(current_setting(''app.user_id'',true),''''))))',tbl);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO showtime_app,showtime_worker',tbl);
 END LOOP;
END $privacy$;
REVOKE UPDATE,DELETE ON privacy_erasure_ledger FROM showtime_app,showtime_worker;
ALTER TABLE auth_two_factor ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_two_factor FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_service ON auth_two_factor;
CREATE POLICY auth_service ON auth_two_factor TO showtime_auth USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON auth_two_factor TO showtime_auth;
-- Public notices expose only an explicitly published policy, never internal entries.
UPDATE privacy_policies SET published_data=data WHERE published_data IS NULL AND coalesce(data->>'publishedAt','')<>'';
CREATE OR REPLACE FUNCTION showtime_public_privacy(theater_slug text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $notice$
 SELECT jsonb_build_object('theater',o.name,'slug',s.slug,'published',p.published_data->>'publishedAt','controller',p.published_data->'controller','purposes',p.published_data->'purposes','rightsContact',p.published_data->>'rightsContact','notice',p.published_data->>'notice')
 FROM public.tenant_settings s JOIN public.organizations o ON o.id=s.organization_id
 JOIN public.privacy_policies p ON p.organization_id=s.organization_id
 WHERE s.slug=theater_slug AND s.status='active' AND coalesce(p.published_data->>'publishedAt','')<>''
$notice$;
REVOKE ALL ON FUNCTION showtime_public_privacy(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION showtime_public_privacy(text) TO showtime_auth;
