import assert from "node:assert/strict";
import {
  DocumentPolicyError,
  MAX_DOCUMENT_SIZE_BYTES,
  fileSignatureMatches,
  parseDocumentClientPayload,
  validateDocumentUpload,
} from "@/lib/portal/document-policy";

const pathname =
  "booking-documents/10000000-0000-4000-8000-000000000001.pdf";

function expectPolicyCode(operation: () => unknown, code: string) {
  assert.throws(operation, (error) => {
    return error instanceof DocumentPolicyError && error.code === code;
  });
}

function main() {
  const valid = validateDocumentUpload({
    pathname,
    category: "sld",
    originalFilename: "  Site / Main \\ SLD.pdf  ",
    contentType: "application/pdf",
    sizeBytes: 512_000,
  });
  assert.equal(valid.originalFilename, "Site Main SLD.pdf");
  assert.equal(valid.contentType, "application/pdf");

  assert.deepEqual(
    parseDocumentClientPayload(
      pathname,
      JSON.stringify({
        category: "sld",
        originalFilename: "Main SLD.pdf",
        contentType: "application/pdf",
        sizeBytes: 512_000,
      }),
    ),
    {
      pathname,
      category: "sld",
      originalFilename: "Main SLD.pdf",
      contentType: "application/pdf",
      sizeBytes: 512_000,
    },
  );

  expectPolicyCode(
    () =>
      validateDocumentUpload({
        ...valid,
        pathname: "booking-documents/../../private.pdf",
      }),
    "invalid_blob_path",
  );
  expectPolicyCode(
    () =>
      validateDocumentUpload({
        ...valid,
        contentType: "text/html",
      }),
    "unsupported_file_type",
  );
  expectPolicyCode(
    () =>
      validateDocumentUpload({
        ...valid,
        pathname:
          "booking-documents/10000000-0000-4000-8000-000000000001.png",
      }),
    "file_extension_mismatch",
  );
  expectPolicyCode(
    () =>
      validateDocumentUpload({
        ...valid,
        sizeBytes: MAX_DOCUMENT_SIZE_BYTES + 1,
      }),
    "invalid_file_size",
  );
  expectPolicyCode(
    () => parseDocumentClientPayload(pathname, "{"),
    "invalid_upload_payload",
  );

  assert.equal(
    fileSignatureMatches(
      "application/pdf",
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]),
    ),
    true,
  );
  assert.equal(
    fileSignatureMatches(
      "image/png",
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    true,
  );
  assert.equal(
    fileSignatureMatches("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff])),
    true,
  );
  assert.equal(
    fileSignatureMatches(
      "application/pdf",
      new TextEncoder().encode("<html>not a pdf</html>"),
    ),
    false,
    "declared PDFs must also have a PDF file signature",
  );

  console.log("Private document policy verification passed.");
}

main();
