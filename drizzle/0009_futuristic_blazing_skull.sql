ALTER TYPE "public"."day_off" ADD VALUE 'saturday_sunday';--> statement-breakpoint
ALTER TABLE "overtime" RENAME COLUMN "overtime_rejected" TO "overtime_on_day_off";--> statement-breakpoint
ALTER TABLE "shifts" ALTER COLUMN "day_off" SET DEFAULT 'sunday';