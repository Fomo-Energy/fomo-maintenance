import type { PreparedReschedule } from "@/lib/portal/rescheduling";

export type RescheduleFlowServices = {
  eventTimeMatches(
    eventId: string,
    slotStart: string,
    slotEnd: string,
  ): Promise<boolean>;
  slotIsAvailable(input: PreparedReschedule): Promise<boolean>;
  updateEvent(eventId: string, slotStart: string, slotEnd: string): Promise<void>;
  complete(
    input: PreparedReschedule,
  ): Promise<{ rescheduleCount: number } | null>;
  fail(requestId: string, failureCode: string): Promise<void>;
};

export type RescheduleFlowResult =
  | { status: "complete"; rescheduleCount: number }
  | { status: "conflict" };

export async function executeCustomerReschedule(
  prepared: PreparedReschedule,
  services: RescheduleFlowServices,
): Promise<RescheduleFlowResult> {
  if (prepared.request.status === "completed") {
    return {
      status: "complete",
      rescheduleCount: prepared.booking.rescheduleCount,
    };
  }
  const eventId = prepared.booking.graphEventId;
  if (!eventId) {
    throw new Error("reschedule_graph_event_missing");
  }
  const slotStart = prepared.request.requestedSlotStart.toISOString();
  const slotEnd = prepared.request.requestedSlotEnd.toISOString();
  const graphAlreadyUpdated =
    prepared.resumed &&
    (await services.eventTimeMatches(eventId, slotStart, slotEnd));
  if (!graphAlreadyUpdated) {
    if (!(await services.slotIsAvailable(prepared))) {
      await services.fail(prepared.request.id, "slot_conflict");
      return { status: "conflict" };
    }
    await services.updateEvent(eventId, slotStart, slotEnd);
  }
  const completed = await services.complete(prepared);
  if (!completed) {
    throw new Error("reschedule_finalize_failed");
  }
  return { status: "complete", rescheduleCount: completed.rescheduleCount };
}
