CREATE TYPE "public"."working_status" AS ENUM('normal', 'extra');--> statement-breakpoint
ALTER TABLE "overtime" RENAME COLUMN "overtime_today" TO "overtime_before";--> statement-breakpoint
ALTER TABLE "overtime" RENAME COLUMN "overtime_collected" TO "overtime_after";--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "working_status" "working_status" DEFAULT 'normal';--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "ot_rounding_option" varchar(30) NOT NULL;--> statement-breakpoint
ALTER TABLE "overtime" DROP COLUMN "total_overtime_approved";--> statement-breakpoint
ALTER TABLE "overtime" ADD CONSTRAINT "overtime_attendance_id_unique" UNIQUE("attendance_id");