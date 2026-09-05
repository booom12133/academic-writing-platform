CREATE TABLE "knowledge_source_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"canonical_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(24) NOT NULL,
	"_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_metadata_assertions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"source_record_id" uuid NOT NULL,
	"field" varchar(32) NOT NULL,
	"value" jsonb NOT NULL,
	"provider_kind" varchar(64) NOT NULL,
	"provider" varchar(128) NOT NULL,
	"external_record_id" varchar(255) NOT NULL,
	"observed_at" timestamp (3) with time zone,
	"verification_status" varchar(24) NOT NULL,
	"assertion_hash" varchar(64) NOT NULL,
	"_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_source_external_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"source_record_id" uuid NOT NULL,
	"connector_kind" varchar(64) NOT NULL,
	"provider" varchar(128) NOT NULL,
	"external_record_id" varchar(255) NOT NULL,
	"external_version" varchar(255),
	"canonical_url" text,
	"retrieved_at" timestamp (3) with time zone,
	"license_or_access_note" text,
	"verification_status" varchar(24) NOT NULL,
	"_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"source_record_id" uuid,
	"origin_kind" varchar(32) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"source_type" varchar(16) NOT NULL,
	"active_version_id" uuid,
	"lifecycle_status" varchar(24) NOT NULL,
	"_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"original_content_hash" varchar(64) NOT NULL,
	"normalized_content_hash" varchar(64),
	"normalization_profile" jsonb,
	"parser_profile" jsonb NOT NULL,
	"chunking_profile" jsonb NOT NULL,
	"source_text" text,
	"source_artifact_ref" jsonb,
	"supersedes_version_id" uuid,
	"lifecycle_status" varchar(24) NOT NULL,
	"readiness_status" varchar(32) NOT NULL,
	"index_input_fingerprint" varchar(64) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"document_version_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"text" text NOT NULL,
	"text_hash" varchar(64) NOT NULL,
	"provenance" jsonb NOT NULL,
	"citation_locator" jsonb NOT NULL,
	"_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"request_fingerprint" varchar(64) NOT NULL,
	"document_id" uuid,
	"document_version_id" uuid,
	"status" varchar(24) NOT NULL,
	"_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
-- Composite ownership foreign keys require these referenced unique keys first.
CREATE UNIQUE INDEX "knowledge_document_versions_id_user_id_key" ON "knowledge_document_versions" USING btree ("id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_documents_id_user_id_key" ON "knowledge_documents" USING btree ("id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_source_records_id_user_id_key" ON "knowledge_source_records" USING btree ("id","user_id");
--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_version_owner_fk" FOREIGN KEY ("document_version_id","user_id") REFERENCES "public"."knowledge_document_versions"("id","user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_document_owner_fk" FOREIGN KEY ("document_id","user_id") REFERENCES "public"."knowledge_documents"("id","user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_supersedes_owner_fk" FOREIGN KEY ("supersedes_version_id","user_id") REFERENCES "public"."knowledge_document_versions"("id","user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_source_owner_fk" FOREIGN KEY ("source_record_id","user_id") REFERENCES "public"."knowledge_source_records"("id","user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_imports" ADD CONSTRAINT "knowledge_imports_document_owner_fk" FOREIGN KEY ("document_id","user_id") REFERENCES "public"."knowledge_documents"("id","user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_imports" ADD CONSTRAINT "knowledge_imports_version_owner_fk" FOREIGN KEY ("document_version_id","user_id") REFERENCES "public"."knowledge_document_versions"("id","user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_metadata_assertions" ADD CONSTRAINT "knowledge_metadata_assertions_source_owner_fk" FOREIGN KEY ("source_record_id","user_id") REFERENCES "public"."knowledge_source_records"("id","user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_source_external_links" ADD CONSTRAINT "knowledge_source_external_links_source_owner_fk" FOREIGN KEY ("source_record_id","user_id") REFERENCES "public"."knowledge_source_records"("id","user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunks_id_user_id_key" ON "knowledge_chunks" USING btree ("id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunks_version_ordinal_key" ON "knowledge_chunks" USING btree ("document_version_id","user_id","ordinal");
--> statement-breakpoint
CREATE INDEX "knowledge_chunks_user_version_ordinal_idx" ON "knowledge_chunks" USING btree ("user_id","document_version_id","ordinal");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_document_versions_number_key" ON "knowledge_document_versions" USING btree ("document_id","user_id","version_number");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_document_versions_fingerprint_key" ON "knowledge_document_versions" USING btree ("document_id","user_id","index_input_fingerprint");
--> statement-breakpoint
CREATE INDEX "knowledge_document_versions_user_document_state_idx" ON "knowledge_document_versions" USING btree ("user_id","document_id","lifecycle_status","readiness_status");
--> statement-breakpoint
CREATE INDEX "knowledge_documents_user_lifecycle_idx" ON "knowledge_documents" USING btree ("user_id","lifecycle_status");
--> statement-breakpoint
CREATE INDEX "knowledge_documents_user_source_idx" ON "knowledge_documents" USING btree ("user_id","source_record_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_imports_id_user_id_key" ON "knowledge_imports" USING btree ("id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_imports_user_idempotency_key" ON "knowledge_imports" USING btree ("user_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX "knowledge_imports_user_status_idx" ON "knowledge_imports" USING btree ("user_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_metadata_assertions_id_user_id_key" ON "knowledge_metadata_assertions" USING btree ("id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_metadata_assertions_identity_key" ON "knowledge_metadata_assertions" USING btree ("source_record_id","user_id","assertion_hash");
--> statement-breakpoint
CREATE INDEX "knowledge_metadata_assertions_user_source_field_idx" ON "knowledge_metadata_assertions" USING btree ("user_id","source_record_id","field");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_source_external_links_id_user_id_key" ON "knowledge_source_external_links" USING btree ("id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_source_external_links_identity_key" ON "knowledge_source_external_links" USING btree ("user_id","connector_kind","provider","external_record_id");
--> statement-breakpoint
CREATE INDEX "knowledge_source_external_links_user_source_idx" ON "knowledge_source_external_links" USING btree ("user_id","source_record_id");
--> statement-breakpoint
CREATE INDEX "knowledge_source_records_user_status_idx" ON "knowledge_source_records" USING btree ("user_id","status");
