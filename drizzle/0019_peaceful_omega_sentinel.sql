ALTER TABLE "automation_logs" RENAME COLUMN "execution_count" TO "retry_count";--> statement-breakpoint
ALTER TABLE "automation_logs" ALTER COLUMN "end_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "automation_logs" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "automation_logs" ADD COLUMN "duration_ms" integer;