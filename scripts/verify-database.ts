import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

async function expectConstraintFailure(
  operation: () => Promise<unknown>,
  message: string,
): Promise<void> {
  await assert.rejects(operation, message);
}

async function migrationSql(filename: string): Promise<string> {
  return readFile(path.join(process.cwd(), "db/migrations", filename), "utf8");
}

async function verifyDocumentQuotaUpgrade(): Promise<void> {
  const database = new PGlite();
  await database.exec(await migrationSql("0000_booking_portal_foundation.sql"));
  const booking = await database.query<{ id: string }>(
    `insert into bookings (
      reference, stripe_checkout_session_id, customer_name, customer_email,
      customer_phone, site_address, service_code, package_name,
      subtotal_cents, gst_cents, total_cents, slot_start, slot_end, paid_at
    ) values (
      'FM-UPGRADE-TEST', 'cs_upgrade_test', 'Upgrade Test',
      'upgrade@example.com', '+6500000000', 'Test site', 'ESSENTIAL',
      'Essential Health Check', 19900, 1791, 21691,
      '2026-10-05T01:00:00.000Z', '2026-10-05T05:00:00.000Z', now()
    ) returning id`,
  );
  const bookingId = booking.rows[0]?.id;
  assert.ok(bookingId);
  await database.query(
    `insert into documents (
      booking_id, original_filename, content_type, size_bytes, blob_pathname
    ) values ($1, 'pre-migration.pdf', 'application/pdf', 1024, $2)`,
    [bookingId, "booking-documents/pre-migration.pdf"],
  );
  await database.exec(await migrationSql("0001_rare_hammerhead.sql"));
  const migrated = await database.query<{ quota_slot: number }>(
    `select quota_slot from documents where booking_id = $1`,
    [bookingId],
  );
  assert.equal(
    migrated.rows[0]?.quota_slot,
    1,
    "the Part 4 migration must backfill existing document rows",
  );
  await database.close();
}

async function main() {
  await verifyDocumentQuotaUpgrade();
  const database = new PGlite();
  for (const filename of [
    "0000_booking_portal_foundation.sql",
    "0001_rare_hammerhead.sql",
    "0002_ancient_chronomancer.sql",
    "0003_jazzy_firelord.sql",
    "0004_complete_kree.sql",
  ]) {
    await database.exec(await migrationSql(filename));
  }

  const slotStart = "2026-10-05T01:00:00.000Z";
  const slotEnd = "2026-10-05T05:00:00.000Z";
  const inserted = await database.query<{ id: string }>(
    `insert into bookings (
      reference,
      stripe_checkout_session_id,
      stripe_payment_intent_id,
      customer_name,
      customer_email,
      customer_phone,
      site_address,
      service_code,
      package_name,
      kwp,
      subtotal_cents,
      gst_cents,
      total_cents,
      slot_start,
      slot_end,
      paid_at
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    returning id`,
    [
      "FM-20260902-TEST01",
      "cs_test_foundation",
      "pi_test_foundation",
      "Database Test",
      "database-test@example.com",
      "+6500000000",
      "Test site",
      "ESSENTIAL",
      "Essential Health Check",
      "10.000",
      19900,
      1791,
      21691,
      slotStart,
      slotEnd,
      "2026-09-02T10:00:00.000Z",
    ],
  );
  const bookingId = inserted.rows[0]?.id;
  assert.ok(bookingId, "valid paid booking should be inserted");

  await expectConstraintFailure(
    () =>
      database.query(
        `insert into bookings (
          reference, stripe_checkout_session_id, customer_name,
          customer_email, customer_phone, site_address, service_code,
          package_name, subtotal_cents, gst_cents, total_cents,
          slot_start, slot_end, paid_at
        ) values (
          'FM-20260902-TEST02', 'cs_test_foundation', 'Duplicate',
          'duplicate@example.com', '+6500000001', 'Test site', 'ESSENTIAL',
          'Essential Health Check', 19900, 1791, 21691,
          $1, $2, now()
        )`,
        [slotStart, slotEnd],
      ),
    "Stripe Checkout Session IDs must be unique",
  );

  await expectConstraintFailure(
    () =>
      database.query(
        `insert into bookings (
          reference, stripe_checkout_session_id, customer_name,
          customer_email, customer_phone, site_address, service_code,
          package_name, subtotal_cents, gst_cents, total_cents,
          slot_start, slot_end, paid_at
        ) values (
          'FM-20260902-TEST03', 'cs_test_wrong_total', 'Wrong total',
          'wrong-total@example.com', '+6500000002', 'Test site', 'ESSENTIAL',
          'Essential Health Check', 19900, 1791, 21690,
          $1, $2, now()
        )`,
        [slotStart, slotEnd],
      ),
    "stored total must equal subtotal plus GST",
  );

  const firstTokenDigest = "a".repeat(64);
  const secondTokenDigest = "b".repeat(64);
  await database.query(
    `insert into booking_access_tokens (booking_id, token_digest, expires_at)
     values ($1, $2, now() + interval '120 days')`,
    [bookingId, firstTokenDigest],
  );
  await expectConstraintFailure(
    () =>
      database.query(
        `insert into slot_reservations (
          slot_start, slot_end, status, hold_expires_at
        ) values ($1, $2, 'held', now() + interval '10 minutes')`,
        ["2026-10-07T01:00:00.000Z", "2026-10-07T05:00:00.000Z"],
      ),
    "every slot hold must belong to a booking or Stripe Checkout Session",
  );
  await database.query(
    `insert into slot_reservations (
      stripe_checkout_session_id, slot_start, slot_end, status, hold_expires_at
    ) values ($1, $2, $3, 'held', now() + interval '31 minutes')`,
    [
      "cs_provisional_hold",
      "2026-10-07T01:00:00.000Z",
      "2026-10-07T05:00:00.000Z",
    ],
  );
  await expectConstraintFailure(
    () =>
      database.query(
        `insert into slot_reservations (
          stripe_checkout_session_id, slot_start, slot_end, status, hold_expires_at
        ) values ($1, $2, $3, 'held', now() + interval '31 minutes')`,
        [
          "cs_provisional_hold",
          "2026-10-08T01:00:00.000Z",
          "2026-10-08T05:00:00.000Z",
        ],
      ),
    "one Checkout Session cannot hold two visit times",
  );
  await expectConstraintFailure(
    () =>
      database.query(
        `insert into booking_access_tokens (booking_id, token_digest, expires_at)
         values ($1, $2, now() + interval '120 days')`,
        [bookingId, secondTokenDigest],
      ),
    "a booking must not have two unrevoked manage links",
  );
  await database.query(
    `update booking_access_tokens set revoked_at = now()
     where booking_id = $1 and token_digest = $2`,
    [bookingId, firstTokenDigest],
  );
  await database.query(
    `insert into booking_access_tokens (booking_id, token_digest, expires_at)
     values ($1, $2, now() + interval '120 days')`,
    [bookingId, secondTokenDigest],
  );

  await database.query(
    `insert into slot_reservations (
      booking_id, slot_start, slot_end, status, hold_expires_at
    ) values ($1, $2, $3, 'held', now() + interval '10 minutes')`,
    [bookingId, slotStart, slotEnd],
  );
  await expectConstraintFailure(
    () =>
      database.query(
        `insert into slot_reservations (
          booking_id, slot_start, slot_end, status, hold_expires_at
        ) values ($1, $2, $3, 'held', now() + interval '10 minutes')`,
        [bookingId, slotStart, slotEnd],
      ),
    "an active standard slot must not be reserved twice",
  );

  await database.query(
    `insert into reschedule_requests (
      request_key, booking_id, previous_slot_start, previous_slot_end,
      requested_slot_start, requested_slot_end
    ) values ($1, $2, $3, $4, $5, $6)`,
    [
      "reschedule-test-01",
      bookingId,
      slotStart,
      slotEnd,
      "2026-10-06T01:00:00.000Z",
      "2026-10-06T05:00:00.000Z",
    ],
  );
  await expectConstraintFailure(
    () =>
      database.query(
        `insert into reschedule_requests (
          request_key, booking_id, previous_slot_start, previous_slot_end,
          requested_slot_start, requested_slot_end
        ) values ($1, $2, $3, $4, $5, $6)`,
        [
          "reschedule-test-02",
          bookingId,
          slotStart,
          slotEnd,
          "2026-10-08T01:00:00.000Z",
          "2026-10-08T05:00:00.000Z",
        ],
      ),
    "a booking cannot have two active reschedule requests",
  );
  const reschedule = await database.query<{ id: string }>(
    `select id from reschedule_requests where request_key = 'reschedule-test-01'`,
  );
  const rescheduleId = reschedule.rows[0]?.id;
  assert.ok(rescheduleId);
  await database.query(
    `update slot_reservations
     set status = 'confirmed', hold_expires_at = null
     where booking_id = $1 and slot_start = $2 and slot_end = $3`,
    [bookingId, slotStart, slotEnd],
  );
  const requestedStart = "2026-10-06T01:00:00.000Z";
  const requestedEnd = "2026-10-06T05:00:00.000Z";
  await database.query(
    `insert into slot_reservations (
      booking_id, reschedule_request_id, slot_start, slot_end,
      status, hold_expires_at
    ) values ($1, $2, $3, $4, 'held', now() + interval '15 minutes')`,
    [bookingId, rescheduleId, requestedStart, requestedEnd],
  );
  const finalized = await database.query<{
    reschedule_count: number;
    record_version: number;
  }>(
    `with updated_booking as (
      update bookings
      set slot_start = $4, slot_end = $5,
          reschedule_count = reschedule_count + 1,
          record_version = record_version + 1,
          updated_at = now()
      where id = $1 and slot_start = $2 and slot_end = $3
        and record_version = 1 and reschedule_count < 2
      returning id, reschedule_count, record_version
    ), confirmed_reservation as (
      update slot_reservations
      set status = 'confirmed', hold_expires_at = null, updated_at = now()
      where reschedule_request_id = $6 and status = 'held'
        and exists (select 1 from updated_booking)
      returning id
    ), completed_request as (
      update reschedule_requests
      set status = 'completed', failure_code = null,
          completed_at = now(), updated_at = now()
      where id = $6 and status in ('requested', 'processing')
        and exists (select 1 from updated_booking)
        and exists (select 1 from confirmed_reservation)
      returning id
    ), released_previous as (
      update slot_reservations
      set status = 'released', released_at = now(), updated_at = now()
      where booking_id = $1 and slot_start = $2 and slot_end = $3
        and status = 'confirmed'
        and exists (select 1 from completed_request)
      returning id
    )
    select updated_booking.reschedule_count, updated_booking.record_version
    from updated_booking, completed_request`,
    [
      bookingId,
      slotStart,
      slotEnd,
      requestedStart,
      requestedEnd,
      rescheduleId,
    ],
  );
  assert.deepEqual(finalized.rows[0], {
    reschedule_count: 1,
    record_version: 2,
  });
  const reservationStates = await database.query<{
    slot_start: string;
    status: string;
  }>(
    `select slot_start::text, status from slot_reservations
     where booking_id = $1 and slot_start in ($2, $3)
     order by slot_start`,
    [bookingId, slotStart, requestedStart],
  );
  assert.deepEqual(
    reservationStates.rows.map((row) => row.status),
    ["released", "confirmed"],
    "Graph-confirmed rescheduling must release the old slot only when the new slot commits",
  );

  await database.query(
    `insert into documents (
      booking_id, quota_slot, original_filename, content_type, size_bytes, blob_pathname
    ) values ($1, 1, 'sample-sld.pdf', 'application/pdf', 1024, $2)`,
    [bookingId, `bookings/${bookingId}/sample-sld.pdf`],
  );
  await expectConstraintFailure(
    () =>
      database.query(
        `insert into documents (
          booking_id, quota_slot, original_filename, content_type, size_bytes, blob_pathname
        ) values ($1, 2, 'duplicate.pdf', 'application/pdf', 1024, $2)`,
        [bookingId, `bookings/${bookingId}/sample-sld.pdf`],
      ),
    "private Blob pathnames must be unique",
  );
  for (let quotaSlot = 2; quotaSlot <= 10; quotaSlot += 1) {
    await database.query(
      `insert into documents (
        booking_id, quota_slot, original_filename, content_type, size_bytes, blob_pathname
      ) values ($1, $2, $3, 'application/pdf', 1024, $4)`,
      [
        bookingId,
        quotaSlot,
        `quota-${quotaSlot}.pdf`,
        `booking-documents/quota-${quotaSlot}.pdf`,
      ],
    );
  }
  await expectConstraintFailure(
    () =>
      database.query(
        `insert into documents (
          booking_id, quota_slot, original_filename, content_type, size_bytes, blob_pathname
        ) values ($1, 1, 'eleventh.pdf', 'application/pdf', 1024, $2)`,
        [bookingId, "booking-documents/eleventh.pdf"],
      ),
    "a booking cannot have more than ten active document quota slots",
  );
  await database.query(
    `update documents set status = 'deleted', deleted_at = now()
     where booking_id = $1 and quota_slot = 1`,
    [bookingId],
  );
  await database.query(
    `insert into documents (
      booking_id, quota_slot, original_filename, content_type, size_bytes, blob_pathname
    ) values ($1, 1, 'replacement.pdf', 'application/pdf', 1024, $2)`,
    [bookingId, "booking-documents/replacement.pdf"],
  );
  await expectConstraintFailure(
    () =>
      database.query(
        `insert into documents (
          booking_id, quota_slot, original_filename, content_type, size_bytes, blob_pathname
        ) values ($1, 11, 'bad-slot.pdf', 'application/pdf', 1024, $2)`,
        [bookingId, "booking-documents/bad-slot.pdf"],
      ),
    "document quota slots must remain between one and ten",
  );

  await database.query(
    `insert into webhook_events (event_id, event_type)
     values ('evt_test_foundation', 'checkout.session.completed')`,
  );
  await expectConstraintFailure(
    () =>
      database.query(
        `insert into webhook_events (event_id, event_type)
         values ('evt_test_foundation', 'checkout.session.completed')`,
      ),
    "Stripe webhook event IDs must be idempotent",
  );

  const delivery = await database.query<{ provider: string }>(
    `insert into email_deliveries (
      booking_id, message_kind, recipient, idempotency_key,
      status, attempt_count
    ) values ($1, 'booking_customer', 'customer@example.com',
      'fm-booking-customer-test-v1', 'sent', 1)
    returning provider`,
    [bookingId],
  );
  assert.equal(
    delivery.rows[0]?.provider,
    "microsoft_graph",
    "new delivery records must default to Microsoft Graph",
  );
  await database.query(
    `insert into email_deliveries (
      booking_id, message_kind, recipient, idempotency_key,
      provider, status, attempt_count
    ) values ($1, 'booking_operations', 'ops@example.com',
      'fm-booking-operations-historical-v1', 'resend', 'sent', 1)`,
    [bookingId],
  );
  await expectConstraintFailure(
    () =>
      database.query(
        `insert into email_deliveries (
          booking_id, message_kind, recipient, idempotency_key
        ) values ($1, 'booking_customer', 'customer@example.com',
          'fm-booking-customer-test-v1')`,
        [bookingId],
      ),
    "an email idempotency key must be unique across retries",
  );
  await expectConstraintFailure(
    () =>
      database.query(
        `insert into email_deliveries (
          booking_id, message_kind, recipient, idempotency_key
        ) values ($1, 'marketing', 'customer@example.com',
          'fm-invalid-message-kind')`,
        [bookingId],
      ),
    "only approved transactional message kinds may be stored",
  );
  await expectConstraintFailure(
    () =>
      database.query(
        `insert into email_deliveries (
          booking_id, message_kind, recipient, idempotency_key, provider
        ) values ($1, 'booking_operations', 'ops@example.com',
          'fm-invalid-provider', 'smtp')`,
        [bookingId],
      ),
    "only the historical Resend and current Microsoft Graph providers may be stored",
  );

  await database.close();
  console.log("Database foundation verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
