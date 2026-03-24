ALTER TABLE "company" DROP CONSTRAINT "company_admin_creator_id_admins_id_fk";
--> statement-breakpoint
ALTER TABLE "company" DROP COLUMN "admin_creator_id";