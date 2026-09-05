CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "knowledge_chunk_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"knowledge_embedding_index_id" uuid NOT NULL,
	"knowledge_chunk_id" uuid NOT NULL,
	"input_fingerprint" varchar(64) NOT NULL,
	"embedding_profile_fingerprint" varchar(64) NOT NULL,
	"dimensions" integer NOT NULL,
	"embedding" vector,
	"status" varchar(16) NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error_code" varchar(64),
	"last_error_message" varchar(512),
	"_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"indexed_at" timestamp (3) with time zone,
	CONSTRAINT "knowledge_chunk_embeddings_status_check" CHECK ("knowledge_chunk_embeddings"."status" in ('indexing', 'indexed', 'failed', 'stale')),
	CONSTRAINT "knowledge_chunk_embeddings_dimensions_check" CHECK ("knowledge_chunk_embeddings"."dimensions" > 0),
	CONSTRAINT "knowledge_chunk_embeddings_vector_dimensions_check" CHECK ("knowledge_chunk_embeddings"."embedding" is null or vector_dims("knowledge_chunk_embeddings"."embedding") = "knowledge_chunk_embeddings"."dimensions"),
	CONSTRAINT "knowledge_chunk_embeddings_indexed_vector_check" CHECK ("knowledge_chunk_embeddings"."status" <> 'indexed' or "knowledge_chunk_embeddings"."embedding" is not null)
);
--> statement-breakpoint
CREATE TABLE "knowledge_embedding_indexes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"document_version_id" uuid NOT NULL,
	"e1_index_input_fingerprint" varchar(64) NOT NULL,
	"embedding_profile_fingerprint" varchar(64) NOT NULL,
	"index_fingerprint" varchar(64) NOT NULL,
	"embedding_model_identity" jsonb NOT NULL,
	"status" varchar(16) NOT NULL,
	"total_chunks" integer NOT NULL,
	"indexed_chunks" integer DEFAULT 0 NOT NULL,
	"failed_chunks" integer DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error_code" varchar(64),
	"last_error_message" varchar(512),
	"lease_owner" varchar(128),
	"lease_expires_at" timestamp (3) with time zone,
	"_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"indexed_at" timestamp (3) with time zone,
	CONSTRAINT "knowledge_embedding_indexes_status_check" CHECK ("knowledge_embedding_indexes"."status" in ('indexing', 'indexed', 'failed', 'stale')),
	CONSTRAINT "knowledge_embedding_indexes_counts_check" CHECK ("knowledge_embedding_indexes"."total_chunks" >= 0 and "knowledge_embedding_indexes"."indexed_chunks" >= 0 and "knowledge_embedding_indexes"."failed_chunks" >= 0 and "knowledge_embedding_indexes"."indexed_chunks" + "knowledge_embedding_indexes"."failed_chunks" <= "knowledge_embedding_indexes"."total_chunks")
);
--> statement-breakpoint
ALTER TABLE "knowledge_chunk_embeddings" ADD CONSTRAINT "knowledge_chunk_embeddings_index_owner_fk" FOREIGN KEY ("knowledge_embedding_index_id","user_id") REFERENCES "public"."knowledge_embedding_indexes"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunk_embeddings" ADD CONSTRAINT "knowledge_chunk_embeddings_chunk_owner_fk" FOREIGN KEY ("knowledge_chunk_id","user_id") REFERENCES "public"."knowledge_chunks"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_embedding_indexes" ADD CONSTRAINT "knowledge_embedding_indexes_version_owner_fk" FOREIGN KEY ("document_version_id","user_id") REFERENCES "public"."knowledge_document_versions"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunk_embeddings_id_user_id_key" ON "knowledge_chunk_embeddings" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunk_embeddings_identity_key" ON "knowledge_chunk_embeddings" USING btree ("user_id","knowledge_chunk_id","embedding_profile_fingerprint","input_fingerprint");--> statement-breakpoint
CREATE INDEX "knowledge_chunk_embeddings_user_index_status_idx" ON "knowledge_chunk_embeddings" USING btree ("user_id","knowledge_embedding_index_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_embedding_indexes_id_user_id_key" ON "knowledge_embedding_indexes" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_embedding_indexes_version_fingerprint_key" ON "knowledge_embedding_indexes" USING btree ("document_version_id","index_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_embedding_indexes_natural_key" ON "knowledge_embedding_indexes" USING btree ("user_id","document_version_id","e1_index_input_fingerprint","embedding_profile_fingerprint");--> statement-breakpoint
CREATE INDEX "knowledge_embedding_indexes_user_version_status_idx" ON "knowledge_embedding_indexes" USING btree ("user_id","document_version_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_embedding_indexes_lease_idx" ON "knowledge_embedding_indexes" USING btree ("status","lease_expires_at");
