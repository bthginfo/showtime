ALTER TABLE "timers" DROP CONSTRAINT IF EXISTS "timers_user_id_unique";--> statement-breakpoint
ALTER TABLE "document_buffers" DROP CONSTRAINT IF EXISTS "document_buffers_organization_id_file_id_records_organization_id_id_fk";
--> statement-breakpoint
ALTER TABLE "document_updates" DROP CONSTRAINT IF EXISTS "document_updates_organization_id_file_id_records_organization_id_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "direct_chat_key_idx";--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "production_id" text;--> statement-breakpoint
ALTER TABLE "document_buffers" ADD CONSTRAINT "document_buffers_organization_id_file_id_records_organization_id_id_fk" FOREIGN KEY ("organization_id","file_id") REFERENCES "public"."records"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_updates" ADD CONSTRAINT "document_updates_organization_id_file_id_records_organization_id_id_fk" FOREIGN KEY ("organization_id","file_id") REFERENCES "public"."records"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_production_id_records_organization_id_id_fk" FOREIGN KEY ("organization_id","production_id") REFERENCES "public"."records"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "timers_tenant_user" ON "timers" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "direct_chat_key_idx" ON "records" USING btree ("organization_id",("data"->>'directKey')) WHERE "records"."kind"='conversations' and coalesce("records"."data"->>'directKey','')<>'';