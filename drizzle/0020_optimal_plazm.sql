ALTER TABLE "logs" DROP CONSTRAINT "logs_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "logs" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "logs" ALTER COLUMN "login_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "logs" ALTER COLUMN "logout_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "logs" ADD COLUMN "role" varchar(50);--> statement-breakpoint
ALTER TABLE "logs" ADD COLUMN "action" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "logs" ADD COLUMN "ip_address" varchar(45);--> statement-breakpoint
ALTER TABLE "logs" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "logs" ADD COLUMN "details" jsonb;--> statement-breakpoint
ALTER TABLE "logs" ADD COLUMN "created_at" timestamp with time zone DEFAULT timezone('UTC', now()) NOT NULL;