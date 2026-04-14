CREATE TABLE "company_feature_selected" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"feature_selected_array" jsonb DEFAULT '[]'::jsonb,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('UTC', now()) NOT NULL,
	"update_by_id" uuid,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "feature_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "company_feature_selected_id" uuid;--> statement-breakpoint
ALTER TABLE "company_feature_selected" ADD CONSTRAINT "company_feature_selected_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_feature_selected" ADD CONSTRAINT "company_feature_selected_created_by_id_super_admins_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."super_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_feature_selected" ADD CONSTRAINT "company_feature_selected_update_by_id_super_admins_id_fk" FOREIGN KEY ("update_by_id") REFERENCES "public"."super_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_company_feature_selected_id_company_feature_selected_id_fk" FOREIGN KEY ("company_feature_selected_id") REFERENCES "public"."company_feature_selected"("id") ON DELETE no action ON UPDATE no action;