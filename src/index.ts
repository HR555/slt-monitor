import { renderDashboard, type UsageRow, type MonthlyUsagePoint } from "./dashboard";

interface Env {
  DB: D1Database;
  SLT_SUBSCRIBER_ID: string;
  SLT_AUTH_TOKEN: string;
  SLT_USER_AGENT?: string;
}

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*"
};

type UsagePayload = {
  isSuccess: boolean;
  dataBundle?: {
    status?: string;
    reported_time?: string;
    my_package_summary?: Summary;
    vas_data_summary?: Summary;
    my_package_info?: {
      package_name?: string;
      usageDetails?: UsageDetail[];
      reported_time?: string;
    };
  };
  errorMessage?: string | null;
  errorMessege?: string | null;
};

type Summary = {
  limit?: string | null;
  used?: string | null;
  volume_unit?: string | null;
};

type UsageDetail = {
  name?: string;
  used?: string | null;
  volume_unit?: string | null;
};

type UsageRecord = {
  timestamp: string;
  packageName: string | null;
  usedGb: number | null;
  vasUsedGb: number | null;
  raw: UsagePayload;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: JSON_HEADERS });
    }

    const url = new URL(request.url);
    switch (url.pathname) {
      case "/":
        return renderHome(env);
      case "/usage":
        return getUsage(env, url);
      case "/trigger":
        return triggerNow(env);
      case "/health":
        return new Response("ok", { status: 200 });
      default:
        return new Response(
          JSON.stringify({
            message: "SLT usage monitor",
            endpoints: ["/usage?days=7", "/trigger", "/health"],
            crons: ["29 * * * *", "59 * * * *"]
          }),
          { headers: JSON_HEADERS }
        );
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(recordUsage(env));
  }
};

async function triggerNow(env: Env): Promise<Response> {
  try {
    const record = await recordUsage(env);
    return new Response(JSON.stringify({ stored: true, record }), {
      headers: JSON_HEADERS
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ stored: false, error: getErrorMessage(error) }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
}

async function renderHome(env: Env): Promise<Response> {
  const latest = await getLatestUsageRow(env);
  const todaysEntry = latest && isSameColomboDay(latest.timestamp) ? latest : null;
  const monthly = await getMonthlyUsage(env);
  const html = renderDashboard({ latest: todaysEntry, dailyLimitGb: 10, monthly });
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

async function getUsage(env: Env, url: URL): Promise<Response> {
  const daysParam = url.searchParams.get("days");
  const limitDays = Number.isFinite(Number(daysParam)) ? Number(daysParam) : 7;
  const days = limitDays > 0 ? limitDays : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const query = `
    SELECT id, timestamp, package_name, used_gb, vas_used_gb
    FROM usage_log
    WHERE timestamp >= ?
    ORDER BY timestamp DESC
  `;

  const result = await env.DB.prepare(query).bind(since).all();
  return new Response(
    JSON.stringify({
      count: result.results?.length ?? 0,
      since,
      rows: result.results ?? []
    }),
    { headers: JSON_HEADERS }
  );
}

async function recordUsage(env: Env): Promise<UsageRecord> {
  const payload = await fetchUsagePayload(env);
  if (!payload.isSuccess) {
    throw new Error(payload.errorMessage ?? payload.errorMessege ?? "Unknown SLT API error");
  }

  const record = transformPayload(payload);

  await env.DB.prepare(
    `INSERT INTO usage_log (timestamp, package_name, used_gb, vas_used_gb, raw_json)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(record.timestamp, record.packageName, record.usedGb, record.vasUsedGb, JSON.stringify(record.raw))
    .run();

  return record;
}

async function fetchUsagePayload(env: Env): Promise<UsagePayload> {
  const subscriberID = env.SLT_SUBSCRIBER_ID;
  if (!subscriberID) {
    throw new Error("Missing SLT_SUBSCRIBER_ID");
  }

  if (!env.SLT_AUTH_TOKEN) {
    throw new Error("Missing SLT_AUTH_TOKEN secret");
  }

  const url = `https://omniscapp.slt.lk/slt/ext/api/BBVAS/UsageSummary?subscriberID=${encodeURIComponent(
    subscriberID
  )}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Authorization: `bearer ${env.SLT_AUTH_TOKEN}`,
      Connection: "keep-alive",
      Origin: "https://myslt.slt.lk",
      Referer: "https://myslt.slt.lk/",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "User-Agent": env.SLT_USER_AGENT ?? DEFAULT_USER_AGENT,
      "X-IBM-Client-Id": "b7402e9d66808f762ccedbe42c20668e",
      "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SLT API failed with ${response.status}: ${text}`);
  }

  return (await response.json()) as UsagePayload;
}

function transformPayload(payload: UsagePayload): UsageRecord {
  const now = new Date().toISOString();
  const packageName = payload.dataBundle?.my_package_info?.package_name ?? null;
  const usedSummary = payload.dataBundle?.my_package_summary?.used;
  const vasSummary = payload.dataBundle?.vas_data_summary?.used;
  const fallbackUsage = payload.dataBundle?.my_package_info?.usageDetails?.[0]?.used;

  return {
    timestamp: now,
    packageName,
    usedGb: parseNullableNumber(usedSummary) ?? parseNullableNumber(fallbackUsage),
    vasUsedGb: parseNullableNumber(vasSummary),
    raw: payload
  };
}

function parseNullableNumber(value?: string | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function getMonthlyUsage(env: Env): Promise<MonthlyUsagePoint[]> {
  const { startUtc, endUtc, dayKeys } = getColomboMonthBounds(new Date());
  const query = `
    SELECT strftime('%Y-%m-%d', datetime(timestamp, '+5 hours 30 minutes')) AS colombo_day,
           MAX(vas_used_gb) AS vas_used
    FROM usage_log
    WHERE timestamp >= ? AND timestamp < ?
    GROUP BY colombo_day
  `;

  const result = await env.DB.prepare(query).bind(startUtc.toISOString(), endUtc.toISOString()).all();
  const map = new Map<string, number>();
  for (const row of result.results ?? []) {
    const dayKey = row.colombo_day as string | null;
    if (!dayKey) continue;
    const value = Number(row.vas_used ?? 0);
    map.set(dayKey, Number.isFinite(value) ? value : 0);
  }

  return dayKeys.map((dayKey) => ({
    dayKey,
    label: formatDayLabel(dayKey),
    vasUsed: map.get(dayKey) ?? 0
  }));
}

async function getLatestUsageRow(env: Env): Promise<UsageRow | null> {
  const result = await env.DB.prepare(
    `SELECT timestamp, package_name, used_gb, vas_used_gb
     FROM usage_log
     ORDER BY datetime(timestamp) DESC
     LIMIT 1`
  ).all();

  const row = (result.results?.[0] as UsageRow | undefined) ?? null;
  return row;
}

function isSameColomboDay(timestamp: string): boolean {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const todayKey = formatter.format(new Date());
  const tsKey = formatter.format(new Date(timestamp));
  return todayKey === tsKey;
}

const COLOMBO_OFFSET_MINUTES = 330;

function getColomboMonthBounds(reference: Date) {
  const offsetMs = COLOMBO_OFFSET_MINUTES * 60 * 1000;
  const shifted = new Date(reference.getTime() + offsetMs);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();

  const startColomboUtc = Date.UTC(year, month, 1);
  const endColomboUtc = Date.UTC(year, month + 1, 1);

  const startUtc = new Date(startColomboUtc - offsetMs);
  const endUtc = new Date(endColomboUtc - offsetMs);

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const dayKeys: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    dayKeys.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }

  return { startUtc, endUtc, dayKeys };
}

function formatDayLabel(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00+05:30`);
  return date.toLocaleDateString("en-US", { day: "numeric" });
}
