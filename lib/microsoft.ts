import { Client } from "@microsoft/microsoft-graph-client";
import {
  calendarIdMatchingName,
  type CalendarSummary,
} from "@/lib/calendar";
import { TIMEZONE } from "@/lib/site";
import type { BusyPeriod } from "@/lib/slots";

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const STRIPE_SESSION_PROPERTY =
  "String {66f5a359-4659-4830-9070-00047ec6ac6e} Name StripeSessionId";

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

type CalendarCache = {
  mailbox: string;
  selector: string;
  id: string;
};

let maintenanceCalendarCache: CalendarCache | null = null;

type GraphDateTime = {
  dateTime?: string;
  timeZone?: string;
};

type ScheduleItem = {
  status?: string;
  start?: GraphDateTime;
  end?: GraphDateTime;
};

type ScheduleResponse = {
  value?: Array<{
    availabilityView?: string;
    scheduleItems?: ScheduleItem[];
  }>;
};

type CalendarEvent = {
  id?: string;
  subject?: string;
  body?: { content?: string };
  start?: GraphDateTime;
  end?: GraphDateTime;
  showAs?: string;
  isCancelled?: boolean;
};

type CalendarViewResponse = {
  value?: CalendarEvent[];
  "@odata.nextLink"?: string;
};

type GraphEventListResponse = {
  value?: CalendarEvent[];
};

type CalendarListResponse = {
  value?: CalendarSummary[];
  "@odata.nextLink"?: string;
};

export type MaintenanceVisitInput = {
  sessionId: string;
  address: string;
  email: string;
  name: string;
  phone: string;
  slotStart: string;
  slotEnd: string;
  kwp: string;
  installer: string;
  serviceCode: string;
  packageName: string;
  breakdown: string;
  extras: string;
  amountPaidSgd: string;
  scope: string;
  exclusions: string;
  cleaningAccessStatus: string;
  monitoringCompatibilityStatus: string;
  indicative: boolean;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function calendarMailbox(): string {
  return requiredEnv("MICROSOFT_CALENDAR_USER");
}

export async function getGraphAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.accessToken;
  }

  const tenant = requiredEnv("MICROSOFT_TENANT_ID");
  const clientId = requiredEnv("MICROSOFT_CLIENT_ID");
  const clientSecret = requiredEnv("MICROSOFT_CLIENT_SECRET");

  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: GRAPH_SCOPE,
        grant_type: "client_credentials",
      }),
    },
  );

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description || `Microsoft token request failed (${response.status})`,
    );
  }

  const expiresIn = Number(payload.expires_in) || 3600;
  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return payload.access_token;
}

export async function getGraphClient(): Promise<Client> {
  const token = await getGraphAccessToken();
  return Client.init({
    authProvider: (done) => {
      done(null, token);
    },
  });
}

function encodeUserPath(user: string): string {
  return `/users/${encodeURIComponent(user)}`;
}

function maintenanceCalendarName(): string {
  return (
    process.env.MICROSOFT_MAINTENANCE_CALENDAR_NAME?.trim() ||
    "Fomo Maintenance"
  );
}

function maintenanceCalendarPath(mailbox: string, calendarId: string): string {
  return `${encodeUserPath(mailbox)}/calendars/${encodeURIComponent(calendarId)}`;
}

async function resolveMaintenanceCalendarId(
  client: Client,
  mailbox: string,
): Promise<string> {
  const explicitId = process.env.MICROSOFT_MAINTENANCE_CALENDAR_ID?.trim();
  if (explicitId) {
    return explicitId;
  }

  const name = maintenanceCalendarName();
  const selector = `name:${name.toLocaleLowerCase("en-SG")}`;
  if (
    maintenanceCalendarCache?.mailbox === mailbox &&
    maintenanceCalendarCache.selector === selector
  ) {
    return maintenanceCalendarCache.id;
  }

  const calendars: CalendarSummary[] = [];
  let path: string | undefined =
    `${encodeUserPath(mailbox)}/calendars?$select=id,name&$top=100`;
  while (path) {
    const page = (await client.api(path).get()) as CalendarListResponse;
    calendars.push(...(page.value || []));
    const next = page["@odata.nextLink"];
    path = next ? next.replace("https://graph.microsoft.com/v1.0", "") : undefined;
  }

  const id = calendarIdMatchingName(calendars, name);
  maintenanceCalendarCache = { mailbox, selector, id };
  return id;
}

function graphDateTimeToDate(value?: GraphDateTime): Date | null {
  if (!value?.dateTime) {
    return null;
  }
  const raw = value.dateTime.replace(/\.\d+$/, "");
  if (raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const zone = value.timeZone || "";
  if (zone === TIMEZONE || zone === "Singapore Standard Time") {
    const parsed = new Date(`${raw}+08:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const asUtc = new Date(`${raw}Z`);
  return Number.isNaN(asUtc.getTime()) ? null : asUtc;
}

function toGraphLocal(iso: string): { dateTime: string; timeZone: string } {
  const date = new Date(iso);
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return { dateTime: `${dateKey}T${time}`, timeZone: TIMEZONE };
}

function isBusyStatus(status?: string): boolean {
  const value = (status || "").toLowerCase();
  if (!value || value === "free") {
    return false;
  }
  return (
    value === "busy" ||
    value === "tentative" ||
    value === "oof" ||
    value === "workingelsewhere" ||
    value === "unknown"
  );
}

function pushBusy(
  periods: BusyPeriod[],
  start?: GraphDateTime,
  end?: GraphDateTime,
): void {
  const from = graphDateTimeToDate(start);
  const to = graphDateTimeToDate(end);
  if (from && to && from < to) {
    periods.push({ start: from, end: to });
  }
}

async function busyFromSchedule(
  client: Client,
  mailbox: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<BusyPeriod[]> {
  const body = {
    schedules: [mailbox],
    startTime: toGraphLocal(rangeStart.toISOString()),
    endTime: toGraphLocal(rangeEnd.toISOString()),
    availabilityViewInterval: 30,
  };
  const data = (await client
    .api(`${encodeUserPath(mailbox)}/calendar/getSchedule`)
    .post(body)) as ScheduleResponse;

  const periods: BusyPeriod[] = [];
  for (const schedule of data.value || []) {
    for (const item of schedule.scheduleItems || []) {
      if (isBusyStatus(item.status)) {
        pushBusy(periods, item.start, item.end);
      }
    }
  }
  return periods;
}

async function busyFromCalendarView(
  client: Client,
  mailbox: string,
  rangeStart: Date,
  rangeEnd: Date,
  calendarId?: string,
): Promise<BusyPeriod[]> {
  const periods: BusyPeriod[] = [];
  const calendarPath = calendarId
    ? maintenanceCalendarPath(mailbox, calendarId)
    : `${encodeUserPath(mailbox)}/calendar`;
  let path: string | undefined =
    `${calendarPath}/calendarView?startDateTime=${encodeURIComponent(rangeStart.toISOString())}&endDateTime=${encodeURIComponent(rangeEnd.toISOString())}&$select=start,end,showAs,isCancelled&$top=100`;

  while (path) {
    const page = (await client.api(path).get()) as CalendarViewResponse;
    for (const event of page.value || []) {
      if (event.isCancelled) {
        continue;
      }
      if (isBusyStatus(event.showAs) || !event.showAs) {
        pushBusy(periods, event.start, event.end);
      }
    }
    const next = page["@odata.nextLink"];
    path = next ? next.replace("https://graph.microsoft.com/v1.0", "") : undefined;
  }

  return periods;
}

export async function listBusyPeriods(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<BusyPeriod[]> {
  const mailbox = calendarMailbox();
  const client = await getGraphClient();
  const maintenanceCalendarId = await resolveMaintenanceCalendarId(
    client,
    mailbox,
  );
  const merged: BusyPeriod[] = [];
  let scheduleOk = false;
  let viewOk = false;
  let maintenanceViewOk = false;

  try {
    merged.push(
      ...(await busyFromSchedule(client, mailbox, rangeStart, rangeEnd)),
    );
    scheduleOk = true;
  } catch (error) {
    console.error("[fomo-maintenance] getSchedule failed", error);
  }

  try {
    merged.push(
      ...(await busyFromCalendarView(client, mailbox, rangeStart, rangeEnd)),
    );
    viewOk = true;
  } catch (error) {
    console.error("[fomo-maintenance] calendarView failed", error);
  }

  try {
    merged.push(
      ...(await busyFromCalendarView(
        client,
        mailbox,
        rangeStart,
        rangeEnd,
        maintenanceCalendarId,
      )),
    );
    maintenanceViewOk = true;
  } catch (error) {
    console.error(
      "[fomo-maintenance] maintenance calendarView failed",
      error,
    );
  }

  if ((!scheduleOk && !viewOk) || !maintenanceViewOk) {
    throw new Error("Microsoft Graph calendar lookup failed");
  }

  return merged;
}

async function findEventBySessionId(
  client: Client,
  mailbox: string,
  calendarId: string,
  sessionId: string,
  slotStart: string,
  slotEnd: string,
): Promise<boolean> {
  const calendarPath = maintenanceCalendarPath(mailbox, calendarId);
  const filter = `singleValueExtendedProperties/Any(ep: ep/id eq '${STRIPE_SESSION_PROPERTY}' and ep/value eq '${sessionId}')`;
  try {
    const found = (await client
      .api(`${calendarPath}/events`)
      .filter(filter)
      .select("id")
      .top(1)
      .get()) as GraphEventListResponse;
    if ((found.value || []).length > 0) {
      return true;
    }
  } catch (error) {
    console.error(
      "[fomo-maintenance] extended-property session lookup failed",
      error,
    );
  }

  const windowStart = new Date(new Date(slotStart).getTime() - 5 * 60_000);
  const windowEnd = new Date(new Date(slotEnd).getTime() + 5 * 60_000);
  try {
    const view = (await client
      .api(`${calendarPath}/calendarView`)
      .query({
        startDateTime: windowStart.toISOString(),
        endDateTime: windowEnd.toISOString(),
      })
      .select("id,subject,body")
      .top(50)
      .get()) as CalendarViewResponse;
    return (view.value || []).some((event) =>
      (event.body?.content || event.subject || "").includes(sessionId),
    );
  } catch (error) {
    console.error(
      "[fomo-maintenance] calendarView session lookup failed",
      error,
    );
    return false;
  }
}

function visitBody(input: MaintenanceVisitInput): string {
  // Older paid Stripe sessions do not have package metadata, so retain their
  // original visit label while enriching all newly created package bookings.
  const visitType = input.packageName
    ? `Fomo Maintenance package: ${input.packageName}`
    : input.indicative
      ? "Site-check visit (indicative quote until confirmed on site)"
      : "First Fomo Maintenance visit";
  return [
    visitType,
    "",
    `kWp: ${input.kwp}`,
    `Installer: ${input.installer}`,
    ...(input.serviceCode ? [`Service code: ${input.serviceCode}`] : []),
    ...(input.breakdown ? [`Price breakdown: ${input.breakdown}`] : []),
    `Scope: ${input.scope || "—"}`,
    ...(input.exclusions ? [`Exclusions: ${input.exclusions}`] : []),
    `Amount paid: ${input.amountPaidSgd}`,
    `Extras: ${input.extras}`,
    ...(input.cleaningAccessStatus === "pending_confirmation"
      ? [
          "Cleaning access: Pending confirmation — do not perform roof work until safe access is confirmed.",
        ]
      : []),
    ...(input.monitoringCompatibilityStatus === "pending_confirmation"
      ? ["Monitoring compatibility: Pending confirmation."]
      : []),
    "",
    `Name: ${input.name}`,
    `Phone: ${input.phone}`,
    `Email: ${input.email}`,
    `Site address: ${input.address}`,
    "",
    `Stripe session: ${input.sessionId}`,
  ].join("\n");
}

export async function createMaintenanceVisit(
  input: MaintenanceVisitInput,
): Promise<"created" | "exists"> {
  const mailbox = calendarMailbox();
  const client = await getGraphClient();
  const maintenanceCalendarId = await resolveMaintenanceCalendarId(
    client,
    mailbox,
  );

  if (
    await findEventBySessionId(
      client,
      mailbox,
      maintenanceCalendarId,
      input.sessionId,
      input.slotStart,
      input.slotEnd,
    )
  ) {
    return "exists";
  }

  const subjectAddress =
    input.address.length > 160
      ? `${input.address.slice(0, 157)}...`
      : input.address;

  const subjectPrefix = input.serviceCode || "Fomo Maintenance visit";

  await client
    .api(`${maintenanceCalendarPath(mailbox, maintenanceCalendarId)}/events`)
    .post({
      subject: `${subjectPrefix} — ${subjectAddress}`,
      body: {
        contentType: "Text",
        content: visitBody(input),
      },
      start: toGraphLocal(input.slotStart),
      end: toGraphLocal(input.slotEnd),
      location: { displayName: input.address },
      attendees: [
        {
          emailAddress: { address: input.email, name: input.name },
          type: "required",
        },
      ],
      transactionId: input.sessionId,
      singleValueExtendedProperties: [
        { id: STRIPE_SESSION_PROPERTY, value: input.sessionId },
      ],
    });

  return "created";
}

export async function createMaintenanceVisitWithRetry(
  input: MaintenanceVisitInput,
): Promise<"created" | "exists"> {
  try {
    return await createMaintenanceVisit(input);
  } catch (firstError) {
    console.error(
      "[fomo-maintenance] Graph event create failed, retrying once",
      {
        sessionId: input.sessionId,
        error: firstError,
      },
    );
    return await createMaintenanceVisit(input);
  }
}
