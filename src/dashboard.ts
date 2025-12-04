export type DashboardProps = {
  latest: UsageRow | null;
  dailyLimitGb: number;
  intraday: DailyUsagePoint[];
  monthly: MonthlyUsagePoint[];
};

export type UsageRow = {
  timestamp: string;
  package_name: string | null;
  used_gb: number | null;
  vas_used_gb: number | null;
};

export type DailyUsagePoint = {
  label: string;
  vasUsed: number;
};

export type MonthlyUsagePoint = {
  dayKey: string;
  label: string;
  vasUsed: number;
};

export function renderDashboard({ latest, dailyLimitGb, intraday, monthly }: DashboardProps): string {
  const vasUsed = latest?.vas_used_gb ?? 0;
  const baseUsed = latest?.used_gb ?? 0;
  const remaining = Math.max(dailyLimitGb - vasUsed, 0);
  const percentage = Math.min((vasUsed / dailyLimitGb) * 100, 100);
  const reportedAt = latest ? new Date(latest.timestamp).toLocaleString("en-GB", { timeZone: "Asia/Colombo" }) : "—";
  const packageName = latest?.package_name ?? "Unknown package";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SLT Usage Monitor</title>
  <style>
    :root { font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; background: #f8fbff; color: #1f2a37; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { width: min(420px, 100%); border-radius: 18px; background: #ffffff; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08); padding: 32px; border: 1px solid #e8eef7; }
    h1 { margin: 0 0 8px; font-size: 1.5rem; color: #243b53; }
    p { margin: 4px 0 16px; color: #607086; }
    .usage { margin: 28px 0; }
    .usage-value { font-size: 3rem; font-weight: 600; color: #1f2a37; }
    .limit { font-size: 0.95rem; color: #8896ab; }
    .bar { height: 14px; border-radius: 999px; background: #e9eff7; overflow: hidden; margin-top: 12px; }
    .fill { height: 100%; width: ${percentage.toFixed(1)}%; background: linear-gradient(90deg, #a5b4fc, #fbcfe8); transition: width 0.4s ease; }
    .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 24px 0; }
    .meta-item { padding: 12px; border-radius: 12px; background: #fdf2f8; color: #9d174d; text-align: center; }
    .meta-item:nth-child(2) { background: #ecfeff; color: #047481; }
    .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 6px; }
    .value { font-size: 1.2rem; font-weight: 600; }
    .chart { margin-top: 28px; }
    .chart-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
    .chart-title { font-weight: 600; color: #243b53; }
    .chart-subtitle { color: #94a3b8; font-size: 0.9rem; margin: 0; }
    .line-card { margin-top: 16px; background: #f8f5ff; padding: 18px; border-radius: 16px; border: 1px solid #ece8ff; }
    .line-wrapper { width: 100%; height: 160px; position: relative; }
    svg { width: 100%; height: 100%; }
    .line-grid line { stroke: rgba(148, 163, 184, 0.3); stroke-width: 0.4; }
    .line-path { fill: none; stroke: #a5b4fc; stroke-width: 2.4; stroke-linejoin: round; stroke-linecap: round; }
    .line-fill { fill: url(#lineGradient); opacity: 0.45; }
    .axis { display: grid; grid-template-columns: repeat(auto-fit, minmax(40px, 1fr)); gap: 4px; margin-top: 12px; font-size: 0.7rem; color: #94a3b8; text-align: center; }
    .axis span { white-space: nowrap; }
    .chart-bars { display: flex; gap: 10px; align-items: flex-end; min-height: 150px; overflow-x: auto; padding-bottom: 8px; }
    .chart-bar { flex: 1; min-width: 28px; text-align: center; color: #94a3b8; font-size: 0.75rem; }
    .chart-bar .bar-column { position: relative; height: 120px; display: flex; flex-direction: column; justify-content: flex-end; }
    .chart-bar .bar-value { font-size: 0.7rem; margin-bottom: 6px; color: #475569; }
    .chart-bar .bar-track { background: #e9eff7; border-radius: 999px; width: 16px; height: 100%; margin: 0 auto; position: relative; overflow: hidden; }
    .chart-bar .column-fill { position: absolute; bottom: 0; left: 0; width: 100%; border-radius: inherit; background: linear-gradient(180deg, #a5b4fc, #fbcfe8); transition: height 0.3s ease; }
    .chart-bar .bar-label { margin-top: 6px; display: block; color: #94a3b8; }
    .footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    button { border: none; border-radius: 12px; padding: 12px 18px; font-weight: 600; cursor: pointer; background: #a5b4fc; color: #1f2a37; transition: transform 0.2s ease, opacity 0.2s ease; }
    button:hover { opacity: 0.9; transform: translateY(-1px); }
    .timestamp { font-size: 0.85rem; color: #6b7280; }
    .status { color: #047857; font-weight: 600; }
    .empty { text-align: center; padding: 40px 0 24px; color: #9ca3af; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Data Usage Today</h1>
    <p>${packageName}</p>

    ${
      latest
        ? `
    <section class="usage">
      <div class="usage-value">${vasUsed.toFixed(2)} GB</div>
      <div class="limit">Daily allocation ${dailyLimitGb} GB · Remaining ${remaining.toFixed(2)} GB</div>
      <div class="bar"><div class="fill"></div></div>
    </section>

    <section class="meta">
      <div class="meta-item">
        <span class="label">Reported</span>
        <span class="value">${reportedAt}</span>
      </div>
      <div class="meta-item">
        <span class="label">Base Usage</span>
        <span class="value">${baseUsed.toFixed(2)} GB</span>
      </div>
    </section>
        `
        : `<div class="empty">No usage entries recorded yet.</div>`
    }

    <section class="chart">
      <div class="chart-header">
        <div>
          <div class="chart-title">Today</div>
          <p class="chart-subtitle">30 min snapshots</p>
        </div>
      </div>
      <div class="line-card">
        ${
          intraday.length
            ? `
        <div class="line-wrapper">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#a5b4fc" stop-opacity="0.7" />
                <stop offset="100%" stop-color="#fbcfe8" stop-opacity="0" />
              </linearGradient>
            </defs>
            <g class="line-grid">
              <line x1="0" y1="100" x2="100" y2="100" />
              <line x1="0" y1="50" x2="100" y2="50" />
              <line x1="0" y1="0" x2="100" y2="0" />
            </g>
            <path class="line-fill" d="${lineArea(intraday, dailyLimitGb)}" />
            <polyline class="line-path" points="${linePoints(intraday, dailyLimitGb)}" />
          </svg>
        </div>
        <div class="axis">
          ${intraday
            .map((point, idx) => (idx % 4 === 0 || idx === intraday.length - 1 ? `<span>${point.label}</span>` : ""))
            .join("")}
        </div>
            `
            : `<div class="empty">No samples for today yet.</div>`
        }
      </div>
    </section>

    <section class="chart">
      <div class="chart-header">
        <div>
          <div class="chart-title">This Month</div>
          <p class="chart-subtitle">Daily VAS usage snapshot</p>
        </div>
      </div>
      <div class="chart-bars">
        ${
          monthly.length
            ? monthly
                .map(
                  (point) => `
        <div class="chart-bar">
          <div class="bar-column">
            <span class="bar-value">${point.vasUsed.toFixed(1)} GB</span>
            <div class="bar-track">
              <div class="column-fill" style="height:${Math.min(
                (point.vasUsed / dailyLimitGb) * 100,
                100
              ).toFixed(1)}%"></div>
            </div>
          </div>
          <span class="bar-label">${point.label}</span>
        </div>`
                )
                .join("")
            : `<div class="empty">No samples for this month yet.</div>`
        }
      </div>
    </section>

    <footer class="footer">
      <button id="triggerBtn">Trigger Fetch</button>
      <span class="timestamp">${latest ? `Last synced · ${reportedAt}` : "Waiting for first sync"}</span>
    </footer>
  </main>

  <script>
    const button = document.getElementById("triggerBtn");
    if (button) {
      button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "Triggering...";
        try {
          const res = await fetch("/trigger", { method: "POST" });
          if (!res.ok) throw new Error("Trigger failed");
          button.textContent = "Triggered ✓";
          setTimeout(() => location.reload(), 1200);
        } catch (err) {
          button.textContent = "Try Again";
          alert(err.message || "Trigger failed");
        } finally {
          button.disabled = false;
        }
      });
    }
  </script>
</body>
</html>
`;
}

function linePoints(series: DailyUsagePoint[], limit: number): string {
  if (series.length === 0) return "";
  const lastIndex = series.length - 1 || 1;
  return series
    .map((point, idx) => {
      const x = (idx / lastIndex) * 100;
      const y = 100 - Math.min((point.vasUsed / limit) * 100, 100);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function lineArea(series: DailyUsagePoint[], limit: number): string {
  if (series.length === 0) return "";
  const lastIndex = series.length - 1 || 1;
  const coords = series
    .map((point, idx) => {
      const x = (idx / lastIndex) * 100;
      const y = 100 - Math.min((point.vasUsed / limit) * 100, 100);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" L");
  return `M${coords} L100,100 L0,100 Z`;
}

