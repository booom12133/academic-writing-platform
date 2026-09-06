CREATE TABLE "zotero_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"library_type" varchar(16) NOT NULL,
	"library_id" varchar(64) NOT NULL,
	"ciphertext" text NOT NULL,
	"nonce" varchar(128) NOT NULL,
	"auth_tag" varchar(128) NOT NULL,
	"encryption_algorithm" varchar(32) NOT NULL,
	"encryption_key_version" varchar(64) NOT NULL,
	"key_fingerprint" varchar(128) NOT NULL,
	"status" varchar(24) NOT NULL,
	"last_checked_at" timestamp (3) with time zone,
	"last_seen_library_version" varchar(255),
	"_created_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_at" timestamp (3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "external_identity" varchar(255);--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "external_version" varchar(255);--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "external_checksum_algorithm" varchar(32);--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "external_checksum" varchar(128);--> statement-breakpoint
CREATE UNIQUE INDEX "zotero_connections_id_user_id_key" ON "zotero_connections" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zotero_connections_identity_key" ON "zotero_connections" USING btree ("user_id","library_type","library_id");--> statement-breakpoint
CREATE INDEX "zotero_connections_user_status_idx" ON "zotero_connections" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_documents_external_identity_key" ON "knowledge_documents" USING btree ("user_id","external_identity");