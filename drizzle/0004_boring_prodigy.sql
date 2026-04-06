CREATE TYPE "public"."ot_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "overtime" RENAME COLUMN "status" TO "ot_status";