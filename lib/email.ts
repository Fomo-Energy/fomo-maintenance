import "server-only";

import type { RenderedEmail } from "@/lib/portal/email-templates";
import {
  graphClientRequestId,
  graphProviderReference,
  graphSendMailPayload,
  type TransactionalMessageKind,
} from "@/lib/graph-email";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const GRAPH_TIMEOUT_MS = 30_000;

type TokenCache = {
  tenantId: string;
  clientId: string;
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | undefined;

export class EmailProviderError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "EmailProviderError";
  }
}

function singleEmail(name: string, value: string | undefined): string {
  const email = value?.trim().toLowerCase() || "";
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new Error(`${name} must be a valid email address.`);
  }
  return email;
}

function senderOnFomoDomain(value: string | undefined): string {
  const address = singleEmail("EMAIL_GRAPH_SENDER_USER", value);
  if (!address.endsWith("@fomo.energy")) {
    throw new Error("EMAIL_GRAPH_SENDER_USER must use an address on fomo.energy.");
  }
  return address;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export function emailConfiguration() {
  const tenantId = requiredEnv("EMAIL_GRAPH_TENANT_ID");
  const clientId = requiredEnv("EMAIL_GRAPH_CLIENT_ID");
  const clientSecret = requiredEnv("EMAIL_GRAPH_CLIENT_SECRET");
  const sender = senderOnFomoDomain(process.env.EMAIL_GRAPH_SENDER_USER);
  const replyTo = singleEmail("EMAIL_REPLY_TO", process.env.EMAIL_REPLY_TO);
  const configuredOperationsTo = process.env.EMAIL_OPERATIONS_TO?.trim();
  const operationsTo = configuredOperationsTo
    ? [
        ...new Set(
          configuredOperationsTo
            .split(",")
            .map((value) => singleEmail("EMAIL_OPERATIONS_TO", value)),
        ),
      ]
    : [];
  if (operationsTo.length === 0 || operationsTo.length > 10) {
    throw new Error("EMAIL_OPERATIONS_TO must contain one to ten recipients.");
  }
  return {
    tenantId,
    clientId,
    clientSecret,
    sender,
    replyTo,
    operationsTo,
  };
}

export function customerEmailRecipient(intendedRecipient: string): string {
  const override = process.env.EMAIL_CUSTOMER_OVERRIDE_TO?.trim();
  if (!override) return singleEmail("customer email", intendedRecipient);
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("EMAIL_CUSTOMER_OVERRIDE_TO is forbidden in Production.");
  }
  return singleEmail("EMAIL_CUSTOMER_OVERRIDE_TO", override);
}

async function graphEmailAccessToken(
  config: ReturnType<typeof emailConfiguration>,
): Promise<string> {
  if (
    tokenCache?.tenantId === config.tenantId &&
    tokenCache.clientId === config.clientId &&
    tokenCache.expiresAt > Date.now() + 30_000
  ) {
    return tokenCache.accessToken;
  }

  let response: Response;
  try {
    response = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          scope: GRAPH_SCOPE,
          grant_type: "client_credentials",
        }),
        signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
      },
    );
  } catch {
    throw new EmailProviderError("graph_token_network_error");
  }

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!response.ok) {
    throw new EmailProviderError(`graph_token_http_${response.status}`);
  }
  if (!payload.access_token) {
    throw new EmailProviderError("graph_token_invalid_response");
  }

  tokenCache = {
    tenantId: config.tenantId,
    clientId: config.clientId,
    accessToken: payload.access_token,
    expiresAt: Date.now() + (Number(payload.expires_in) || 3_600) * 1_000,
  };
  return tokenCache.accessToken;
}

export async function sendEmail(input: {
  to: string[];
  message: RenderedEmail;
  idempotencyKey: string;
  bookingReference: string;
  messageKind: TransactionalMessageKind;
}): Promise<string> {
  const config = emailConfiguration();
  const to = input.to.map((value) => singleEmail("recipient", value));
  if (to.length === 0 || to.length > 10) {
    throw new Error("Email must contain one to ten recipients.");
  }
  const accessToken = await graphEmailAccessToken(config);
  const clientRequestId = graphClientRequestId(input.idempotencyKey);
  let response: Response;
  try {
    response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.sender)}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "client-request-id": clientRequestId,
          "return-client-request-id": "true",
        },
        body: JSON.stringify(
          graphSendMailPayload({
            to,
            replyTo: config.replyTo,
            message: input.message,
            idempotencyKey: input.idempotencyKey,
            bookingReference: input.bookingReference,
            messageKind: input.messageKind,
          }),
        ),
        signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
      },
    );
  } catch {
    throw new EmailProviderError("graph_send_network_error");
  }
  if (response.status !== 202) {
    throw new EmailProviderError(`graph_send_http_${response.status}`);
  }

  return graphProviderReference(input.idempotencyKey);
}
