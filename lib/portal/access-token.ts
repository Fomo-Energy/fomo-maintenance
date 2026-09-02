import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

const TOKEN_VERSION = "fm1";
const TOKEN_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ManageTokenClaims = {
  id: string;
  expiresAt: Date;
};

function signatureFor(id: string, expiresAtSeconds: number, secret: string) {
  return createHmac("sha256", secret)
    .update(`${TOKEN_VERSION}:${id}:${expiresAtSeconds}`)
    .digest("base64url");
}

export function newManageTokenId(): string {
  return randomUUID();
}

export function buildManageToken(
  claims: ManageTokenClaims,
  secret: string,
): string {
  const expiresAtSeconds = Math.floor(claims.expiresAt.getTime() / 1_000);
  const signature = signatureFor(claims.id, expiresAtSeconds, secret);
  return `${TOKEN_VERSION}.${claims.id}.${expiresAtSeconds}.${signature}`;
}

export function digestManageToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyManageToken(
  token: string,
  secret: string,
  now = new Date(),
): ManageTokenClaims | null {
  if (token.length > 160) {
    return null;
  }

  const [version, id, expiryRaw, suppliedSignature, extra] = token.split(".");
  if (
    extra !== undefined ||
    version !== TOKEN_VERSION ||
    !id ||
    !TOKEN_ID_PATTERN.test(id) ||
    !/^\d{10,12}$/.test(expiryRaw || "") ||
    !/^[A-Za-z0-9_-]{43}$/.test(suppliedSignature || "")
  ) {
    return null;
  }

  const expiresAtSeconds = Number(expiryRaw);
  const expiresAt = new Date(expiresAtSeconds * 1_000);
  if (!Number.isSafeInteger(expiresAtSeconds) || expiresAt <= now) {
    return null;
  }

  const expectedSignature = signatureFor(id, expiresAtSeconds, secret);
  const expected = Buffer.from(expectedSignature);
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return null;
  }

  return { id, expiresAt };
}
