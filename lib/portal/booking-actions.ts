export function customerBookingActionsAllowed(serviceCode: string): boolean {
  return serviceCode !== "TESTING";
}
