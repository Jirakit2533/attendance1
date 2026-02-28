ALTER TABLE "company" DROP CONSTRAINT "company_created_by_id_super_admins_id_fk";
--> statement-breakpoint
ALTER TABLE "company" DROP CONSTRAINT "company_update_by_id_super_admins_id_fk";
--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_created_by_id_super_admins_name_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."super_admins"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_update_by_id_super_admins_name_fk" FOREIGN KEY ("update_by_id") REFERENCES "public"."super_admins"("name") ON DELETE no action ON UPDATE no action;