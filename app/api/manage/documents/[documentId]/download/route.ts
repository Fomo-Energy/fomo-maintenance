import { get } from "@vercel/blob";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { databaseIsConfigured } from "@/lib/database";
import { findManageAccess } from "@/lib/portal/bookings";
import {
  blobStorageIsConfigured,
  bookingPortalEnabled,
  MANAGE_COOKIE_NAME,
} from "@/lib/portal/config";
import { findManageDocument } from "@/lib/portal/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function contentDisposition(filename: string): string {
  const fallback = filename
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_")
    .slice(0, 120) || "pv-document";
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (value) =>
    `%${value.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  if (
    !UUID_PATTERN.test(documentId) ||
    !bookingPortalEnabled() ||
    !databaseIsConfigured() ||
    !blobStorageIsConfigured()
  ) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const token = (await cookies()).get(MANAGE_COOKIE_NAME)?.value;
  const access = token ? await findManageAccess(token).catch(() => null) : null;
  if (!access) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const document = await findManageDocument(access.booking.id, documentId);
  if (!document) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const blob = await get(document.blobPathname, {
    access: "private",
    useCache: false,
  });
  if (!blob || blob.statusCode !== 200) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return new Response(blob.stream, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentDisposition(document.originalFilename),
      "Content-Length": String(blob.blob.size),
      "Content-Type": document.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
