ALTER TABLE "positions" ADD COLUMN "update_by_id" uuid;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "deleted_by_id" uuid;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "created_by_id" uuid;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "update_by_id" uuid;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "deleted_by_id" uuid;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "deleted_by_id" uuid;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_update_by_id_users_id_fk" FOREIGN KEY ("update_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_update_by_id_users_id_fk" FOREIGN KEY ("update_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;