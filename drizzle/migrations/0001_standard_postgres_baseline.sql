CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"phone" varchar(20),
	"username" varchar(50),
	"password_hash" varchar(255),
	"avatar_url" text,
	"points" integer DEFAULT 0 NOT NULL,
	"total_recharge" integer DEFAULT 0 NOT NULL,
	"member_level" varchar(20) DEFAULT 'normal' NOT NULL,
	"_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" text,
	"_updated_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" text
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"task_type" varchar(30) NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"points_cost" integer DEFAULT 0 NOT NULL,
	"input_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_data" jsonb,
	"error_message" text,
	"_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" text,
	"_updated_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" text
);
--> statement-breakpoint
CREATE TABLE "point_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"task_id" uuid,
	"order_id" uuid,
	"description" varchar(255),
	"_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" text,
	"_updated_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" text
);
--> statement-breakpoint
CREATE TABLE "recharge_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"amount" integer NOT NULL,
	"points" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"pay_method" varchar(20),
	"pay_order_no" varchar(100),
	"_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" text,
	"_updated_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_user_id_key" ON "app_users" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_app_users_user_id" ON "app_users" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_point_records_user_id" ON "point_records" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_point_records_created_at" ON "point_records" USING btree ("_created_at");
--> statement-breakpoint
CREATE INDEX "idx_recharge_orders_user_id" ON "recharge_orders" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_recharge_orders_status" ON "recharge_orders" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_tasks_user_id" ON "tasks" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_tasks_status" ON "tasks" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_tasks_task_type" ON "tasks" USING btree ("task_type");
--> statement-breakpoint
CREATE INDEX "idx_tasks_created_at" ON "tasks" USING btree ("_created_at");
