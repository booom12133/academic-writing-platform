ALTER TABLE "paper_sections" ADD COLUMN "section_role" varchar(20) DEFAULT 'OUTLINE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "paper_sections" ADD CONSTRAINT "paper_sections_role_check" CHECK ("section_role" in ('OUTLINE','ABSTRACT','KEYWORDS'));
--> statement-breakpoint
ALTER TABLE "paper_sections" ADD CONSTRAINT "paper_sections_role_outline_check" CHECK (("section_role"='OUTLINE' AND "outline_node_id" IS NOT NULL) OR ("section_role" in ('ABSTRACT','KEYWORDS') AND "outline_node_id" IS NULL AND "status"<>'orphaned'));
--> statement-breakpoint
CREATE UNIQUE INDEX "paper_sections_active_derived_role_key" ON "paper_sections" ("project_id","user_id","section_role") WHERE "section_role" in ('ABSTRACT','KEYWORDS') AND "status"='active';
