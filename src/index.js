import { renderDashboard } from "./dashboard";
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const JSON_HEADERS = {
    "content-type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
};
const CSS_HEADERS = {
    "content-type": "text/css; charset=utf-8",
    "Cache-Control": "public, max-age=300",
    "Access-Control-Allow-Origin": "*"
};
const SLT_CLIENT_ID = "b7402e9d66808f762ccedbe42c20668e";
const LOGIN_ENDPOINT = "https://omniscapp.slt.lk/slt/ext/api/Account/Login";
const USAGE_ENDPOINT = "https://omniscapp.slt.lk/slt/ext/api/BBVAS/UsageSummary";
let cachedAccessToken = null;
export default {
    async fetch(request, env) {
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: JSON_HEADERS });
        }
        const url = new URL(request.url);
        switch (url.pathname) {
            case "/":
                return renderHome(env);
            case "/usage":
                return getUsage(env, url);
            case "/intraday":
                return getIntraday(env, url);
            case "/trigger":
                return triggerNow(env);
            case "/login":
                if (request.method !== "POST") {
                    return new Response("Method not allowed", { status: 405, headers: JSON_HEADERS });
                }
                return loginNow(env);
            case "/health":
                return new Response("ok", { status: 200 });
            default:
                return new Response(JSON.stringify({
                    message: "SLT usage monitor",
                    endpoints: ["/usage?days=7", "/trigger", "/health"],
                    crons: ["29 * * * *", "59 * * * *"]
                }), { headers: JSON_HEADERS });
        }
    },
    async scheduled(_event, env, ctx) {
        ctx.waitUntil(recordUsage(env));
    }
};
async function triggerNow(env) {
    try {
        const record = await recordUsage(env);
        return new Response(JSON.stringify({ stored: true, record }), {
            headers: JSON_HEADERS
        });
    }
    catch (error) {
        return new Response(JSON.stringify({ stored: false, error: getErrorMessage(error) }), { status: 500, headers: JSON_HEADERS });
    }
}
async function loginNow(env) {
    try {
        const token = await performSltLogin(env);
        cachedAccessToken = token;
        return new Response(JSON.stringify({ loggedIn: true }), { headers: JSON_HEADERS });
    }
    catch (error) {
        return new Response(JSON.stringify({ loggedIn: false, error: getErrorMessage(error) }), { status: 500, headers: JSON_HEADERS });
    }
}
async function renderHome(env) {
    const todaysEntry = await getTodaysUsageRow(env);
    const monthly = await getMonthlyUsage(env);
    const referenceDate = new Date();
    const intraday = await getDailyUsageSeries(env, referenceDate);
    const dayKey = formatColomboDayKey(referenceDate);
    const html = renderDashboard({
        latest: todaysEntry,
        dailyLimitGb: 10,
        intraday,
        monthly,
        selectedDayKey: dayKey,
        todayDayKey: dayKey
    });
    return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" }
    });
}
async function getUsage(env, url) {
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
    return new Response(JSON.stringify({
        count: result.results?.length ?? 0,
        since,
        rows: result.results ?? []
    }), { headers: JSON_HEADERS });
}
async function getIntraday(env, url) {
    const dayParam = url.searchParams.get("day");
    const reference = dayParam ? parseColomboDayParam(dayParam) : new Date();
    if (!reference) {
        return new Response(JSON.stringify({ error: "Invalid day parameter" }), {
            status: 400,
            headers: JSON_HEADERS
        });
    }
    const series = await getDailyUsageSeries(env, reference);
    return new Response(JSON.stringify({
        dayKey: formatColomboDayKey(reference),
        series
    }), { headers: JSON_HEADERS });
}
async function recordUsage(env) {
    const payload = await fetchUsagePayload(env);
    if (!payload.isSuccess) {
        throw new Error(payload.errorMessage ?? payload.errorMessege ?? "Unknown SLT API error");
    }
    const record = transformPayload(payload);
    await env.DB.prepare(`INSERT INTO usage_log (timestamp, package_name, used_gb, vas_used_gb, raw_json)
     VALUES (?, ?, ?, ?, ?)`)
        .bind(record.timestamp, record.packageName, record.usedGb, record.vasUsedGb, JSON.stringify(record.raw))
        .run();
    return record;
}
async function fetchUsagePayload(env) {
    const subscriberID = env.SLT_SUBSCRIBER_ID;
    if (!subscriberID) {
        throw new Error("Missing SLT_SUBSCRIBER_ID");
    }
    const tokensToTry = Array.from(new Set([cachedAccessToken, env.SLT_AUTH_TOKEN].filter((token) => typeof token === "string" && token.trim().length > 0)));
    let lastFailure = null;
    for (const token of tokensToTry) {
        const response = await requestUsageSummary(subscriberID, token, env);
        if (response.ok) {
            cachedAccessToken = token;
            return (await response.json());
        }
        lastFailure = response;
        if (!isUnauthorized(response)) {
            const text = await response.text();
            throw new Error(`SLT API failed with ${response.status}: ${text}`);
        }
        break;
    }
    if (!canAutoLogin(env)) {
        if (lastFailure) {
            const text = await lastFailure.text();
            throw new Error(`SLT API failed with ${lastFailure.status}: ${text}`);
        }
        throw new Error("No SLT auth token available. Provide SLT_AUTH_TOKEN or configure SLT_USERNAME and SLT_PASSWORD secrets for auto-login.");
    }
    const freshToken = await performSltLogin(env);
    cachedAccessToken = freshToken;
    const retryResponse = await requestUsageSummary(subscriberID, freshToken, env);
    if (!retryResponse.ok) {
        const text = await retryResponse.text();
        throw new Error(`SLT API failed after re-login with ${retryResponse.status}: ${text}`);
    }
    return (await retryResponse.json());
}
async function requestUsageSummary(subscriberID, token, env) {
    const url = `${USAGE_ENDPOINT}?subscriberID=${encodeURIComponent(subscriberID)}`;
    return fetch(url, {
        headers: {
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            Authorization: `bearer ${token}`,
            Connection: "keep-alive",
            Origin: "https://myslt.slt.lk",
            Referer: "https://myslt.slt.lk/",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "User-Agent": env.SLT_USER_AGENT ?? DEFAULT_USER_AGENT,
            "X-IBM-Client-Id": SLT_CLIENT_ID,
            "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"'
        }
    });
}
function canAutoLogin(env) {
    return Boolean(env.SLT_USERNAME && env.SLT_PASSWORD);
}
async function performSltLogin(env) {
    if (!env.SLT_USERNAME || !env.SLT_PASSWORD) {
        throw new Error("Missing SLT_USERNAME or SLT_PASSWORD secret");
    }
    const body = new URLSearchParams({
        username: env.SLT_USERNAME,
        password: env.SLT_PASSWORD,
        channelID: env.SLT_CHANNEL_ID ?? "WEB"
    });
    const response = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: {
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: "https://myslt.slt.lk",
            Referer: "https://myslt.slt.lk/",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "User-Agent": env.SLT_USER_AGENT ?? DEFAULT_USER_AGENT,
            "X-IBM-Client-Id": SLT_CLIENT_ID,
            "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"'
        },
        body
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`SLT login failed with ${response.status}: ${text}`);
    }
    const loginPayload = (await response.json());
    const accessToken = loginPayload.accessToken?.trim();
    if (!accessToken) {
        throw new Error("SLT login response did not include an accessToken");
    }
    return accessToken;
}
function isUnauthorized(response) {
    return response.status === 401 || response.status === 403;
}
function transformPayload(payload) {
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
function parseNullableNumber(value) {
    if (value === null || value === undefined) {
        return null;
    }
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}
function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
async function getMonthlyUsage(env) {
    const { startUtc, endUtc, dayKeys } = getColomboMonthBounds(new Date());
    const query = `
    SELECT timestamp, vas_used_gb
    FROM usage_log
    WHERE timestamp >= ? AND timestamp < ?
    ORDER BY datetime(timestamp) ASC
  `;
    const result = await env.DB.prepare(query).bind(startUtc.toISOString(), endUtc.toISOString()).all();
    const map = new Map();
    for (const row of result.results ?? []) {
        const ts = row.timestamp;
        if (!ts)
            continue;
        const dayKey = formatColomboDayKey(new Date(ts));
        const value = parseNullableNumber(row.vas_used_gb) ?? 0;
        map.set(dayKey, value);
    }
    return dayKeys.map((dayKey) => ({
        dayKey,
        label: formatDayLabel(dayKey),
        vasUsed: map.get(dayKey) ?? 0
    }));
}
async function getDailyUsageSeries(env, reference) {
    const { startUtc, endUtc } = getColomboDayBounds(reference);
    const rows = await env.DB.prepare(`SELECT timestamp, vas_used_gb
     FROM usage_log
     WHERE timestamp >= ? AND timestamp < ?
     ORDER BY datetime(timestamp) ASC`)
        .bind(startUtc.toISOString(), endUtc.toISOString())
        .all();
    const slotInfo = buildIntradaySlots(startUtc, endUtc);
    const entries = (rows.results ?? [])
        .map((row) => {
        const ts = row.timestamp;
        if (!ts)
            return null;
        return {
            date: new Date(ts),
            value: parseNullableNumber(row.vas_used_gb) ?? 0
        };
    })
        .filter((entry) => entry !== null);
    let cursor = 0;
    let currentValue = 0;
    return slotInfo.map(({ slotTime, label }) => {
        while (cursor < entries.length && entries[cursor].date <= slotTime) {
            currentValue = entries[cursor].value;
            cursor++;
        }
        return { label, vasUsed: currentValue };
    });
}
async function getTodaysUsageRow(env) {
    const { startUtc, endUtc } = getColomboDayBounds(new Date());
    const result = await env.DB.prepare(`SELECT timestamp, package_name, used_gb, vas_used_gb
     FROM usage_log
     WHERE timestamp >= ? AND timestamp < ?
     ORDER BY datetime(timestamp) DESC
     LIMIT 1`)
        .bind(startUtc.toISOString(), endUtc.toISOString())
        .all();
    return result.results?.[0] ?? null;
}
const COLOMBO_OFFSET_MINUTES = 330;
const COLOMBO_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
});
const COLOMBO_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit"
});
function getColomboMonthBounds(reference) {
    const offsetMs = COLOMBO_OFFSET_MINUTES * 60 * 1000;
    const shifted = new Date(reference.getTime() + offsetMs);
    const year = shifted.getUTCFullYear();
    const month = shifted.getUTCMonth();
    const startColomboUtc = Date.UTC(year, month, 1);
    const endColomboUtc = Date.UTC(year, month + 1, 1);
    const startUtc = new Date(startColomboUtc - offsetMs);
    const endUtc = new Date(endColomboUtc - offsetMs);
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const dayKeys = [];
    for (let day = 1; day <= daysInMonth; day++) {
        dayKeys.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
    return { startUtc, endUtc, dayKeys };
}
function getColomboDayBounds(reference) {
    const offsetMs = COLOMBO_OFFSET_MINUTES * 60 * 1000;
    const shifted = new Date(reference.getTime() + offsetMs);
    const year = shifted.getUTCFullYear();
    const month = shifted.getUTCMonth();
    const day = shifted.getUTCDate();
    const startColomboUtc = Date.UTC(year, month, day);
    const endColomboUtc = Date.UTC(year, month, day + 1);
    const startUtc = new Date(startColomboUtc - offsetMs);
    const endUtc = new Date(endColomboUtc - offsetMs);
    return { startUtc, endUtc };
}
function formatDayLabel(dayKey) {
    const date = new Date(`${dayKey}T00:00:00+05:30`);
    return date.toLocaleDateString("en-US", { day: "numeric" });
}
function formatColomboDayKey(date) {
    return COLOMBO_DAY_FORMATTER.format(date);
}
function parseColomboDayParam(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }
    const parsed = Date.parse(`${value}T00:00:00+05:30`);
    return Number.isNaN(parsed) ? null : new Date(parsed);
}
function buildIntradaySlots(startUtc, endUtc) {
    const slots = [];
    const firstOffsetMs = 29 * 60 * 1000;
    const intervalMs = 30 * 60 * 1000;
    const totalSlots = 48;
    for (let i = 0; i < totalSlots; i++) {
        const slotTime = new Date(startUtc.getTime() + firstOffsetMs + i * intervalMs);
        if (slotTime > endUtc)
            break;
        slots.push({ slotTime, label: formatColomboTimeLabel(slotTime) });
    }
    return slots;
}
function formatColomboTimeLabel(date) {
    return COLOMBO_TIME_FORMATTER.format(date);
}
