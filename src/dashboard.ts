export type DashboardProps = {
  latest: UsageRow | null;
  dailyLimitGb: number;
};

export type UsageRow = {
  timestamp: string;
  package_name: string | null;
  used_gb: number | null;
  vas_used_gb: number | null;
};

export function renderDashboard({ latest, dailyLimitGb }: DashboardProps): string {
  const used = latest?.used_gb ?? 0;
  const remaining = Math.max(dailyLimitGb - used, 0);
  const percentage = Math.min((used / dailyLimitGb) * 100, 100);
  const reportedAt = latest ? new Date(latest.timestamp).toLocaleString("en-GB", { timeZone: "Asia/Colombo" }) : "—";
  const packageName = latest?.package_name ?? "Unknown package";
  const vasUsed = latest?.vas_used_gb ?? 0;

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
    <h1>SLT Usage Today</h1>
    <p>${packageName}</p>

    ${
      latest
        ? `
    <section class="usage">
      <div class="usage-value">${used.toFixed(2)} GB</div>
      <div class="limit">Daily allocation ${dailyLimitGb} GB · Remaining ${remaining.toFixed(2)} GB</div>
      <div class="bar"><div class="fill"></div></div>
    </section>

    <section class="meta">
      <div class="meta-item">
        <span class="label">Reported</span>
        <span class="value">${reportedAt}</span>
      </div>
      <div class="meta-item">
        <span class="label">VAS Usage</span>
        <span class="value">${vasUsed.toFixed(2)} GB</span>
      </div>
    </section>
        `
        : `<div class="empty">No usage entries recorded yet.</div>`
    }

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

