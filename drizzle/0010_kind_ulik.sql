CREATE TABLE "overtime" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"user_name" varchar(255) NOT NULL,
	"shift_id" uuid,
	"attendance_id" uuid,
	"status" varchar(20) DEFAULT 'pending',
	"date" date NOT NULL,
	"hours" integer DEFAULT 0 NOT NULL,
	"approved_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" varchar(100) NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"company_id" uuid,
	"site_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"created_at" timestamp with time zone DEFAULT timezone('Asia/Bangkok', now())
);
--> statement-breakpoint
ALTER TABLE "attendance" DROP CONSTRAINT "attendance_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "attendance" ALTER COLUMN "check_in" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance" ALTER COLUMN "check_out" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "shift_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "temp_shift_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "is_late" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "is_early_exit" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "late_minutes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "early_exit_minutes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "overtime" ADD CONSTRAINT "overtime_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime" ADD CONSTRAINT "overtime_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime" ADD CONSTRAINT "overtime_attendance_id_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime" ADD CONSTRAINT "overtime_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_shifts" ADD CONSTRAINT "temporary_shifts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_shifts" ADD CONSTRAINT "temporary_shifts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_shifts" ADD CONSTRAINT "temporary_shifts_overtime_id_overtime_id_fk" FOREIGN KEY ("overtime_id") REFERENCES "public"."overtime"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_shifts" ADD CONSTRAINT "temporary_shifts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_temp_shift_id_temporary_shifts_id_fk" FOREIGN KEY ("temp_shift_id") REFERENCES "public"."temporary_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;