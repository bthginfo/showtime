CREATE TABLE "support_requests" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text DEFAULT current_setting('app.tenant_id', true) NOT NULL,
	"source_record_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_organization_id_source_record_id_records_organization_id_id_fk" FOREIGN KEY ("organization_id","source_record_id") REFERENCES "public"."records"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "support_source_idx" ON "support_requests" USING btree ("organization_id","source_record_id");