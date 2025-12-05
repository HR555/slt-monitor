export function renderDashboard({ latest, dailyLimitGb, intraday, monthly }) {
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
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <main class="card">
    <h1>Data Usage Today</h1>
    <p>${packageName}</p>

    ${latest
        ? `
    <section class="usage">
      <div class="usage-value">${vasUsed.toFixed(2)} GB</div>
      <div class="limit">Daily allocation ${dailyLimitGb} GB · Remaining ${remaining.toFixed(2)} GB</div>
      <div class="bar"><div class="fill" style="--fill-width: ${percentage.toFixed(1)}%;"></div></div>
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
        : `<div class="empty">No usage entries recorded yet.</div>`}

    <section class="chart">
      <div class="chart-header">
        <div>
          <div class="chart-title">Today</div>
          <p class="chart-subtitle">30 min snapshots</p>
        </div>
      </div>
      <div class="line-card">
        ${intraday.length
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
        : `<div class="empty">No samples for today yet.</div>`}
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
        ${monthly.length
        ? monthly
            .map((point) => `
        <div class="chart-bar">
          <div class="bar-column">
            <span class="bar-value">${point.vasUsed.toFixed(1)} GB</span>
            <div class="bar-track">
              <div class="column-fill" style="height:${Math.min((point.vasUsed / dailyLimitGb) * 100, 100).toFixed(1)}%"></div>
            </div>
          </div>
          <span class="bar-label">${point.label}</span>
        </div>`)
            .join("")
        : `<div class="empty">No samples for this month yet.</div>`}
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
        const originalLabel = button.textContent;
        button.textContent = "Triggering...";
        try {
          await triggerWithAutoLogin();
          button.textContent = "Triggered ✓";
          setTimeout(() => location.reload(), 1200);
        } catch (err) {
          const rawMessage = err instanceof Error ? err.message : "Trigger failed";
          const friendlyMessage = /authorization has been denied/i.test(rawMessage)
            ? "Session expired. Auto-login is running; please retry in a few seconds."
            : rawMessage;
          button.textContent = "Try Again";
          alert(friendlyMessage);
          setTimeout(() => {
            button.textContent = originalLabel;
          }, 1500);
        } finally {
          button.disabled = false;
        }
      });
    }

    async function triggerWithAutoLogin() {
      const initial = await callTrigger();
      if (initial.success) return;

      if (!initial.shouldLogin) {
        throw new Error(initial.message);
      }

      const loginResult = await callLogin();
      if (!loginResult.success) {
        throw new Error(loginResult.message);
      }

      const secondAttempt = await callTrigger();
      if (!secondAttempt.success) {
        throw new Error(secondAttempt.message);
      }
    }

    async function callTrigger() {
      const res = await fetch("/trigger", { method: "POST" });
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.stored) {
        return { success: true };
      }
      const message =
        payload?.error ??
        (res.ok ? "Trigger failed" : "Trigger failed (" + res.status + ")");
      const shouldLogin =
        res.status === 401 ||
        res.status === 403 ||
        /authorization has been denied/i.test(message);
      return { success: false, message, shouldLogin };
    }

    async function callLogin() {
      const res = await fetch("/login", { method: "POST" });
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.loggedIn) {
        return { success: true };
      }
      const message =
        payload?.error ??
        (res.ok ? "Login failed" : "Login failed (" + res.status + ")");
      return { success: false, message };
    }
  </script>
</body>
</html>
`;
}
function linePoints(series, limit) {
    if (series.length === 0)
        return "";
    const lastIndex = series.length - 1 || 1;
    return series
        .map((point, idx) => {
        const x = (idx / lastIndex) * 100;
        const y = 100 - Math.min((point.vasUsed / limit) * 100, 100);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
        .join(" ");
}
function lineArea(series, limit) {
    if (series.length === 0)
        return "";
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
