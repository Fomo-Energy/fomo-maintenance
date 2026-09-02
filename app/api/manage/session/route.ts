import { NextResponse } from "next/server";
import { findManageBooking } from "@/lib/portal/bookings";
import {
  bookingPortalEnabled,
  MANAGE_COOKIE_NAME,
} from "@/lib/portal/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  if (!bookingPortalEnabled()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let token = "";
  try {
    const payload = (await request.json()) as { token?: unknown };
    token = typeof payload.token === "string" ? payload.token : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const booking = token ? await findManageBooking(token) : null;
  if (!booking) {
    return NextResponse.json(
      { error: "Invalid or expired booking link." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ verified: true });
  for (const path of ["/manage", "/api/manage"]) {
    response.cookies.set(MANAGE_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path,
      maxAge: 60 * 60 * 24 * 120,
    });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
