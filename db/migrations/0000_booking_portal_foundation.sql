CREATE TABLE "booking_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"purpose" text DEFAULT 'manage_booking' NOT NULL,
	"token_digest" char(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_access_tokens_purpose_check" CHECK ("booking_access_tokens"."purpose" = 'manage_booking'),
	CONSTRAINT "booking_access_tokens_expiry_check" CHECK ("booking_access_tokens"."expires_at" > "booking_access_tokens"."created_at")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"stripe_checkout_session_id" text NOT NULL,
	"stripe_payment_intent_id" text,
	"payment_status" text DEFAULT 'paid' NOT NULL,
	"fulfillment_status" text DEFAULT 'pending' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"site_address" text NOT NULL,
	"service_code" text NOT NULL,
	"package_name" text NOT NULL,
	"kwp" numeric(10, 3),
	"currency" char(3) DEFAULT 'sgd' NOT NULL,
	"subtotal_cents" bigint NOT NULL,
	"gst_cents" bigint NOT NULL,
	"total_cents" bigint NOT NULL,
	"slot_start" timestamp with time zone NOT NULL,
	"slot_end" timestamp with time zone NOT NULL,
	"graph_event_id" text,
	"calendar_status" text DEFAULT 'pending' NOT NULL,
	"customer_email_status" text DEFAULT 'pending' NOT NULL,
	"operations_email_status" text DEFAULT 'pending' NOT NULL,
	"reschedule_count" integer DEFAULT 0 NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_payment_status_check" CHECK ("bookings"."payment_status" in ('pending', 'paid', 'partially_refunded', 'refunded', 'disputed')),
	CONSTRAINT "bookings_fulfillment_status_check" CHECK ("bookings"."fulfillment_status" in ('pending', 'processing', 'complete', 'attention')),
	CONSTRAINT "bookings_calendar_status_check" CHECK ("bookings"."calendar_status" in ('pending', 'processing', 'created', 'failed')),
	CONSTRAINT "bookings_customer_email_status_check" CHECK ("bookings"."customer_email_status" in ('pending', 'processing', 'sent', 'failed', 'suppressed')),
	CONSTRAINT "bookings_operations_email_status_check" CHECK ("bookings"."operations_email_status" in ('pending', 'processing', 'sent', 'failed', 'suppressed')),
	CONSTRAINT "bookings_currency_check" CHECK ("bookings"."currency" = 'sgd'),
	CONSTRAINT "bookings_subtotal_nonnegative" CHECK ("bookings"."subtotal_cents" >= 0),
	CONSTRAINT "bookings_gst_nonnegative" CHECK ("bookings"."gst_cents" >= 0),
	CONSTRAINT "bookings_total_positive" CHECK ("bookings"."total_cents" > 0),
	CONSTRAINT "bookings_total_matches_components" CHECK ("bookings"."total_cents" = "bookings"."subtotal_cents" + "bookings"."gst_cents"),
	CONSTRAINT "bookings_slot_order_check" CHECK ("bookings"."slot_end" > "bookings"."slot_start"),
	CONSTRAINT "bookings_reschedule_count_check" CHECK ("bookings"."reschedule_count" >= 0),
	CONSTRAINT "bookings_record_version_check" CHECK ("bookings"."record_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"uploaded_via_token_id" uuid,
	"category" text DEFAULT 'pv_document' NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256_digest" char(64),
	"storage_provider" text DEFAULT 'vercel_blob' NOT NULL,
	"blob_pathname" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_category_check" CHECK ("documents"."category" in ('sld', 'pv_document', 'other')),
	CONSTRAINT "documents_storage_provider_check" CHECK ("documents"."storage_provider" = 'vercel_blob'),
	CONSTRAINT "documents_status_check" CHECK ("documents"."status" in ('pending', 'available', 'quarantined', 'deleted')),
	CONSTRAINT "documents_size_positive" CHECK ("documents"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "fulfillment_steps" (
	"booking_id" uuid NOT NULL,
	"step_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"external_id" text,
	"failure_code" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fulfillment_steps_booking_id_step_name_pk" PRIMARY KEY("booking_id","step_name"),
	CONSTRAINT "fulfillment_steps_name_check" CHECK ("fulfillment_steps"."step_name" in ('calendar', 'manage_link', 'customer_email', 'operations_email')),
	CONSTRAINT "fulfillment_steps_status_check" CHECK ("fulfillment_steps"."status" in ('pending', 'processing', 'complete', 'failed')),
	CONSTRAINT "fulfillment_steps_attempt_count_check" CHECK ("fulfillment_steps"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reschedule_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_key" text NOT NULL,
	"booking_id" uuid NOT NULL,
	"requested_by" text DEFAULT 'customer' NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"previous_slot_start" timestamp with time zone NOT NULL,
	"previous_slot_end" timestamp with time zone NOT NULL,
	"requested_slot_start" timestamp with time zone NOT NULL,
	"requested_slot_end" timestamp with time zone NOT NULL,
	"failure_code" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reschedule_requests_requested_by_check" CHECK ("reschedule_requests"."requested_by" in ('customer', 'staff')),
	CONSTRAINT "reschedule_requests_status_check" CHECK ("reschedule_requests"."status" in ('requested', 'processing', 'completed', 'failed', 'cancelled')),
	CONSTRAINT "reschedule_requests_previous_slot_order_check" CHECK ("reschedule_requests"."previous_slot_end" > "reschedule_requests"."previous_slot_start"),
	CONSTRAINT "reschedule_requests_requested_slot_order_check" CHECK ("reschedule_requests"."requested_slot_end" > "reschedule_requests"."requested_slot_start")
);
--> statement-breakpoint
CREATE TABLE "slot_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"reschedule_request_id" uuid,
	"resource_key" text DEFAULT 'fomo-maintenance' NOT NULL,
	"slot_start" timestamp with time zone NOT NULL,
	"slot_end" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slot_reservations_slot_order_check" CHECK ("slot_reservations"."slot_end" > "slot_reservations"."slot_start"),
	CONSTRAINT "slot_reservations_status_check" CHECK ("slot_reservations"."status" in ('held', 'confirmed', 'released', 'expired')),
	CONSTRAINT "slot_reservations_hold_expiry_check" CHECK ("slot_reservations"."status" <> 'held' or "slot_reservations"."hold_expires_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"provider" text DEFAULT 'stripe' NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"booking_id" uuid,
	"failure_code" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_provider_event_id_pk" PRIMARY KEY("provider","event_id"),
	CONSTRAINT "webhook_events_provider_check" CHECK ("webhook_events"."provider" = 'stripe'),
	CONSTRAINT "webhook_events_status_check" CHECK ("webhook_events"."status" in ('received', 'processing', 'processed', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "booking_access_tokens" ADD CONSTRAINT "booking_access_tokens_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_via_token_id_booking_access_tokens_id_fk" FOREIGN KEY ("uploaded_via_token_id") REFERENCES "public"."booking_access_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_steps" ADD CONSTRAINT "fulfillment_steps_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_reschedule_request_id_reschedule_requests_id_fk" FOREIGN KEY ("reschedule_request_id") REFERENCES "public"."reschedule_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_access_tokens_digest_unique" ON "booking_access_tokens" USING btree ("token_digest");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_access_tokens_one_active_manage_link" ON "booking_access_tokens" USING btree ("booking_id","purpose") WHERE "booking_access_tokens"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "booking_access_tokens_booking_idx" ON "booking_access_tokens" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_reference_unique" ON "bookings" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_stripe_checkout_session_unique" ON "bookings" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_stripe_payment_intent_unique" ON "bookings" USING btree ("stripe_payment_intent_id") WHERE "bookings"."stripe_payment_intent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_graph_event_unique" ON "bookings" USING btree ("graph_event_id") WHERE "bookings"."graph_event_id" is not null;--> statement-breakpoint
CREATE INDEX "bookings_customer_email_idx" ON "bookings" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "bookings_slot_start_idx" ON "bookings" USING btree ("slot_start");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_blob_pathname_unique" ON "documents" USING btree ("blob_pathname");--> statement-breakpoint
CREATE INDEX "documents_booking_uploaded_idx" ON "documents" USING btree ("booking_id","uploaded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reschedule_requests_request_key_unique" ON "reschedule_requests" USING btree ("request_key");--> statement-breakpoint
CREATE INDEX "reschedule_requests_booking_created_idx" ON "reschedule_requests" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "slot_reservations_active_window_unique" ON "slot_reservations" USING btree ("resource_key","slot_start","slot_end") WHERE "slot_reservations"."status" in ('held', 'confirmed');--> statement-breakpoint
CREATE INDEX "slot_reservations_booking_idx" ON "slot_reservations" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "slot_reservations_expiry_idx" ON "slot_reservations" USING btree ("hold_expires_at");--> statement-breakpoint
CREATE INDEX "webhook_events_booking_idx" ON "webhook_events" USING btree ("booking_id");