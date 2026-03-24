ALTER TABLE "leave" DROP CONSTRAINT "leave_site_id_sites_id_fk";
--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "created_at" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "attendance" ALTER COLUMN "created_at" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "company" ALTER COLUMN "created_at" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "departments" ALTER COLUMN "created_at" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "leave" ALTER COLUMN "created_at" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "created_at" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "sites" ALTER COLUMN "created_at" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "super_admins" ALTER COLUMN "created_at" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "temporary_shifts" ALTER COLUMN "created_at" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "site_in_name_snapshot" varchar(255);--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "site_out_name_snapshot" varchar(255);--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "site_coordinates_snapshot" varchar(255);--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "shift_start_time_snapshot" time;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "shift_end_time_snapshot" time;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "department_name_snapshot" varchar(255);--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "is_offsite_in" text;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "is_offsite_in_coordinates" text;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "is_offsite_out" text;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "is_offsite_out_coordinates" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "admin_creator_id" uuid;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "leave" ADD COLUMN "remark" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_admin_creator_id_admins_id_fk" FOREIGN KEY ("admin_creator_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave" ADD CONSTRAINT "leave_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;