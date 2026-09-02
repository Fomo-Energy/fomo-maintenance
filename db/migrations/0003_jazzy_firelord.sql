CREATE TABLE "email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"reschedule_request_id" uuid,
	"message_kind" text NOT NULL,
	"recipient" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider" text DEFAULT 'resend' NOT NULL,
	"provider_message_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"failure_code" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_deliveries_message_kind_check" CHECK ("email_deliveries"."message_kind" in ('booking_customer', 'booking_operations', 'reschedule_customer', 'reschedule_operations')),
	CONSTRAINT "email_deliveries_provider_check" CHECK ("email_deliveries"."provider" = 'resend'),
	CONSTRAINT "email_deliveries_status_check" CHECK ("email_deliveries"."status" in ('pending', 'processing', 'sent', 'failed', 'suppressed')),
	CONSTRAINT "email_deliveries_attempt_count_check" CHECK ("email_deliveries"."attempt_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_reschedule_request_id_reschedule_requests_id_fk" FOREIGN KEY ("reschedule_request_id") REFERENCES "public"."reschedule_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_idempotency_key_unique" ON "email_deliveries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "email_deliveries_booking_created_idx" ON "email_deliveries" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "email_deliveries_status_updated_idx" ON "email_deliveries" USING btree ("status","updated_at");