CREATE TABLE "paper_projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "selected_title" varchar(500),
  "profile" jsonb NOT NULL,
  "research_plan" jsonb,
  "default_source_strategy" varchar(32) DEFAULT 'MODEL_ONLY' NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "lock_version" integer DEFAULT 0 NOT NULL,
  "_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "_updated_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "paper_projects_status_check" CHECK ("status" in ('active','archived')),
  CONSTRAINT "paper_projects_strategy_check" CHECK ("default_source_strategy" in ('MODEL_ONLY','WEB_RETRIEVED','USER_KNOWLEDGE','MIXED')),
  CONSTRAINT "paper_projects_lock_version_check" CHECK ("lock_version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "paper_outline_nodes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL, "user_id" varchar(64) NOT NULL, "parent_id" uuid,
  "node_type" varchar(20) NOT NULL, "title" varchar(500) NOT NULL, "position" integer NOT NULL,
  "target_words" integer, "generation_notes" text, "status" varchar(20) DEFAULT 'active' NOT NULL,
  "_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "_updated_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "paper_outline_nodes_type_check" CHECK ("node_type" in ('container','writing-unit')),
  CONSTRAINT "paper_outline_nodes_status_check" CHECK ("status" in ('active','archived')),
  CONSTRAINT "paper_outline_nodes_position_check" CHECK ("position" >= 0),
  CONSTRAINT "paper_outline_nodes_target_words_check" CHECK ("target_words" is null or "target_words" > 0)
);
--> statement-breakpoint
CREATE TABLE "paper_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "project_id" uuid NOT NULL,
  "user_id" varchar(64) NOT NULL, "outline_node_id" uuid, "status" varchar(20) DEFAULT 'active' NOT NULL,
  "current_revision_number" integer DEFAULT 0 NOT NULL,
  "_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "_updated_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "paper_sections_status_check" CHECK ("status" in ('active','orphaned','archived')),
  CONSTRAINT "paper_sections_revision_check" CHECK ("current_revision_number" >= 0)
);
--> statement-breakpoint
CREATE TABLE "paper_section_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "section_id" uuid NOT NULL,
  "user_id" varchar(64) NOT NULL, "revision_number" integer NOT NULL, "base_revision_id" uuid,
  "content" text NOT NULL, "content_hash" varchar(64) NOT NULL, "origin" varchar(24) NOT NULL,
  "source_strategy" varchar(32) NOT NULL, "actual_support_mode" varchar(24) NOT NULL,
  "support_state" varchar(24) NOT NULL, "citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "bibliography" jsonb DEFAULT '[]'::jsonb NOT NULL, "evidence_trace" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "generation_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL, "warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "rewrite_instruction" text, "_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "paper_section_revisions_number_check" CHECK ("revision_number" > 0),
  CONSTRAINT "paper_section_revisions_content_check" CHECK (length(trim("content")) > 0),
  CONSTRAINT "paper_section_revisions_origin_check" CHECK ("origin" in ('AI_GENERATION','AI_REWRITE','USER_EDIT')),
  CONSTRAINT "paper_section_revisions_strategy_check" CHECK ("source_strategy" in ('MODEL_ONLY','WEB_RETRIEVED','USER_KNOWLEDGE','MIXED')),
  CONSTRAINT "paper_section_revisions_support_mode_check" CHECK ("actual_support_mode" in ('AI_DRAFT','WEB_EVIDENCE','USER_EVIDENCE','MIXED_EVIDENCE')),
  CONSTRAINT "paper_section_revisions_support_state_check" CHECK ("support_state" in ('NOT_CLAIMED','VALID','STALE_AFTER_EDIT'))
);
--> statement-breakpoint
CREATE TABLE "paper_project_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "project_id" uuid NOT NULL,
  "user_id" varchar(64) NOT NULL, "source_record_id" uuid, "document_version_id" uuid,
  "origin_class" varchar(24) NOT NULL, "selection_status" varchar(20) DEFAULT 'selected' NOT NULL,
  "_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "_updated_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "paper_project_sources_identity_check" CHECK ("source_record_id" is not null or "document_version_id" is not null),
  CONSTRAINT "paper_project_sources_origin_check" CHECK ("origin_class" in ('WEB_IMPORTED','USER_KNOWLEDGE')),
  CONSTRAINT "paper_project_sources_selection_check" CHECK ("selection_status" in ('selected','unbound'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "paper_projects_id_user_id_key" ON "paper_projects" ("id","user_id");
CREATE INDEX "paper_projects_user_status_updated_idx" ON "paper_projects" ("user_id","status","_updated_at");
CREATE UNIQUE INDEX "paper_outline_nodes_id_project_user_key" ON "paper_outline_nodes" ("id","project_id","user_id");
CREATE UNIQUE INDEX "paper_outline_nodes_active_root_position_key" ON "paper_outline_nodes" ("project_id","user_id","position") WHERE "parent_id" IS NULL AND "status"='active';
CREATE UNIQUE INDEX "paper_outline_nodes_active_child_position_key" ON "paper_outline_nodes" ("project_id","user_id","parent_id","position") WHERE "parent_id" IS NOT NULL AND "status"='active';
CREATE INDEX "paper_outline_nodes_tree_idx" ON "paper_outline_nodes" ("user_id","project_id","status","parent_id","position");
CREATE UNIQUE INDEX "paper_sections_id_user_id_key" ON "paper_sections" ("id","user_id");
CREATE UNIQUE INDEX "paper_sections_project_outline_key" ON "paper_sections" ("project_id","outline_node_id");
CREATE INDEX "paper_sections_project_status_idx" ON "paper_sections" ("user_id","project_id","status");
CREATE UNIQUE INDEX "paper_section_revisions_id_section_user_key" ON "paper_section_revisions" ("id","section_id","user_id");
CREATE UNIQUE INDEX "paper_section_revisions_number_key" ON "paper_section_revisions" ("section_id","user_id","revision_number");
CREATE INDEX "paper_section_revisions_history_idx" ON "paper_section_revisions" ("user_id","section_id","revision_number" DESC);
CREATE INDEX "paper_project_sources_project_status_idx" ON "paper_project_sources" ("user_id","project_id","selection_status");
CREATE UNIQUE INDEX "paper_project_sources_project_source_key" ON "paper_project_sources" ("project_id","source_record_id") WHERE "source_record_id" IS NOT NULL;
CREATE UNIQUE INDEX "paper_project_sources_project_version_key" ON "paper_project_sources" ("project_id","document_version_id") WHERE "document_version_id" IS NOT NULL;
ALTER TABLE "paper_outline_nodes" ADD CONSTRAINT "paper_outline_nodes_project_owner_fk" FOREIGN KEY ("project_id","user_id") REFERENCES "paper_projects"("id","user_id");
ALTER TABLE "paper_outline_nodes" ADD CONSTRAINT "paper_outline_nodes_parent_owner_fk" FOREIGN KEY ("parent_id","project_id","user_id") REFERENCES "paper_outline_nodes"("id","project_id","user_id");
ALTER TABLE "paper_sections" ADD CONSTRAINT "paper_sections_project_owner_fk" FOREIGN KEY ("project_id","user_id") REFERENCES "paper_projects"("id","user_id");
ALTER TABLE "paper_sections" ADD CONSTRAINT "paper_sections_outline_owner_fk" FOREIGN KEY ("outline_node_id","project_id","user_id") REFERENCES "paper_outline_nodes"("id","project_id","user_id");
ALTER TABLE "paper_section_revisions" ADD CONSTRAINT "paper_section_revisions_section_owner_fk" FOREIGN KEY ("section_id","user_id") REFERENCES "paper_sections"("id","user_id");
ALTER TABLE "paper_section_revisions" ADD CONSTRAINT "paper_section_revisions_base_owner_fk" FOREIGN KEY ("base_revision_id","section_id","user_id") REFERENCES "paper_section_revisions"("id","section_id","user_id");
ALTER TABLE "paper_project_sources" ADD CONSTRAINT "paper_project_sources_project_owner_fk" FOREIGN KEY ("project_id","user_id") REFERENCES "paper_projects"("id","user_id");
ALTER TABLE "paper_project_sources" ADD CONSTRAINT "paper_project_sources_source_owner_fk" FOREIGN KEY ("source_record_id","user_id") REFERENCES "knowledge_source_records"("id","user_id");
ALTER TABLE "paper_project_sources" ADD CONSTRAINT "paper_project_sources_version_owner_fk" FOREIGN KEY ("document_version_id","user_id") REFERENCES "knowledge_document_versions"("id","user_id");
