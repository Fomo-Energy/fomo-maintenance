export const DOCUMENT_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_DOCUMENTS_PER_BOOKING = 10;
export const UPLOAD_TOKEN_LIFETIME_MS = 10 * 60 * 1_000;

export type DocumentContentType = (typeof DOCUMENT_CONTENT_TYPES)[number];
export type DocumentCategory = "sld" | "pv_document" | "other";

export class DocumentPolicyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DocumentPolicyError";
  }
}

const CONTENT_TYPE_EXTENSION: Record<DocumentContentType, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

const DOCUMENT_PATH_PATTERN =
  /^booking-documents\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpg)$/i;

export function documentPathIsAllowed(pathname: string): boolean {
  return DOCUMENT_PATH_PATTERN.test(pathname);
}

export type DocumentUploadRequest = {
  pathname: string;
  category: DocumentCategory;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
};

export type ValidatedDocumentUpload = Omit<
  DocumentUploadRequest,
  "contentType"
> & { contentType: DocumentContentType };

export function extensionForContentType(
  contentType: DocumentContentType,
): string {
  return CONTENT_TYPE_EXTENSION[contentType];
}

export function validateDocumentUpload(
  input: DocumentUploadRequest,
): ValidatedDocumentUpload {
  if (!documentPathIsAllowed(input.pathname)) {
    throw new DocumentPolicyError(
      "invalid_blob_path",
      "The upload destination is invalid.",
    );
  }
  if (!DOCUMENT_CONTENT_TYPES.includes(input.contentType as DocumentContentType)) {
    throw new DocumentPolicyError(
      "unsupported_file_type",
      "Only PDF, PNG, and JPEG files are accepted.",
    );
  }
  const contentType = input.contentType as DocumentContentType;
  if (!input.pathname.endsWith(`.${extensionForContentType(contentType)}`)) {
    throw new DocumentPolicyError(
      "file_extension_mismatch",
      "The file extension does not match its content type.",
    );
  }
  if (
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes <= 0 ||
    input.sizeBytes > MAX_DOCUMENT_SIZE_BYTES
  ) {
    throw new DocumentPolicyError(
      "invalid_file_size",
      "Each file must be no larger than 20 MB.",
    );
  }
  if (!(["sld", "pv_document", "other"] as string[]).includes(input.category)) {
    throw new DocumentPolicyError(
      "invalid_document_category",
      "Choose a valid document category.",
    );
  }

  const originalFilename = input.originalFilename
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!originalFilename || originalFilename.length > 180) {
    throw new DocumentPolicyError(
      "invalid_filename",
      "The filename must contain 1 to 180 characters.",
    );
  }

  return { ...input, originalFilename, contentType };
}

export function fileSignatureMatches(
  contentType: DocumentContentType,
  bytes: Uint8Array,
): boolean {
  if (contentType === "application/pdf") {
    return (
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d
    );
  }
  if (contentType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  return (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

export function parseDocumentClientPayload(
  pathname: string,
  clientPayload: string | null,
): ValidatedDocumentUpload {
  if (!clientPayload || clientPayload.length > 1_000) {
    throw new DocumentPolicyError(
      "invalid_upload_payload",
      "Upload details are missing or too large.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(clientPayload);
  } catch {
    throw new DocumentPolicyError(
      "invalid_upload_payload",
      "Upload details are invalid.",
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new DocumentPolicyError(
      "invalid_upload_payload",
      "Upload details are invalid.",
    );
  }
  const value = parsed as Record<string, unknown>;
  return validateDocumentUpload({
    pathname,
    category: value.category as DocumentCategory,
    originalFilename:
      typeof value.originalFilename === "string" ? value.originalFilename : "",
    contentType: typeof value.contentType === "string" ? value.contentType : "",
    sizeBytes: typeof value.sizeBytes === "number" ? value.sizeBytes : Number.NaN,
  });
}
