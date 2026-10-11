CREATE TABLE "api_access" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"department_id" text NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_access_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "api_access_scope" ON "api_access" USING btree ("organization_id","id");
--> statement-breakpoint
CREATE TABLE "integration_receipts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"access_id" text,
	"operation_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_uploads" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"department_id" text NOT NULL,
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_file_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_checks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"digest" text,
	"record_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_access" ADD CONSTRAINT "api_access_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_access" ADD CONSTRAINT "api_access_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_access" ADD CONSTRAINT "api_access_organization_id_department_id_departments_organization_id_id_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."departments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_access" ADD CONSTRAINT "api_access_organization_id_user_id_tenant_members_organization_id_user_id_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."tenant_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_receipts" ADD CONSTRAINT "integration_receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_receipts" ADD CONSTRAINT "integration_receipts_organization_id_access_id_api_access_organization_id_id_fk" FOREIGN KEY ("organization_id","access_id") REFERENCES "public"."api_access"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_uploads" ADD CONSTRAINT "media_uploads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_uploads" ADD CONSTRAINT "media_uploads_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_uploads" ADD CONSTRAINT "media_uploads_organization_id_department_id_departments_organization_id_id_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."departments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_uploads" ADD CONSTRAINT "media_uploads_organization_id_item_id_trade_items_organization_id_id_fk" FOREIGN KEY ("organization_id","item_id") REFERENCES "public"."trade_items"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_uploads" ADD CONSTRAINT "media_uploads_organization_id_completed_file_id_records_organization_id_id_fk" FOREIGN KEY ("organization_id","completed_file_id") REFERENCES "public"."records"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_checks" ADD CONSTRAINT "recovery_checks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_operation" ON "integration_receipts" USING btree ("organization_id","operation_key");
