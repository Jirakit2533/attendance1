CREATE TABLE "notification_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"installation_id" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now()) NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "notification_devices_installation_id_unique" UNIQUE("installation_id")
);
--> statement-breakpoint
ALTER TABLE "notification_devices" ADD CONSTRAINT "notification_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;