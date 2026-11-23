ALTER TABLE "notification_devices" DROP CONSTRAINT "notification_devices_installation_id_unique";--> statement-breakpoint
ALTER TABLE "notification_devices" ADD COLUMN "fcm_token" text NOT NULL;--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD COLUMN "is_after_midnight" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_devices" DROP COLUMN "installation_id";--> statement-breakpoint
ALTER TABLE "notification_devices" ADD CONSTRAINT "notification_devices_fcm_token_unique" UNIQUE("fcm_token");