CREATE TABLE "company_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"feature_name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now()) NOT NULL,
	"update_by_id" uuid,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "remark" text;--> statement-breakpoint
ALTER TABLE "company_features" ADD CONSTRAINT "company_features_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_features" ADD CONSTRAINT "company_features_created_by_id_super_admins_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."super_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_features" ADD CONSTRAINT "company_features_update_by_id_super_admins_id_fk" FOREIGN KEY ("update_by_id") REFERENCES "public"."super_admins"("id") ON DELETE no action ON UPDATE no action;