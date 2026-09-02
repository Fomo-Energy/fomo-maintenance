export type EmailClaim =
  | { status: "send"; deliveryId: string }
  | { status: "sent"; providerMessageId: string | null }
  | { status: "busy" };

export type EmailDeliveryStore = {
  claim(input: {
    bookingId: string;
    rescheduleRequestId?: string;
    messageKind: string;
    recipient: string;
    idempotencyKey: string;
  }): Promise<EmailClaim>;
  complete(deliveryId: string, providerMessageId: string): Promise<void>;
  fail(deliveryId: string, failureCode: string): Promise<void>;
};

export type EmailSender = (input: {
  idempotencyKey: string;
}) => Promise<string>;

export async function deliverEmailOnce(
  input: {
    bookingId: string;
    rescheduleRequestId?: string;
    messageKind: string;
    recipient: string;
    idempotencyKey: string;
  },
  services: { store: EmailDeliveryStore; send: EmailSender },
): Promise<{ status: "sent" | "duplicate"; providerMessageId: string | null }> {
  const claim = await services.store.claim(input);
  if (claim.status === "sent") {
    return {
      status: "duplicate",
      providerMessageId: claim.providerMessageId,
    };
  }
  if (claim.status === "busy") {
    throw new Error("email_delivery_busy");
  }
  try {
    const providerMessageId = await services.send({
      idempotencyKey: input.idempotencyKey,
    });
    await services.store.complete(claim.deliveryId, providerMessageId);
    return { status: "sent", providerMessageId };
  } catch (error) {
    const failureCode =
      error && typeof error === "object" && "code" in error
        ? String(error.code).slice(0, 80)
        : "email_send_failed";
    await services.store.fail(claim.deliveryId, failureCode);
    throw error;
  }
}
