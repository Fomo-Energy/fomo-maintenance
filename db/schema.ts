import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  check,
  index,
  integer,
  numeric,
  primaryKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true })
  .defaultNow()
  .notNull();

const updatedAt = timestamp("updated_at", { withTimezone: true })
  .defaultNow()
  .notNull();

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: text("reference").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    paymentStatus: text("payment_status").default("paid").notNull(),
    fulfillmentStatus: text("fulfillment_status").default("pending").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    siteAddress: text("site_address").notNull(),
    serviceCode: text("service_code").notNull(),
    packageName: text("package_name").notNull(),
    kwp: numeric("kwp", { precision: 10, scale: 3 }),
    currency: char("currency", { length: 3 }).default("sgd").notNull(),
    subtotalCents: bigint("subtotal_cents", { mode: "number" }).notNull(),
    gstCents: bigint("gst_cents", { mode: "number" }).notNull(),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    slotStart: timestamp("slot_start", { withTimezone: true }).notNull(),
    slotEnd: timestamp("slot_end", { withTimezone: true }).notNull(),
    graphEventId: text("graph_event_id"),
    calendarStatus: text("calendar_status").default("pending").notNull(),
    customerEmailStatus: text("customer_email_status")
      .default("pending")
      .notNull(),
    operationsEmailStatus: text("operations_email_status")
      .default("pending")
      .notNull(),
    rescheduleCount: integer("reschedule_count").default(0).notNull(),
    recordVersion: integer("record_version").default(1).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("bookings_reference_unique").on(table.reference),
    uniqueIndex("bookings_stripe_checkout_session_unique").on(
      table.stripeCheckoutSessionId,
    ),
    uniqueIndex("bookings_stripe_payment_intent_unique")
      .on(table.stripePaymentIntentId)
      .where(sql`${table.stripePaymentIntentId} is not null`),
    uniqueIndex("bookings_graph_event_unique")
      .on(table.graphEventId)
      .where(sql`${table.graphEventId} is not null`),
    index("bookings_customer_email_idx").on(table.customerEmail),
    index("bookings_slot_start_idx").on(table.slotStart),
    check(
      "bookings_payment_status_check",
      sql`${table.paymentStatus} in ('pending', 'paid', 'partially_refunded', 'refunded', 'disputed')`,
    ),
    check(
      "bookings_fulfillment_status_check",
      sql`${table.fulfillmentStatus} in ('pending', 'processing', 'complete', 'attention')`,
    ),
    check(
      "bookings_calendar_status_check",
      sql`${table.calendarStatus} in ('pending', 'processing', 'created', 'failed')`,
    ),
    check(
      "bookings_customer_email_status_check",
      sql`${table.customerEmailStatus} in ('pending', 'processing', 'sent', 'failed', 'suppressed')`,
    ),
    check(
      "bookings_operations_email_status_check",
      sql`${table.operationsEmailStatus} in ('pending', 'processing', 'sent', 'failed', 'suppressed')`,
    ),
    check("bookings_currency_check", sql`${table.currency} = 'sgd'`),
    check("bookings_subtotal_nonnegative", sql`${table.subtotalCents} >= 0`),
    check("bookings_gst_nonnegative", sql`${table.gstCents} >= 0`),
    check("bookings_total_positive", sql`${table.totalCents} > 0`),
    check(
      "bookings_total_matches_components",
      sql`${table.totalCents} = ${table.subtotalCents} + ${table.gstCents}`,
    ),
    check("bookings_slot_order_check", sql`${table.slotEnd} > ${table.slotStart}`),
    check("bookings_reschedule_count_check", sql`${table.rescheduleCount} >= 0`),
    check("bookings_record_version_check", sql`${table.recordVersion} > 0`),
  ],
);

export const bookingAccessTokens = pgTable(
  "booking_access_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    purpose: text("purpose").default("manage_booking").notNull(),
    tokenDigest: char("token_digest", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt,
  },
  (table) => [
    uniqueIndex("booking_access_tokens_digest_unique").on(table.tokenDigest),
    uniqueIndex("booking_access_tokens_one_active_manage_link")
      .on(table.bookingId, table.purpose)
      .where(sql`${table.revokedAt} is null`),
    index("booking_access_tokens_booking_idx").on(table.bookingId),
    check(
      "booking_access_tokens_purpose_check",
      sql`${table.purpose} = 'manage_booking'`,
    ),
    check(
      "booking_access_tokens_expiry_check",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    uploadedViaTokenId: uuid("uploaded_via_token_id").references(
      () => bookingAccessTokens.id,
      { onDelete: "set null" },
    ),
    category: text("category").default("pv_document").notNull(),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256Digest: char("sha256_digest", { length: 64 }),
    storageProvider: text("storage_provider").default("vercel_blob").notNull(),
    blobPathname: text("blob_pathname").notNull(),
    status: text("status").default("pending").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("documents_blob_pathname_unique").on(table.blobPathname),
    index("documents_booking_uploaded_idx").on(
      table.bookingId,
      table.uploadedAt,
    ),
    check(
      "documents_category_check",
      sql`${table.category} in ('sld', 'pv_document', 'other')`,
    ),
    check(
      "documents_storage_provider_check",
      sql`${table.storageProvider} = 'vercel_blob'`,
    ),
    check(
      "documents_status_check",
      sql`${table.status} in ('pending', 'available', 'quarantined', 'deleted')`,
    ),
    check("documents_size_positive", sql`${table.sizeBytes} > 0`),
  ],
);

export const rescheduleRequests = pgTable(
  "reschedule_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestKey: text("request_key").notNull(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    requestedBy: text("requested_by").default("customer").notNull(),
    status: text("status").default("requested").notNull(),
    previousSlotStart: timestamp("previous_slot_start", {
      withTimezone: true,
    }).notNull(),
    previousSlotEnd: timestamp("previous_slot_end", {
      withTimezone: true,
    }).notNull(),
    requestedSlotStart: timestamp("requested_slot_start", {
      withTimezone: true,
    }).notNull(),
    requestedSlotEnd: timestamp("requested_slot_end", {
      withTimezone: true,
    }).notNull(),
    failureCode: text("failure_code"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("reschedule_requests_request_key_unique").on(table.requestKey),
    index("reschedule_requests_booking_created_idx").on(
      table.bookingId,
      table.createdAt,
    ),
    check(
      "reschedule_requests_requested_by_check",
      sql`${table.requestedBy} in ('customer', 'staff')`,
    ),
    check(
      "reschedule_requests_status_check",
      sql`${table.status} in ('requested', 'processing', 'completed', 'failed', 'cancelled')`,
    ),
    check(
      "reschedule_requests_previous_slot_order_check",
      sql`${table.previousSlotEnd} > ${table.previousSlotStart}`,
    ),
    check(
      "reschedule_requests_requested_slot_order_check",
      sql`${table.requestedSlotEnd} > ${table.requestedSlotStart}`,
    ),
  ],
);

export const slotReservations = pgTable(
  "slot_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    rescheduleRequestId: uuid("reschedule_request_id").references(
      () => rescheduleRequests.id,
      { onDelete: "cascade" },
    ),
    resourceKey: text("resource_key").default("fomo-maintenance").notNull(),
    slotStart: timestamp("slot_start", { withTimezone: true }).notNull(),
    slotEnd: timestamp("slot_end", { withTimezone: true }).notNull(),
    status: text("status").default("held").notNull(),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("slot_reservations_active_window_unique")
      .on(table.resourceKey, table.slotStart, table.slotEnd)
      .where(sql`${table.status} in ('held', 'confirmed')`),
    index("slot_reservations_booking_idx").on(table.bookingId),
    index("slot_reservations_expiry_idx").on(table.holdExpiresAt),
    check("slot_reservations_slot_order_check", sql`${table.slotEnd} > ${table.slotStart}`),
    check(
      "slot_reservations_status_check",
      sql`${table.status} in ('held', 'confirmed', 'released', 'expired')`,
    ),
    check(
      "slot_reservations_hold_expiry_check",
      sql`${table.status} <> 'held' or ${table.holdExpiresAt} is not null`,
    ),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    provider: text("provider").default("stripe").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    status: text("status").default("received").notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    failureCode: text("failure_code"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    updatedAt,
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.eventId] }),
    index("webhook_events_booking_idx").on(table.bookingId),
    check("webhook_events_provider_check", sql`${table.provider} = 'stripe'`),
    check(
      "webhook_events_status_check",
      sql`${table.status} in ('received', 'processing', 'processed', 'failed')`,
    ),
  ],
);

export const fulfillmentSteps = pgTable(
  "fulfillment_steps",
  {
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    stepName: text("step_name").notNull(),
    status: text("status").default("pending").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    externalId: text("external_id"),
    failureCode: text("failure_code"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    primaryKey({ columns: [table.bookingId, table.stepName] }),
    check(
      "fulfillment_steps_name_check",
      sql`${table.stepName} in ('calendar', 'manage_link', 'customer_email', 'operations_email')`,
    ),
    check(
      "fulfillment_steps_status_check",
      sql`${table.status} in ('pending', 'processing', 'complete', 'failed')`,
    ),
    check(
      "fulfillment_steps_attempt_count_check",
      sql`${table.attemptCount} >= 0`,
    ),
  ],
);

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type BookingAccessToken = typeof bookingAccessTokens.$inferSelect;
export type FulfillmentStepName =
  | "calendar"
  | "manage_link"
  | "customer_email"
  | "operations_email";
export type DocumentRecord = typeof documents.$inferSelect;
export type RescheduleRequest = typeof rescheduleRequests.$inferSelect;
export type SlotReservation = typeof slotReservations.$inferSelect;
