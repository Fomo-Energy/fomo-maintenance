CREATE TABLE "api_rate_limits" (
	"action" text NOT NULL,
	"identifier_digest" char(64) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_rate_limits_action_identifier_digest_window_start_pk" PRIMARY KEY("action","identifier_digest","window_start"),
	CONSTRAINT "api_rate_limits_action_check" CHECK ("api_rate_limits"."action" in ('availability', 'checkout')),
	CONSTRAINT "api_rate_limits_count_positive" CHECK ("api_rate_limits"."request_count" > 0),
	CONSTRAINT "api_rate_limits_expiry_after_window" CHECK ("api_rate_limits"."expires_at" > "api_rate_limits"."window_start")
);
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_calendar_status_check";--> statement-breakpoint
ALTER TABLE "email_deliveries" DROP CONSTRAINT "email_deliveries_message_kind_check";--> statement-breakpoint
ALTER TABLE "slot_reservations" DROP CONSTRAINT "slot_reservations_owner_check";--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD COLUMN "checkout_request_key" text;--> statement-breakpoint
CREATE INDEX "api_rate_limits_expiry_idx" ON "api_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "slot_reservations_checkout_request_unique" ON "slot_reservations" USING btree ("checkout_request_key") WHERE "slot_reservations"."checkout_request_key" is not null;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_calendar_status_check" CHECK ("bookings"."calendar_status" in ('pending', 'processing', 'created', 'failed', 'cancelled'));--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_message_kind_check" CHECK ("email_deliveries"."message_kind" in ('booking_customer', 'booking_operations', 'reschedule_customer', 'reschedule_operations', 'partial_refund_operations', 'dispute_operations'));--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_owner_check" CHECK ("slot_reservations"."booking_id" is not null or "slot_reservations"."stripe_checkout_session_id" is not null or "slot_reservations"."checkout_request_key" is not null);