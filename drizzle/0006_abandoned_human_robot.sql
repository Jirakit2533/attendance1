ALTER TABLE "admins" DROP CONSTRAINT "admins_user_id_super_admins_id_fk";
--> statement-breakpoint
ALTER TABLE "admins" DROP CONSTRAINT "admins_company_id_company_id_fk";
--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;