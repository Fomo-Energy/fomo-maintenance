import "server-only";

import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
} from "drizzle-orm";
import {
  bookingAccessTokens,
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
  for (let quotaSlot = 1; quotaSlot <= MAX_DOCUMENTS_PER_BOOKING; quotaSlot += 1) {
    const inserted = await getDatabase()
      .insert(documents)
      .values({
        bookingId: input.bookingId,
        uploadedViaTokenId: input.accessTokenId,
        quotaSlot,
        category: input.document.category,
        originalFilename: input.document.originalFilename,
        contentType: input.document.contentType,
        sizeBytes: input.document.sizeBytes,
        blobPathname: input.document.pathname,
        status: "pending",
      })
      .onConflictDoNothing()
      .returning({ id: documents.id });
    if (inserted.length === 1) {
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
  const [record] = await getDatabase()
    .update(documents)
    .set({
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      status: "available",
      uploadedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(documents.bookingId, input.bookingId),
        eq(documents.uploadedViaTokenId, input.accessTokenId),
        eq(documents.blobPathname, input.pathname),
        eq(documents.contentType, input.contentType),
        eq(documents.sizeBytes, input.sizeBytes),
        inArray(documents.status, ["pending", "available"]),
      ),
    )
    .returning({ id: documents.id });
  if (!record) {
    return null;
  }

  return record.id;
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
    .where(
      and(
        eq(bookingAccessTokens.id, accessTokenId),
        eq(bookingAccessTokens.bookingId, bookingId),
        isNull(bookingAccessTokens.revokedAt),
        gt(bookingAccessTokens.expiresAt, new Date()),
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
