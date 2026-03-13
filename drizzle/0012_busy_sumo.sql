ALTER TABLE "attendance" DROP CONSTRAINT "attendance_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" DROP COLUMN "late_minutes";--> statement-breakpoint
ALTER TABLE "attendance" DROP COLUMN "early_exit_minutes";