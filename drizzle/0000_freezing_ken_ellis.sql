CREATE TYPE "public"."leave_status" AS ENUM('pending', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."ot_status" AS ENUM('pending', 'approved', 'rejected', 'expired', 'executed');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('super_admin', 'admin', 'leader', 'employee');--> statement-breakpoint
CREATE TYPE "public"."working_status" AS ENUM('normal', 'extra');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"creator_id" uuid,
	"company_id" uuid,
	"email" varchar(255),
	"created_by_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now()) NOT NULL,
	"update_by_name" varchar(255),
	"updated_at" timestamp with time zone,
	"deleted_by_name" varchar(255),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"department_id" uuid,
	"shift_id" uuid,
	"site_id" uuid,
	"temp_shift_id" uuid,
	"site_in_name_snapshot" varchar(255),
	"site_out_name_snapshot" varchar(255),
	"site_coordinates_snapshot" varchar(255),
	"shift_start_time_snapshot" time,
	"shift_end_time_snapshot" time,
	"department_name_snapshot" varchar(255),
	"date" date NOT NULL,
	"check_in" time,
	"image_in" text NOT NULL,
	"image_in_id" text,
	"location_in" varchar(255) NOT NULL,
	"check_out" time,
	"image_out" text,
	"image_out_id" text,
	"location_out" varchar(255),
	"is_late" integer DEFAULT 0,
	"is_early_exit" text,
	"is_offsite_in" text,
	"is_offsite_in_coordinates" text,
	"is_offsite_out" text,
	"is_offsite_out_coordinates" text,
	"working_status" "working_status" DEFAULT 'normal',
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now()) NOT NULL,
	"remark" text
);
--> statement-breakpoint
CREATE TABLE "automation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" varchar(255) NOT NULL,
	"date" date NOT NULL,
	"start_at" timestamp with time zone DEFAULT timezone('UTC', now()),
	"end_at" timestamp with time zone,
	"duration_ms" integer,
	"read_count" integer DEFAULT 0 NOT NULL,
	"change_count" integer DEFAULT 0 NOT NULL,
	"executed_count" integer DEFAULT 0 NOT NULL,
	"deleted_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'success' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "company_feature_selected" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"feature_selected_array" jsonb DEFAULT '[]'::jsonb,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now()) NOT NULL,
	"update_by_id" uuid,
	"updated_at" timestamp with time zone,
	CONSTRAINT "company_feature_selected_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "company" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"superAdminCreator_id" uuid,
	"company_code" varchar(255) NOT NULL,
	"company_prefix" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"address" text,
	"phone" varchar(255),
	"email" varchar(255),
	"logo_url" text,
	"ot_rounding_option" varchar(30) NOT NULL,
	"company_feature_selected_id" uuid,
	"created_by_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now()) NOT NULL,
	"update_by_name" varchar(255),
	"updated_at" timestamp with time zone,
	"deleted_by_name" varchar(255),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "company_company_code_unique" UNIQUE("company_code"),
	CONSTRAINT "company_company_prefix_unique" UNIQUE("company_prefix")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"company_id" uuid,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now()) NOT NULL,
	"update_by_id" uuid,
	"updated_at" timestamp with time zone,
	"deleted_by_id" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "feature_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "leave" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"department_id" uuid,
	"site_id" uuid,
	"type" varchar(255) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"reason" text NOT NULL,
	"total_hours" double precision DEFAULT 0 NOT NULL,
	"status" "leave_status" DEFAULT 'pending' NOT NULL,
	"approved_by_id" uuid,
	"approved_at" timestamp with time zone,
	"rejected_by_id" uuid,
	"rejected_at" timestamp with time zone,
	"remark" text,
	"file_url" text,
	"file_id" text,
	"file_name" text,
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"user_name" varchar(255) NOT NULL,
	"role" varchar(50),
	"action" varchar(50) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"details" jsonb,
	"login_at" timestamp with time zone,
	"logout_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "overtime_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"user_name" varchar(255) NOT NULL,
	"company_id" uuid,
	"department_id" uuid,
	"site_id" uuid,
	"shift_id" uuid,
	"overtime_by_request" integer NOT NULL,
	"time_start" time NOT NULL,
	"time_end" time NOT NULL,
	"date" date NOT NULL,
	"requested_workers" jsonb DEFAULT '[]'::jsonb,
	"reason" text NOT NULL,
	"remarks" text,
	"status" "ot_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone DEFAULT timezone('UTC', now()),
	"approved_by" uuid,
	"rejected_at" timestamp with time zone DEFAULT timezone('UTC', now()),
	"rejected_by" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now()),
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "overtime" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"user_name" varchar(255) NOT NULL,
	"company_id" uuid,
	"shift_id" uuid,
	"attendance_id" uuid,
	"status" "ot_status" DEFAULT 'pending' NOT NULL,
	"date" date NOT NULL,
	"overtime_before" integer DEFAULT 0 NOT NULL,
	"overtime_after" integer DEFAULT 0 NOT NULL,
	"overtime_approved" integer DEFAULT 0 NOT NULL,
	"overtime_rejected" integer DEFAULT 0 NOT NULL,
	"ot_rounding_option" varchar(30) NOT NULL,
	CONSTRAINT "overtime_attendance_id_unique" UNIQUE("attendance_id")
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"company_id" uuid,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"company_id" uuid,
	"site_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"coordinates" varchar(255),
	"company_id" uuid,
	"department_id" uuid,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now()) NOT NULL,
	"update_by_id" uuid,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "super_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_name" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "role" DEFAULT 'super_admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now()),
	CONSTRAINT "super_admins_user_name_unique" UNIQUE("user_name")
);
--> statement-breakpoint
CREATE TABLE "temporary_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"target_date" date NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"site_id" uuid,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"overtime_id" uuid,
	"remark" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now())
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"emp_code" varchar(255),
	"user_name" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'employee' NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"company_id" uuid,
	"department_id" uuid,
	"position_id" uuid,
	"site_id" uuid,
	"avatar_url" text,
	"avatar_id" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now()) NOT NULL,
	"update_by_id" uuid,
	"updated_at" timestamp with time zone,
	"deleted_by_id" uuid,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_user_name_unique" UNIQUE("user_name")
);
--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_creator_id_super_admins_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."super_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_temp_shift_id_temporary_shifts_id_fk" FOREIGN KEY ("temp_shift_id") REFERENCES "public"."temporary_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_feature_selected" ADD CONSTRAINT "company_feature_selected_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_feature_selected" ADD CONSTRAINT "company_feature_selected_created_by_id_super_admins_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."super_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_feature_selected" ADD CONSTRAINT "company_feature_selected_update_by_id_super_admins_id_fk" FOREIGN KEY ("update_by_id") REFERENCES "public"."super_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_superAdminCreator_id_super_admins_id_fk" FOREIGN KEY ("superAdminCreator_id") REFERENCES "public"."super_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_company_feature_selected_id_company_feature_selected_id_fk" FOREIGN KEY ("company_feature_selected_id") REFERENCES "public"."company_feature_selected"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_update_by_id_users_id_fk" FOREIGN KEY ("update_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave" ADD CONSTRAINT "leave_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave" ADD CONSTRAINT "leave_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave" ADD CONSTRAINT "leave_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave" ADD CONSTRAINT "leave_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave" ADD CONSTRAINT "leave_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime" ADD CONSTRAINT "overtime_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime" ADD CONSTRAINT "overtime_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime" ADD CONSTRAINT "overtime_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime" ADD CONSTRAINT "overtime_attendance_id_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_update_by_id_users_id_fk" FOREIGN KEY ("update_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_shifts" ADD CONSTRAINT "temporary_shifts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_shifts" ADD CONSTRAINT "temporary_shifts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_shifts" ADD CONSTRAINT "temporary_shifts_overtime_id_overtime_id_fk" FOREIGN KEY ("overtime_id") REFERENCES "public"."overtime"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_shifts" ADD CONSTRAINT "temporary_shifts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_update_by_id_users_id_fk" FOREIGN KEY ("update_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;