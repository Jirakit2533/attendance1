CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"company_id" uuid,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"update_by_id" uuid,
	"updated_at" timestamp with time zone,
	"deleted_by_id" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"company_id" uuid,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "department" TO "department_id";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "position" TO "position_id";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_site_id_sites_id_fk";
--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance" ALTER COLUMN "check_in" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "attendance" ALTER COLUMN "check_in" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance" ALTER COLUMN "check_out" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "company" ALTER COLUMN "address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "company" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leave" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."leave_status";--> statement-breakpoint
ALTER TABLE "leave" ALTER COLUMN "status" SET DATA TYPE "public"."leave_status" USING "status"::"public"."leave_status";--> statement-breakpoint
ALTER TABLE "sites" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sites" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sites" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "creator_id" uuid;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "site_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "image_in_id" text;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "image_out_id" text;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "company_code" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "phone" varchar(255);--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "deleted_by_name" varchar(255);--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leave" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "leave" ADD COLUMN "site_id" uuid;--> statement-breakpoint
ALTER TABLE "leave" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "leave" ADD COLUMN "rejected_by_id" uuid;--> statement-breakpoint
ALTER TABLE "leave" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "leave" ADD COLUMN "file_url" text;--> statement-breakpoint
ALTER TABLE "leave" ADD COLUMN "file_id" text;--> statement-breakpoint
ALTER TABLE "leave" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "leave" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "super_admins" ADD COLUMN "role" text DEFAULT 'superAdmin' NOT NULL;--> statement-breakpoint
ALTER TABLE "super_admins" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_id" text;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_update_by_id_users_id_fk" FOREIGN KEY ("update_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_creator_id_super_admins_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."super_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave" ADD CONSTRAINT "leave_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave" ADD CONSTRAINT "leave_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave" ADD CONSTRAINT "leave_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_company_code_unique" UNIQUE("company_code");