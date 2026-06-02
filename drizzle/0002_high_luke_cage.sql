ALTER TABLE "overtime_requests" DROP CONSTRAINT "overtime_requests_site_id_sites_id_fk";
--> statement-breakpoint
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_site_id_sites_id_fk";
--> statement-breakpoint
ALTER TABLE "temporary_shifts" DROP CONSTRAINT "temporary_shifts_site_id_sites_id_fk";
--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_shifts" ADD CONSTRAINT "temporary_shifts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;