import { createHash } from "node:crypto";
import type { RenderedEmail } from "@/lib/portal/email-templates";

export type TransactionalMessageKind =
  | "booking_customer"
  | "booking_operations"
  | "reschedule_customer"
  | "reschedule_operations"
  | "partial_refund_operations"
  | "dispute_operations";

type GraphEmailAddress = {
  emailAddress: {
    address: string;
  };
};

export type GraphSendMailPayload = {
  message: {
    subject: string;
    body: {
      contentType: "HTML";
      content: string;
    };
    toRecipients: GraphEmailAddress[];
    replyTo: GraphEmailAddress[];
    internetMessageHeaders: Array<{
      name: string;
      value: string;
    }>;
  };
  saveToSentItems: true;
};

function headerValue(name: string, value: string): string {
  if (!value || value.length > 200 || /[^\x20-\x7e]/.test(value)) {
    throw new Error(`${name} must be a non-empty ASCII value of at most 200 characters.`);
  }
  return value;
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function graphProviderReference(idempotencyKey: string): string {
  return `microsoft_graph:${hash(idempotencyKey).slice(0, 48)}`;
}

export function graphClientRequestId(idempotencyKey: string): string {
  const characters = hash(idempotencyKey).slice(0, 32).split("");
  characters[12] = "5";
  characters[16] = ["8", "9", "a", "b"][
    Number.parseInt(characters[16], 16) % 4
  ];
  const value = characters.join("");
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20),
  ].join("-");
}

export function graphSendMailPayload(input: {
  to: string[];
  replyTo: string;
  message: RenderedEmail;
  idempotencyKey: string;
  bookingReference: string;
  messageKind: TransactionalMessageKind;
}): GraphSendMailPayload {
  return {
    message: {
      subject: input.message.subject,
      body: {
        contentType: "HTML",
        content: input.message.html,
      },
      toRecipients: input.to.map((address) => ({
        emailAddress: { address },
      })),
      replyTo: [{ emailAddress: { address: input.replyTo } }],
      internetMessageHeaders: [
        {
          name: "x-fomo-idempotency-key",
          value: headerValue("idempotencyKey", input.idempotencyKey),
        },
        {
          name: "x-fomo-booking-reference",
          value: headerValue("bookingReference", input.bookingReference),
        },
        {
          name: "x-fomo-message-kind",
          value: headerValue("messageKind", input.messageKind),
        },
      ],
    },
    saveToSentItems: true,
  };
}
