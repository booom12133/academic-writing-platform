CREATE TABLE "paper_exports" (
  "id" uuid PRIMARY KEY NOT NULL,
  "project_id" uuid NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "format" varchar(16) NOT NULL,
  "template_key" varchar(64) NOT NULL,
  "template_version" varchar(32) NOT NULL,
  "renderer_version" varchar(32) NOT NULL,
  "manuscript_fingerprint" varchar(64) NOT NULL,
  "snapshot_manifest" jsonb NOT NULL,
  "artifact_ref" jsonb NOT NULL,
  "_created_at" timestamptz(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "paper_exports_id_project_user_key" UNIQUE("id","project_id","user_id"),
  CONSTRAINT "paper_exports_project_owner_fk" FOREIGN KEY ("project_id","user_id") REFERENCES "paper_projects"("id","user_id"),
  CONSTRAINT "paper_exports_format_check" CHECK ("format" = 'DOCX'),
  CONSTRAINT "paper_exports_template_check" CHECK ("template_key" = 'generic-academic-v1'),
  CONSTRAINT "paper_exports_fingerprint_check" CHECK ("manuscript_fingerprint" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "paper_exports_manifest_object_check" CHECK (jsonb_typeof("snapshot_manifest") = 'object'),
  CONSTRAINT "paper_exports_artifact_object_check" CHECK (jsonb_typeof("artifact_ref") = 'object')
);
--> statement-breakpoint
CREATE INDEX "paper_exports_user_project_created_idx" ON "paper_exports" ("user_id","project_id","_created_at" DESC);
