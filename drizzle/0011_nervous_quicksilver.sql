ALTER TABLE "overtime_requests" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "overtime_requests" ALTER COLUMN "status" SET DATA TYPE "public"."ot_status" USING "status"::text::"public"."ot_status";--> statement-breakpoint
ALTER TABLE "overtime_requests" ALTER COLUMN "status" SET DEFAULT 'pending';