"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_DOCUMENTS_PER_BOOKING,
  extensionForContentType,
  type DocumentCategory,
  type DocumentContentType,
} from "@/lib/portal/document-policy";

export default function DocumentUploadPanel({
  currentCount,
}: {
  currentCount: number;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<DocumentCategory>("sld");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  const limitReached = currentCount >= MAX_DOCUMENTS_PER_BOOKING;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("document") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setMessage("Choose a document first.");
      return;
    }
    if (
      !(["application/pdf", "image/png", "image/jpeg"] as string[]).includes(
        file.type,
      ) ||
      file.size <= 0 ||
      file.size > MAX_DOCUMENT_SIZE_BYTES
    ) {
      setMessage("Choose a PDF, PNG, or JPEG file no larger than 20 MB.");
      return;
    }

    setBusy(true);
    setProgress(0);
    setMessage("Preparing secure upload…");
    const uploadController = new AbortController();
    const uploadTimeout = window.setTimeout(
      () => uploadController.abort(),
      3 * 60 * 1_000,
    );
    try {
      const contentType = file.type as DocumentContentType;
      const pathname = `booking-documents/${crypto.randomUUID()}.${extensionForContentType(contentType)}`;
      setMessage("Uploading securely…");
      await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/manage/documents/upload",
        contentType,
        abortSignal: uploadController.signal,
        clientPayload: JSON.stringify({
          category,
          originalFilename: file.name,
          contentType,
          sizeBytes: file.size,
        }),
        onUploadProgress({ percentage }) {
          setProgress(Math.round(percentage));
          setMessage(`Uploading securely… ${Math.round(percentage)}%`);
        },
      });
      form.reset();
      setCategory("sld");
      setMessage("Upload received. Refreshing your document list…");
      window.setTimeout(() => router.refresh(), 750);
    } catch (error) {
      console.error("[fomo-maintenance] document upload failed", {
        name: error instanceof Error ? error.name : "unknown_error",
        message: error instanceof Error ? error.message : "Unknown upload error",
      });
      setMessage(
        uploadController.signal.aborted
          ? "The upload timed out and was not completed. Check your connection, then try again."
          : "The upload did not complete. Confirm the file type and size, then try again.",
      );
    } finally {
      window.clearTimeout(uploadTimeout);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="document-category" className="block text-sm font-bold text-ink">
          Document type
        </label>
        <select
          id="document-category"
          value={category}
          onChange={(event) => setCategory(event.target.value as DocumentCategory)}
          disabled={busy || limitReached}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-ink"
        >
          <option value="sld">Single-line diagram (SLD)</option>
          <option value="pv_document">PV system document</option>
          <option value="other">Other PV document</option>
        </select>
      </div>
      <div>
        <label htmlFor="booking-document" className="block text-sm font-bold text-ink">
          File
        </label>
        <input
          id="booking-document"
          name="document"
          type="file"
          accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
          required
          disabled={busy || limitReached}
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
        />
      </div>
      <button
        type="submit"
        disabled={busy || limitReached}
        className="cta-pill px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? `Uploading ${progress}%` : "Upload document"}
      </button>
      <p className="text-sm leading-6 text-slate-500">
        PDF, PNG, or JPEG; maximum 20 MB each and 10 documents per booking.
        Files are stored privately.
      </p>
      {limitReached ? (
        <p className="text-sm font-semibold text-ink" role="status">
          This booking has reached the 10-document limit.
        </p>
      ) : message ? (
        <p className="text-sm font-semibold text-ink" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </form>
  );
}
