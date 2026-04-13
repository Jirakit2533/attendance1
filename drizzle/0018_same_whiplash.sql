CREATE TABLE "automation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" varchar(255) NOT NULL,
	"date" date NOT NULL,
	"start_at" timestamp with time zone DEFAULT timezone('UTC', now()),
	"end_at" timestamp with time zone DEFAULT timezone('UTC', now()),
	"read_count" integer DEFAULT 0 NOT NULL,
	"change_count" integer DEFAULT 0 NOT NULL,
	"executed_count" integer DEFAULT 0 NOT NULL,
	"deleted_count" integer DEFAULT 0 NOT NULL,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'success',
	"details" jsonb
);
