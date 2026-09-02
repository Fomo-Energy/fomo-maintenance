import { del, get } from "@vercel/blob";
import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { databaseIsConfigured } from "@/lib/database";
import { findManageAccess } from "@/lib/portal/bookings";
import {
  DOCUMENT_CONTENT_TYPES,
  DocumentPolicyError,
  documentPathIsAllowed,
  fileSignatureMatches,
  parseDocumentClientPayload,
  UPLOAD_TOKEN_LIFETIME_MS,
  type DocumentContentType,
} from "@/lib/portal/document-policy";
import {
  completeDocumentUpload,
  manageAccessRecordIsActive,
  rejectDocumentUpload,
  reserveDocumentUpload,
} from "@/lib/portal/documents";
import {
  blobStorageIsConfigured,
  bookingPortalEnabled,
  documentUploadsEnabled,
  MANAGE_COOKIE_NAME,
} from "@/lib/portal/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CompletionPayload = {
  version: 1;
  bookingId: string;
  accessTokenId: string;
  pathname: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestIsSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

function parseCompletionPayload(value: string | null | undefined) {
  if (!value || value.length > 500) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Partial<CompletionPayload>;
    if (
      parsed.version !== 1 ||
      typeof parsed.bookingId !== "string" ||
      typeof parsed.accessTokenId !== "string" ||
      typeof parsed.pathname !== "string" ||
      !UUID_PATTERN.test(parsed.bookingId) ||
      !UUID_PATTERN.test(parsed.accessTokenId) ||
      !documentPathIsAllowed(parsed.pathname)
    ) {
      return null;
    }
    return parsed as CompletionPayload;
  } catch {
    return null;
  }
}

async function deleteRejectedBlob(pathname: string): Promise<void> {
  await Promise.all([del(pathname), rejectDocumentUpload(pathname)]);
}

async function firstBytes(
  pathname: string,
): Promise<{ bytes: Uint8Array; contentType: string; sizeBytes: number } | null> {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) {
    return null;
  }
  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  let byteCount = 0;
  try {
    while (byteCount < 8) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      chunks.push(chunk.value);
      byteCount += chunk.value.byteLength;
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(Math.min(byteCount, 8));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, bytes.length - offset);
    bytes.set(slice, offset);
    offset += slice.length;
    if (offset === bytes.length) {
      break;
    }
  }
  return {
    bytes,
    contentType: result.blob.contentType,
    sizeBytes: result.blob.size,
  };
}

export async function POST(request: Request) {
  if (!databaseIsConfigured() || !blobStorageIsConfigured()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const issuingToken = body.type === "blob.generate-client-token";
  if (
    issuingToken &&
    (!bookingPortalEnabled() ||
      !documentUploadsEnabled() ||
      !requestIsSameOrigin(request))
  ) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const cookieToken = issuingToken
    ? (await cookies()).get(MANAGE_COOKIE_NAME)?.value
    : undefined;
  const manageAccess = cookieToken
    ? await findManageAccess(cookieToken).catch(() => null)
    : null;
  if (issuingToken && !manageAccess) {
    return NextResponse.json({ error: "Invalid booking session." }, { status: 401 });
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!manageAccess) {
          throw new Error("manage_session_required");
        }
        const document = parseDocumentClientPayload(pathname, clientPayload);
        await reserveDocumentUpload({
          bookingId: manageAccess.booking.id,
          accessTokenId: manageAccess.accessTokenId,
          document,
        });
        const tokenPayload: CompletionPayload = {
          version: 1,
          bookingId: manageAccess.booking.id,
          accessTokenId: manageAccess.accessTokenId,
          pathname: document.pathname,
        };
        return {
          allowedContentTypes: [document.contentType],
          maximumSizeInBytes: document.sizeBytes,
          validUntil: Date.now() + UPLOAD_TOKEN_LIFETIME_MS,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify(tokenPayload),
          callbackUrl: new URL(
            "/api/manage/documents/upload",
            request.url,
          ).toString(),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const completion = parseCompletionPayload(tokenPayload);
        if (
          !completion ||
          completion.pathname !== blob.pathname ||
          !(await manageAccessRecordIsActive(
            completion.accessTokenId,
            completion.bookingId,
          ))
        ) {
          await deleteRejectedBlob(blob.pathname);
          throw new Error("invalid_upload_completion");
        }

        const uploaded = await firstBytes(blob.pathname);
        if (
          !uploaded ||
          !DOCUMENT_CONTENT_TYPES.includes(
            uploaded.contentType as DocumentContentType,
          ) ||
          !fileSignatureMatches(
            uploaded.contentType as DocumentContentType,
            uploaded.bytes,
          )
        ) {
          await deleteRejectedBlob(blob.pathname);
          throw new Error("uploaded_file_signature_mismatch");
        }

        const documentId = await completeDocumentUpload({
          bookingId: completion.bookingId,
          accessTokenId: completion.accessTokenId,
          pathname: blob.pathname,
          contentType: uploaded.contentType as DocumentContentType,
          sizeBytes: uploaded.sizeBytes,
        });
        if (!documentId) {
          await deleteRejectedBlob(blob.pathname);
          throw new Error("upload_record_not_available");
        }
      },
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const policyError = error instanceof DocumentPolicyError;
    const limitReached =
      error instanceof Error && error.message === "document_limit_reached";
    if (!policyError && !limitReached) {
      console.error("[fomo-maintenance] private document upload failed", {
        stage: issuingToken ? "token" : "completion",
        code: error instanceof Error ? error.name : "unknown_error",
      });
    }
    return NextResponse.json(
      {
        error: policyError
          ? error.message
          : limitReached
            ? "This booking already has the maximum of 10 documents."
            : "The document could not be uploaded.",
      },
      { status: policyError ? 400 : limitReached ? 409 : 500 },
    );
  }
}
