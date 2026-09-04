import "server-only";

import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  ne,
  sql,
} from "drizzle-orm";
import {
  bookingAccessTokens,
  bookings,
  documents,
  type DocumentRecord,
} from "@/db/schema";
import { getDatabase } from "@/lib/database";
import {
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_DOCUMENTS_PER_BOOKING,
  type DocumentCategory,
  type DocumentContentType,
  type ValidatedDocumentUpload,
} from "@/lib/portal/document-policy";

const STALE_UPLOAD_INTENT_MS = 60 * 60 * 1_000;
const ACTIVE_DOCUMENT_STATUSES = ["pending", "available", "quarantined"];

export type ManageDocument = Pick<
  DocumentRecord,
  | "id"
  | "category"
  | "originalFilename"
  | "contentType"
  | "sizeBytes"
  | "status"
  | "uploadedAt"
>;

async function releaseStaleUploadIntents(bookingId: string): Promise<void> {
  const now = new Date();
  await getDatabase()
    .update(documents)
    .set({ status: "deleted", deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(documents.bookingId, bookingId),
        eq(documents.status, "pending"),
        lt(documents.createdAt, new Date(now.getTime() - STALE_UPLOAD_INTENT_MS)),
      ),
    );
}

export async function reserveDocumentUpload(input: {
  bookingId: string;
  accessTokenId: string;
  document: ValidatedDocumentUpload;
}): Promise<void> {
  await releaseStaleUploadIntents(input.bookingId);
  const database = getDatabase();
  for (let quotaSlot = 1; quotaSlot <= MAX_DOCUMENTS_PER_BOOKING; quotaSlot += 1) {
    const inserted = await database.execute<{ id: string }>(sql`
      with active_access as (
        select bookings.id
        from bookings
        inner join booking_access_tokens
          on booking_access_tokens.booking_id = bookings.id
        where bookings.id = ${input.bookingId}::uuid
          and booking_access_tokens.id = ${input.accessTokenId}::uuid
          and booking_access_tokens.revoked_at is null
          and booking_access_tokens.expires_at > now()
          and bookings.payment_status in (
            'paid', 'partially_refunded', 'disputed'
          )
          and bookings.calendar_status = 'created'
          and bookings.service_code <> 'TESTING'
        for update of bookings
      )
      insert into documents (
        booking_id, uploaded_via_token_id, quota_slot, category,
        original_filename, content_type, size_bytes, blob_pathname, status
      )
      select id, ${input.accessTokenId}::uuid, ${quotaSlot},
             ${input.document.category}, ${input.document.originalFilename},
             ${input.document.contentType}, ${input.document.sizeBytes},
             ${input.document.pathname}, 'pending'
      from active_access
      on conflict do nothing
      returning id
    `);
    if (inserted.rows.length === 1) {
      return;
    }
  }
  throw new Error("document_limit_reached");
}

export async function completeDocumentUpload(input: {
  bookingId: string;
  accessTokenId: string;
  pathname: string;
  contentType: DocumentContentType;
  sizeBytes: number;
}): Promise<string | null> {
  if (
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes <= 0 ||
    input.sizeBytes > MAX_DOCUMENT_SIZE_BYTES
  ) {
    return null;
  }
  const now = new Date();
  const completed = await getDatabase().execute<{ id: string }>(sql`
    with active_access as (
      select bookings.id
      from bookings
      inner join booking_access_tokens
        on booking_access_tokens.booking_id = bookings.id
      where bookings.id = ${input.bookingId}::uuid
        and booking_access_tokens.id = ${input.accessTokenId}::uuid
        and booking_access_tokens.revoked_at is null
        and booking_access_tokens.expires_at > now()
        and bookings.payment_status in (
          'paid', 'partially_refunded', 'disputed'
        )
        and bookings.calendar_status = 'created'
        and bookings.service_code <> 'TESTING'
      for update of bookings
    )
    update documents
    set content_type = ${input.contentType}, size_bytes = ${input.sizeBytes},
        status = 'available', uploaded_at = ${now}, updated_at = ${now}
    where booking_id = ${input.bookingId}::uuid
      and uploaded_via_token_id = ${input.accessTokenId}::uuid
      and blob_pathname = ${input.pathname}
      and content_type = ${input.contentType}
      and size_bytes = ${input.sizeBytes}
      and status in ('pending', 'available')
      and exists (select 1 from active_access)
    returning id
  `);
  if (!completed.rows[0]) {
    return null;
  }

  return completed.rows[0].id;
}

export async function rejectDocumentUpload(pathname: string): Promise<void> {
  const now = new Date();
  await getDatabase()
    .update(documents)
    .set({ status: "deleted", deletedAt: now, updatedAt: now })
    .where(eq(documents.blobPathname, pathname));
}

export async function listManageDocuments(
  bookingId: string,
): Promise<ManageDocument[]> {
  await releaseStaleUploadIntents(bookingId);
  return getDatabase()
    .select({
      id: documents.id,
      category: documents.category,
      originalFilename: documents.originalFilename,
      contentType: documents.contentType,
      sizeBytes: documents.sizeBytes,
      status: documents.status,
      uploadedAt: documents.uploadedAt,
    })
    .from(documents)
    .where(
      and(
        eq(documents.bookingId, bookingId),
        inArray(documents.status, ACTIVE_DOCUMENT_STATUSES),
      ),
    )
    .orderBy(desc(documents.uploadedAt));
}

export async function findManageDocument(
  bookingId: string,
  documentId: string,
): Promise<DocumentRecord | null> {
  const [record] = await getDatabase()
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.bookingId, bookingId),
        eq(documents.status, "available"),
      ),
    )
    .limit(1);
  return record ?? null;
}

export async function manageAccessRecordIsActive(
  accessTokenId: string,
  bookingId: string,
): Promise<boolean> {
  const [record] = await getDatabase()
    .select({ id: bookingAccessTokens.id })
    .from(bookingAccessTokens)
    .innerJoin(bookings, eq(bookings.id, bookingAccessTokens.bookingId))
    .where(
      and(
        eq(bookingAccessTokens.id, accessTokenId),
        eq(bookingAccessTokens.bookingId, bookingId),
        isNull(bookingAccessTokens.revokedAt),
        gt(bookingAccessTokens.expiresAt, new Date()),
        inArray(bookings.paymentStatus, [
          "paid",
          "partially_refunded",
          "disputed",
        ]),
        eq(bookings.calendarStatus, "created"),
        ne(bookings.serviceCode, "TESTING"),
      ),
    )
    .limit(1);
  return Boolean(record);
}

export function documentCategoryLabel(category: string): string {
  const labels: Record<DocumentCategory, string> = {
    sld: "Single-line diagram (SLD)",
    pv_document: "PV system document",
    other: "Other PV document",
  };
  return labels[category as DocumentCategory] || "PV document";
}
