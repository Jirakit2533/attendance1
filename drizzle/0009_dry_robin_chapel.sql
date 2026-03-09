ALTER TABLE "admins" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Bangkok', now());--> statement-breakpoint
ALTER TABLE "attendance" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Bangkok', now());--> statement-breakpoint
ALTER TABLE "company" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Bangkok', now());--> statement-breakpoint
ALTER TABLE "departments" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Bangkok', now());--> statement-breakpoint
ALTER TABLE "leave" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Bangkok', now());--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Bangkok', now());--> statement-breakpoint
ALTER TABLE "sites" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Bangkok', now());--> statement-breakpoint
ALTER TABLE "super_admins" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Bangkok', now());--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Bangkok', now());