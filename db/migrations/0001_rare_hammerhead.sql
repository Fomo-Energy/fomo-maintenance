ALTER TABLE "documents" ADD COLUMN "quota_slot" integer;--> statement-breakpoint
WITH "ranked_documents" AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "booking_id"
			ORDER BY "created_at", "id"
		) AS "slot"
	FROM "documents"
	WHERE "status" in ('pending', 'available', 'quarantined')
)
UPDATE "documents"
SET "quota_slot" = "ranked_documents"."slot"
FROM "ranked_documents"
WHERE "documents"."id" = "ranked_documents"."id";--> statement-breakpoint
UPDATE "documents" SET "quota_slot" = 1 WHERE "quota_slot" IS NULL;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "quota_slot" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_active_quota_slot_unique" ON "documents" USING btree ("booking_id","quota_slot") WHERE "documents"."status" in ('pending', 'available', 'quarantined');--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_quota_slot_check" CHECK ("documents"."quota_slot" between 1 and 10);
