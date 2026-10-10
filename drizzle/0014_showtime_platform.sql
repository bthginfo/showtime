CREATE TABLE "document_buffers" (
	"file_id" text PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"state" text NOT NULL,
	"base_revision" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"pending_bytes" integer DEFAULT 0 NOT NULL,
	"dirty" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_updates" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"file_id" text NOT NULL,
	"revision" integer NOT NULL,
	"update" text NOT NULL,
	"client_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_receipts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"event_id" text NOT NULL,
	"handler" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"token_hash" text NOT NULL,
	"department_id" text NOT NULL,
	"role" text DEFAULT 'employee' NOT NULL,
	"created_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_by" text,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "module_activations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"module_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performances" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"production_id" text NOT NULL,
	"run_id" text,
	"event_id" text NOT NULL,
	"curtain_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_grants" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"scope" text NOT NULL,
	"scope_id" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"user_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_runs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"production_id" text NOT NULL,
	"label" text NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "resource_bookings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"resource_id" text NOT NULL,
	"production_id" text,
	"activity_id" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_versions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"version" integer NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"published_by" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_members" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_profiles" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"user_id" text NOT NULL,
	"working_time" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"organization_id" text PRIMARY KEY DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"timezone" text DEFAULT 'Europe/Berlin' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"permission_version" integer DEFAULT 1 NOT NULL,
	"live_revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_settings_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "theater_productions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"record_id" text NOT NULL,
	"work_id" text,
	"season_id" text,
	"stage" text DEFAULT 'concept' NOT NULL,
	"budget_cents" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theater_seasons" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"label" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theater_works" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_item_history" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"item_id" text NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"department_id" text NOT NULL,
	"production_id" text,
	"performance_id" text,
	"module_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"owner_id" text,
	"start_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_resources" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"department_id" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"setup_minutes" integer DEFAULT 0 NOT NULL,
	"teardown_minutes" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS records_tenant_identity ON records(organization_id,id);
--> statement-breakpoint
CREATE UNIQUE INDEX "document_update_revision" ON "document_updates" USING btree ("organization_id","file_id","revision");
--> statement-breakpoint
CREATE UNIQUE INDEX "event_handler_receipt" ON "event_receipts" USING btree ("organization_id","event_id","handler");
--> statement-breakpoint
CREATE UNIQUE INDEX "module_tenant" ON "module_activations" USING btree ("organization_id","module_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "performance_scope" ON "performances" USING btree ("organization_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "performance_event" ON "performances" USING btree ("organization_id","event_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "run_scope" ON "production_runs" USING btree ("organization_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_version_identity" ON "schedule_versions" USING btree ("organization_id","version");
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_member_identity" ON "tenant_members" USING btree ("organization_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_profile_identity" ON "tenant_profiles" USING btree ("organization_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "production_scope" ON "theater_productions" USING btree ("organization_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "production_record" ON "theater_productions" USING btree ("organization_id","record_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "season_scope" ON "theater_seasons" USING btree ("organization_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "work_scope" ON "theater_works" USING btree ("organization_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "trade_item_revision" ON "trade_item_history" USING btree ("organization_id","item_id","version");
--> statement-breakpoint
CREATE UNIQUE INDEX "trade_item_scope" ON "trade_items" USING btree ("organization_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "resource_scope" ON "venue_resources" USING btree ("organization_id","id");
--> statement-breakpoint
ALTER TABLE "attendance_timers" DROP CONSTRAINT "attendance_timers_user_id_unique";
--> statement-breakpoint
ALTER TABLE "attendance_timers" ADD COLUMN "organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL;
--> statement-breakpoint
ALTER TABLE "audit" ADD COLUMN "organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL;
--> statement-breakpoint
ALTER TABLE "calendar_tokens" ADD COLUMN "organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL;
--> statement-breakpoint
ALTER TABLE "collaborative_documents" ADD COLUMN "organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL;
--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL;
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL;
--> statement-breakpoint
ALTER TABLE "record_history" ADD COLUMN "organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL;
--> statement-breakpoint
ALTER TABLE "timers" ADD COLUMN "organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL;
--> statement-breakpoint
ALTER TABLE "document_buffers" ADD CONSTRAINT "document_buffers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_buffers" ADD CONSTRAINT "document_buffers_organization_id_file_id_records_organization_id_id_fk" FOREIGN KEY ("organization_id","file_id") REFERENCES "public"."records"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_updates" ADD CONSTRAINT "document_updates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_updates" ADD CONSTRAINT "document_updates_organization_id_file_id_records_organization_id_id_fk" FOREIGN KEY ("organization_id","file_id") REFERENCES "public"."records"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_receipts" ADD CONSTRAINT "event_receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_used_by_app_user_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_department_id_departments_organization_id_id_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."departments"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "module_activations" ADD CONSTRAINT "module_activations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "performances" ADD CONSTRAINT "performances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "performances" ADD CONSTRAINT "performances_organization_id_production_id_records_organization_id_id_fk" FOREIGN KEY ("organization_id","production_id") REFERENCES "public"."records"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "performances" ADD CONSTRAINT "performances_organization_id_event_id_records_organization_id_id_fk" FOREIGN KEY ("organization_id","event_id") REFERENCES "public"."records"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "performances" ADD CONSTRAINT "performances_organization_id_run_id_production_runs_organization_id_id_fk" FOREIGN KEY ("organization_id","run_id") REFERENCES "public"."production_runs"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_organization_id_user_id_tenant_members_organization_id_user_id_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."tenant_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_organization_id_production_id_records_organization_id_id_fk" FOREIGN KEY ("organization_id","production_id") REFERENCES "public"."records"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resource_bookings" ADD CONSTRAINT "resource_bookings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resource_bookings" ADD CONSTRAINT "resource_bookings_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resource_bookings" ADD CONSTRAINT "resource_bookings_organization_id_resource_id_venue_resources_organization_id_id_fk" FOREIGN KEY ("organization_id","resource_id") REFERENCES "public"."venue_resources"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resource_bookings" ADD CONSTRAINT "resource_bookings_organization_id_production_id_records_organization_id_id_fk" FOREIGN KEY ("organization_id","production_id") REFERENCES "public"."records"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_published_by_app_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_profiles" ADD CONSTRAINT "tenant_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_profiles" ADD CONSTRAINT "tenant_profiles_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_profiles" ADD CONSTRAINT "tenant_profiles_organization_id_user_id_tenant_members_organization_id_user_id_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."tenant_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "theater_productions" ADD CONSTRAINT "theater_productions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "theater_productions" ADD CONSTRAINT "theater_productions_organization_id_record_id_records_organization_id_id_fk" FOREIGN KEY ("organization_id","record_id") REFERENCES "public"."records"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "theater_productions" ADD CONSTRAINT "theater_productions_organization_id_work_id_theater_works_organization_id_id_fk" FOREIGN KEY ("organization_id","work_id") REFERENCES "public"."theater_works"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "theater_productions" ADD CONSTRAINT "theater_productions_organization_id_season_id_theater_seasons_organization_id_id_fk" FOREIGN KEY ("organization_id","season_id") REFERENCES "public"."theater_seasons"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "theater_seasons" ADD CONSTRAINT "theater_seasons_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "theater_works" ADD CONSTRAINT "theater_works_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trade_item_history" ADD CONSTRAINT "trade_item_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trade_item_history" ADD CONSTRAINT "trade_item_history_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trade_item_history" ADD CONSTRAINT "trade_item_history_organization_id_item_id_trade_items_organization_id_id_fk" FOREIGN KEY ("organization_id","item_id") REFERENCES "public"."trade_items"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_owner_id_app_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_organization_id_department_id_departments_organization_id_id_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."departments"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_organization_id_production_id_records_organization_id_id_fk" FOREIGN KEY ("organization_id","production_id") REFERENCES "public"."records"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_organization_id_performance_id_performances_organization_id_id_fk" FOREIGN KEY ("organization_id","performance_id") REFERENCES "public"."performances"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "venue_resources" ADD CONSTRAINT "venue_resources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "venue_resources" ADD CONSTRAINT "venue_resources_organization_id_department_id_departments_organization_id_id_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."departments"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "grant_subject" ON "permission_grants" USING btree ("organization_id","user_id");
--> statement-breakpoint
CREATE INDEX "booking_window" ON "resource_bookings" USING btree ("organization_id","resource_id","start_at","end_at");
--> statement-breakpoint
CREATE INDEX "trade_item_list" ON "trade_items" USING btree ("organization_id","department_id","module_id","production_id","updated_at");
--> statement-breakpoint
ALTER TABLE "attendance_timers" ADD CONSTRAINT "attendance_timers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audit" ADD CONSTRAINT "audit_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_tokens" ADD CONSTRAINT "calendar_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "collaborative_documents" ADD CONSTRAINT "collaborative_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "record_history" ADD CONSTRAINT "record_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "timers" ADD CONSTRAINT "timers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
