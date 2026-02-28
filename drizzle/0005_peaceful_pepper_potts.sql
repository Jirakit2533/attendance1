ALTER TABLE "admins" RENAME COLUMN "created_by_id" TO "created_by_name";--> statement-breakpoint
ALTER TABLE "admins" RENAME COLUMN "update_by_id" TO "update_by_name";--> statement-breakpoint
ALTER TABLE "admins" RENAME COLUMN "deleted_by_id" TO "deleted_by_name";--> statement-breakpoint
ALTER TABLE "company" RENAME COLUMN "created_by_id" TO "created_by_name";--> statement-breakpoint
ALTER TABLE "company" RENAME COLUMN "update_by_id" TO "update_by_name";--> statement-breakpoint
ALTER TABLE "admins" DROP CONSTRAINT "admins_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "admins" DROP CONSTRAINT "admins_created_by_id_super_admins_id_fk";
--> statement-breakpoint
ALTER TABLE "admins" DROP CONSTRAINT "admins_update_by_id_super_admins_id_fk";
--> statement-breakpoint
ALTER TABLE "admins" DROP CONSTRAINT "admins_deleted_by_id_super_admins_id_fk";
--> statement-breakpoint
ALTER TABLE "company" DROP CONSTRAINT "company_created_by_id_super_admins_name_fk";
--> statement-breakpoint
ALTER TABLE "company" DROP CONSTRAINT "company_update_by_id_super_admins_name_fk";
--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_super_admins_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."super_admins"("id") ON DELETE no action ON UPDATE no action;