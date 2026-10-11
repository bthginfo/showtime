-- Add the registered trade to existing theaters without changing any user grants.
-- Explicit theater/department memberships continue to be assigned by the administration.
DO $upgrade$
DECLARE house record; department_id text; project record; item_id text;
BEGIN
  FOR house IN SELECT organization_id FROM public.tenant_settings WHERE status='active' LOOP
    PERFORM set_config('app.tenant_id', house.organization_id, true);
    IF EXISTS (SELECT 1 FROM public.module_activations WHERE organization_id=house.organization_id AND module_id='design') THEN CONTINUE; END IF;
    SELECT id INTO department_id FROM public.departments WHERE organization_id=house.organization_id AND name='Ausstattung' LIMIT 1;
    IF department_id IS NULL THEN
      department_id := gen_random_uuid()::text;
      INSERT INTO public.departments(id,organization_id,name) VALUES(department_id,house.organization_id,'Ausstattung');
    END IF;
    INSERT INTO public.module_activations(id,organization_id,module_id,enabled,config)
      VALUES(gen_random_uuid()::text,house.organization_id,'design',true,jsonb_build_object('departmentId',department_id));
    FOR project IN SELECT id,created_by FROM public.records WHERE organization_id=house.organization_id AND kind='productions' LOOP
      item_id := 'workspace:'||project.id||':design';
      INSERT INTO public.trade_items(id,organization_id,department_id,production_id,module_id,type,title,created_by)
        VALUES(item_id,house.organization_id,department_id,project.id,'design','workspace','Ausstattung & Bühnenbild',project.created_by)
        ON CONFLICT DO NOTHING;
      INSERT INTO public.outbox(id,organization_id,department_id,type,payload)
        VALUES(gen_random_uuid()::text,house.organization_id,department_id,'WorkspaceProvisionedV1',jsonb_build_object(
          'recordId',item_id,'aggregateId',item_id,'aggregateVersion',1,'version',1,'schemaVersion',1,
          'actorId',project.created_by,'productionId',project.id,'organizationId',house.organization_id));
    END LOOP;
  END LOOP;
END $upgrade$;
