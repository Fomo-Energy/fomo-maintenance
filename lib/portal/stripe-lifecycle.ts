export type CheckoutLifecycleAction =
  | "ignore"
  | "expire"
  | "release"
  | "await_payment"
  | "fulfill";

export function checkoutLifecycleAction(
  eventType: string,
  paymentStatus: string | null,
): CheckoutLifecycleAction {
  if (eventType === "checkout.session.expired") {
    return "expire";
  }
  if (eventType === "checkout.session.async_payment_failed") {
    return "release";
  }
  if (eventType === "checkout.session.async_payment_succeeded") {
    return "fulfill";
  }
  if (eventType === "checkout.session.completed") {
    return paymentStatus === "paid" ? "fulfill" : "await_payment";
  }
  return "ignore";
}
