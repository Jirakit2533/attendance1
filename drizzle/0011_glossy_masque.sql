ALTER TABLE "attendance" ALTER COLUMN "check_in" SET DATA TYPE time;--> statement-breakpoint
ALTER TABLE "attendance" ALTER COLUMN "check_out" SET DATA TYPE time;--> statement-breakpoint
ALTER TABLE "shifts" DROP COLUMN "name";