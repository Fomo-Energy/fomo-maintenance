import "server-only";

import { Resend } from "resend";
import type { RenderedEmail } from "@/lib/portal/email-templates";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let resendClient: Resend | undefined;

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
  const sender = value?.trim() || "";
  const namedSender = sender.match(/^[^<>\r\n]+<([^<>\s]+)>$/);
  const address = singleEmail("EMAIL_FROM", namedSender?.[1] || sender);
  if (!address.endsWith("@fomo.energy")) {
    throw new Error("EMAIL_FROM must use an address on fomo.energy.");
  }
  return sender;
}

export function emailConfiguration() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY is required.");
  const from = senderOnFomoDomain(process.env.EMAIL_FROM);
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
  return { apiKey, from, replyTo, operationsTo };
}

export function customerEmailRecipient(intendedRecipient: string): string {
  const override = process.env.EMAIL_CUSTOMER_OVERRIDE_TO?.trim();
  if (!override) return singleEmail("customer email", intendedRecipient);
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("EMAIL_CUSTOMER_OVERRIDE_TO is forbidden in Production.");
  }
  return singleEmail("EMAIL_CUSTOMER_OVERRIDE_TO", override);
}

export async function sendEmail(input: {
  to: string[];
  message: RenderedEmail;
  idempotencyKey: string;
  tags: Array<{ name: string; value: string }>;
}): Promise<string> {
  const config = emailConfiguration();
  resendClient ??= new Resend(config.apiKey);
  const { data, error } = await resendClient.emails.send(
    {
      from: config.from,
      to: input.to,
      replyTo: config.replyTo,
      subject: input.message.subject,
      text: input.message.text,
      html: input.message.html,
      tags: input.tags,
    },
    { idempotencyKey: input.idempotencyKey },
  );
  if (error) {
    throw new EmailProviderError(error.name || "provider_error");
  }
  if (!data?.id) {
    throw new EmailProviderError("provider_response_missing_id");
  }
  return data.id;
}
