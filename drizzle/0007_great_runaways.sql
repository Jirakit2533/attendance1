ALTER TABLE "overtime_requests" ALTER COLUMN "approved_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "overtime_requests" ALTER COLUMN "approved_at" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "overtime_requests" ALTER COLUMN "rejected_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "overtime_requests" ALTER COLUMN "rejected_at" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "overtime_requests" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "overtime_requests" ALTER COLUMN "deleted_at" SET DEFAULT timezone('UTC', now());