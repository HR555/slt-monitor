export function renderDashboard({ latest, dailyLimitGb, intraday, monthly, selectedDayKey, todayDayKey }) {
  const vasUsed = latest?.vas_used_gb ?? 0;
  const baseUsed = latest?.used_gb ?? 0;
  const remaining = Math.max(dailyLimitGb - vasUsed, 0);
  const percentage = Math.min((vasUsed / dailyLimitGb) * 100, 100);
  const reportedAt = latest ? new Date(latest.timestamp).toLocaleString("en-GB", { timeZone: "Asia/Colombo" }) : "—";
  const packageName = latest?.package_name ?? "Unknown package";
  const selectedDayTitle = formatSelectedDayTitle(selectedDayKey, todayDayKey);
  const serializedIntraday = JSON.stringify(intraday).replace(/</g, "\\u003c");
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SLT Fiber Usage Monitor</title>
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="shortcut icon" href="/favicon.ico">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
    
    :root {
      --bg-dark: #020b1c;
      --panel-bg: rgba(10, 25, 47, 0.45);
      --panel-border: rgba(255, 255, 255, 0.06);
      --text-primary: #f3f4f6;
      --text-secondary: #94a3b8;
      --accent-base: linear-gradient(135deg, #00adef, #005fa9);
      --accent-vas: linear-gradient(135deg, #4eb848, #00adef);
      --emerald: #4eb848;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      min-height: 100vh;
      background-color: var(--bg-dark);
      background-image: 
        radial-gradient(at 0% 0%, rgba(0, 174, 240, 0.15) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(78, 184, 72, 0.08) 0px, transparent 50%),
        radial-gradient(at 50% 50%, rgba(2, 11, 28, 1) 0px, transparent 100%);
      color: var(--text-primary);
      font-family: 'Outfit', 'Inter', system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      overflow-x: hidden;
    }

    .card {
      width: 100%;
      max-width: 960px;
      border-radius: 24px;
      background: var(--panel-bg);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid var(--panel-border);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.03);
      padding: 40px;
      display: flex;
      flex-direction: column;
      gap: 32px;
      position: relative;
    }

    /* Header styling */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 20px;
      flex-wrap: wrap;
      gap: 16px;
    }
    
    .logo-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 95, 169, 0.2);
      overflow: hidden;
    }

    .logo-text h1 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      background: linear-gradient(to right, #fff, #9ca3af);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .logo-text p {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .status-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      padding: 6px 14px;
      border-radius: 99px;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--emerald);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--emerald);
      animation: pulse-emerald 2s infinite;
    }

    @keyframes pulse-emerald {
      0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      50% { transform: scale(1.2); opacity: 0.5; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0); }
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }

    .stats-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 16px;
      transition: border-color 0.2s ease;
    }

    .stats-card:hover {
      border-color: rgba(255, 255, 255, 0.1);
    }

    .stats-card-title {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .gauge-container {
      display: flex;
      align-items: center;
      gap: 20px;
      flex: 1;
    }

    .gauge-svg-wrapper {
      position: relative;
      width: 88px;
      height: 88px;
      flex-shrink: 0;
    }

    .gauge-svg-wrapper svg {
      width: 100%;
      height: 100%;
    }

    .gauge-center-text {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .gauge-val {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .gauge-pct {
      font-size: 0.7rem;
      color: var(--text-secondary);
    }

    .gauge-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .gauge-info .main-val {
      font-size: 1.5rem;
      font-weight: 700;
      color: #fff;
    }

    .gauge-info .sub-val {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .linear-progress-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      justify-content: center;
    }

    .linear-val-display {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }

    .linear-val {
      font-size: 1.75rem;
      font-weight: 700;
      color: #fff;
    }

    .linear-progress-bar {
      height: 8px;
      border-radius: 99px;
      background: rgba(255, 255, 255, 0.05);
      overflow: hidden;
    }

    .linear-progress-fill {
      height: 100%;
      background: var(--accent-base);
      border-radius: 99px;
    }

    .info-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 0.85rem;
      justify-content: center;
      flex: 1;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
      padding-bottom: 6px;
    }

    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .info-label {
      color: var(--text-secondary);
    }

    .info-value {
      font-weight: 500;
      color: var(--text-primary);
    }

    /* Charts Grid */
    .charts-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 24px;
    }

    .chart-panel {
      background: rgba(255, 255, 255, 0.01);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 20px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      min-width: 0;
    }

    .chart-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }

    .chart-panel-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: #fff;
    }

    .chart-panel-subtitle {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    /* Line Chart Styling */
    .line-card {
      background: rgba(0, 0, 0, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.03);
      border-radius: 16px;
      padding: 20px;
      position: relative;
      overflow: visible;
    }

    .line-card.loading::after {
      content: "";
      position: absolute;
      inset: 0;
      background: rgba(8, 13, 26, 0.8);
      backdrop-filter: blur(4px);
      display: grid;
      place-items: center;
      border-radius: 16px;
      z-index: 5;
    }

    .line-card.loading::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      width: 28px;
      height: 28px;
      border: 2px solid rgba(0, 174, 240, 0.2);
      border-top-color: #00adef;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      z-index: 6;
      margin-left: -14px;
      margin-top: -14px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .line-wrapper {
      width: 100%;
      height: 180px;
      position: relative;
      cursor: crosshair;
    }

    svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .line-grid line {
      stroke: rgba(255, 255, 255, 0.05);
      stroke-width: 0.5;
    }

    .line-path {
      fill: none;
      stroke: url(#lineStrokeGrad);
      stroke-width: 2.5;
      stroke-linejoin: round;
      stroke-linecap: round;
    }

    .line-fill {
      fill: url(#lineFillGrad);
      opacity: 0.15;
    }

    .axis {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      font-size: 0.75rem;
      color: var(--text-secondary);
      padding: 0 4px;
    }

    .axis span {
      white-space: nowrap;
    }

    /* Bar Chart Styling */
    .chart-bars {
      display: flex;
      gap: 10px;
      align-items: flex-end;
      height: 200px;
      padding-top: 24px;
      overflow-x: auto;
      padding-bottom: 8px;
      width: 100%;
    }

    .chart-bars::-webkit-scrollbar {
      height: 4px;
    }

    .chart-bars::-webkit-scrollbar-track {
      background: transparent;
    }

    .chart-bars::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 99px;
    }

    .chart-bars::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .chart-bar {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      height: 100%;
      outline: none;
      transition: transform 0.2s ease;
    }

    .chart-bar:hover {
      transform: translateY(-2px);
    }
    
    .chart-bar:focus-visible .bar-track {
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.4);
    }

    .bar-column {
      flex: 1;
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      position: relative;
    }

    .bar-value {
      font-size: 0.7rem;
      color: var(--text-secondary);
      margin-bottom: 6px;
      transition: color 0.2s ease, font-weight 0.2s ease;
      white-space: nowrap;
    }

    .bar-track {
      width: 16px;
      height: 100%;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 99px;
      position: relative;
      overflow: hidden;
      transition: background-color 0.2s ease;
    }

    .column-fill {
      width: 100%;
      border-radius: 99px;
      background: var(--accent-vas);
      position: absolute;
      bottom: 0;
      left: 0;
      transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .chart-bar.selected .column-fill {
      box-shadow: 0 0 12px rgba(236, 72, 153, 0.4);
      filter: brightness(1.15);
    }

    .chart-bar.selected .bar-track {
      border-color: rgba(236, 72, 153, 0.4);
      background: rgba(236, 72, 153, 0.05);
    }

    .bar-label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin-top: 8px;
      transition: color 0.2s ease, font-weight 0.2s ease;
    }

    .chart-bar.selected .bar-label {
      color: #ec4899;
      font-weight: 600;
    }

    .chart-bar.selected .bar-value {
      color: #fff;
      font-weight: 600;
    }

    /* Tooltip styling */
    .chart-tooltip {
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      padding: 8px 12px;
      color: #fff;
      font-size: 0.8rem;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
      transform: translate(-50%, -100%);
      pointer-events: none;
      z-index: 10;
      transition: opacity 0.1s ease;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .tooltip-time {
      color: var(--text-secondary);
      font-weight: 500;
    }

    .tooltip-value {
      font-weight: 700;
      color: #00adef;
      font-size: 0.9rem;
    }

    /* Footer styling */
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 24px;
      margin-top: 8px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .timestamp {
      font-size: 0.85rem;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .timestamp svg {
      width: 16px;
      height: 16px;
      stroke: var(--text-secondary);
      fill: none;
      stroke-width: 2;
    }

    button {
      background: linear-gradient(135deg, #00adef, #005fa9);
      color: #fff;
      border: none;
      border-radius: 12px;
      padding: 12px 24px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 95, 169, 0.2);
    }
    
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 95, 169, 0.4);
    }

    button:active {
      transform: translateY(0);
    }

    button:disabled {
      background: rgba(255, 255, 255, 0.1);
      color: #6b7280;
      cursor: not-allowed;
      box-shadow: none;
    }

    /* Empty states */
    .empty {
      text-align: center;
      padding: 48px 0;
      color: var(--text-secondary);
      font-size: 0.95rem;
    }

    @media (max-width: 768px) {
      body {
        padding: 16px;
      }
      .card {
        padding: 24px;
        gap: 24px;
      }
      .charts-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main class="card">
    <header class="header">
      <div class="logo-section">
        <div class="logo-icon">
          <img src="/logo.jpg" alt="SLT Logo" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;" />
        </div>
        <div class="logo-text">
          <h1>SLT Usage Monitor</h1>
          <p>${packageName}</p>
        </div>
      </div>
      <div class="status-badge">
        <div class="status-dot"></div>
        <span>Active</span>
      </div>
    </header>

    ${latest
      ? `
    <section class="stats-grid">
      <!-- Card 1: VAS Gauge -->
      <div class="stats-card">
        <span class="stats-card-title">VAS Usage Today</span>
        <div class="gauge-container">
          <div class="gauge-svg-wrapper">
            <svg viewBox="0 0 100 100" class="gauge">
              <defs>
                <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#ec4899" />
                  <stop offset="100%" stop-color="#8b5cf6" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="38" stroke="rgba(255, 255, 255, 0.05)" stroke-width="7" fill="transparent" />
              <circle cx="50" cy="50" r="38" stroke="url(#gaugeGrad)" stroke-width="7" fill="transparent" 
                stroke-dasharray="238.76" 
                stroke-dashoffset="${(238.76 - (238.76 * percentage) / 100).toFixed(2)}" 
                stroke-linecap="round" 
                transform="rotate(-90 50 50)" 
                style="transition: stroke-dashoffset 0.5s ease;" />
            </svg>
            <div class="gauge-center-text">
              <span class="gauge-val">${percentage.toFixed(0)}%</span>
              <span class="gauge-pct">used</span>
            </div>
          </div>
          <div class="gauge-info">
            <span class="main-val">${vasUsed.toFixed(2)} GB</span>
            <span class="sub-val">of ${dailyLimitGb} GB limit</span>
            <span class="sub-val" style="color: var(--emerald); font-weight: 500;">${remaining.toFixed(2)} GB left</span>
          </div>
        </div>
      </div>

      <!-- Card 2: Base Usage -->
      <div class="stats-card">
        <span class="stats-card-title">Base Package Today</span>
        <div class="linear-progress-section">
          <div class="linear-val-display">
            <span class="linear-val">${baseUsed.toFixed(2)} GB</span>
          </div>
          <div class="linear-progress-bar">
            <div class="linear-progress-fill" style="width: 100%"></div>
          </div>
        </div>
      </div>

      <!-- Card 3: Metadata -->
      <div class="stats-card">
        <span class="stats-card-title">Sync Statistics</span>
        <div class="info-list">
          <div class="info-row">
            <span class="info-label">Last Checked</span>
            <span class="info-value">${reportedAt}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Active Host</span>
            <span class="info-value">Cloudflare Worker</span>
          </div>
        </div>
      </div>
    </section>
        `
      : `<div class="empty">No usage entries recorded yet.</div>`}

    <section class="charts-grid">
      <!-- Intraday activity line chart -->
      <div class="chart-panel">
        <div class="chart-panel-header">
          <div>
            <h2 class="chart-panel-title" id="selectedDayTitle">${selectedDayTitle}</h2>
            <p class="chart-panel-subtitle">30-minute snapshot intervals</p>
          </div>
        </div>
        <div class="line-card" data-limit="${dailyLimitGb}">
          <div id="lineChartContainer">
            ${intraday.length
      ? `
            <div class="line-wrapper" id="lineChartWrapper">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" id="chartSvg">
                <defs>
                  <linearGradient id="lineFillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#00adef" stop-opacity="0.8" />
                    <stop offset="100%" stop-color="#005fa9" stop-opacity="0" />
                  </linearGradient>
                  <linearGradient id="lineStrokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#00adef" />
                    <stop offset="100%" stop-color="#4eb848" />
                  </linearGradient>
                </defs>
                <g class="line-grid">
                  <line x1="0" y1="100" x2="100" y2="100" />
                  <line x1="0" y1="50" x2="100" y2="50" />
                  <line x1="0" y1="0" x2="100" y2="0" />
                </g>
                <path class="line-fill" d="${bezierArea(intraday, dailyLimitGb)}" />
                <path class="line-path" d="${bezierPath(intraday, dailyLimitGb)}" />
                <line id="crosshair" x1="0" y1="0" x2="0" y2="100" stroke="rgba(255, 255, 255, 0.25)" stroke-width="0.5" stroke-dasharray="2 2" style="display: none;" />
                <circle id="activePoint" cx="0" cy="0" r="1.5" fill="#00adef" stroke="#fff" stroke-width="0.5" style="display: none; filter: drop-shadow(0 0 4px #00aef0);" />
              </svg>
              <div id="chartTooltip" class="chart-tooltip" style="opacity: 0; left: 0; top: 0; position: absolute;"></div>
            </div>
            <div class="axis">
              ${intraday
        .map((point, idx) => (idx % 4 === 0 || idx === intraday.length - 1 ? `<span>${point.label}</span>` : ""))
        .join("")}
            </div>
                `
      : `<div class="empty">No samples for the selected day yet.</div>`}
          </div>
        </div>
      </div>

      <!-- Monthly daily snapshots bar chart -->
      <div class="chart-panel">
        <div class="chart-panel-header">
          <div>
            <h2 class="chart-panel-title">This Month</h2>
            <p class="chart-panel-subtitle">Daily VAS usage snapshot</p>
          </div>
        </div>
        <div class="chart-bars">
          ${monthly.length
      ? monthly
        .map((point) => `
          <div class="chart-bar${point.dayKey === selectedDayKey ? " selected" : ""}" data-day-key="${point.dayKey}" role="button" tabindex="0" aria-label="Show snapshots for ${point.dayKey}" aria-pressed="${point.dayKey === selectedDayKey}">
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
      </div>
    </section>

    <footer class="footer">
      <div class="timestamp">
        <svg viewBox="0 0 24 24">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <span>${latest ? `Last synced · ${reportedAt}` : "Waiting for first sync"}</span>
      </div>
      <button id="triggerBtn">Update Now</button>
    </footer>
  </main>

  <script>
    const button = document.getElementById("triggerBtn");
    if (button) {
      button.addEventListener("click", async () => {
        button.disabled = true;
        const originalLabel = button.textContent;
        button.textContent = "Syncing...";
        try {
          await triggerWithAutoLogin();
          button.textContent = "Synced ✓";
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

    initInteractiveCharts();

    function initInteractiveCharts() {
      const lineChartContainer = document.getElementById("lineChartContainer");
      const lineCard = document.querySelector(".line-card");
      const selectedDayTitleEl = document.getElementById("selectedDayTitle");
      if (!lineChartContainer || !lineCard || !selectedDayTitleEl) {
        return;
      }

      const todayDayKey = "${todayDayKey}";
      let selectedDayKey = "${selectedDayKey}";
      const dailyLimit = ${dailyLimitGb};
      const initialIntraday = ${serializedIntraday};
      const intradayCache = new Map([[selectedDayKey, initialIntraday]]);
      const monthlyBars = Array.from(document.querySelectorAll(".chart-bar[data-day-key]"));
      const dayFormatter = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
      });

      // Init tooltip on load
      initTooltipListeners(initialIntraday);

      monthlyBars.forEach((bar) => {
        const dayKey = bar.getAttribute("data-day-key");
        if (!dayKey) return;
        const handleSelection = () => {
          if (dayKey === selectedDayKey) {
            return;
          }
          handleDaySelection(dayKey, bar);
        };
        bar.addEventListener("click", handleSelection);
        bar.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }
          event.preventDefault();
          handleSelection();
        });
      });

      async function handleDaySelection(dayKey, triggerEl) {
        lineCard.classList.add("loading");
        try {
          const series = await fetchIntraday(dayKey);
          selectedDayKey = dayKey;
          renderLineChart(series);
          updateSelectedDayTitle(dayKey);
          highlightSelectedBar(triggerEl);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to load snapshots for that day.";
          alert(message);
        } finally {
          lineCard.classList.remove("loading");
        }
      }

      async function fetchIntraday(dayKey) {
        if (intradayCache.has(dayKey)) {
          return intradayCache.get(dayKey) ?? [];
        }
        const response = await fetch(\`/intraday?day=\${dayKey}\`);
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to load snapshots for that day.");
        }
        const series = Array.isArray(payload?.series) ? payload.series : [];
        intradayCache.set(dayKey, series);
        return series;
      }

      function renderLineChart(series) {
        if (!Array.isArray(series) || series.length === 0) {
          lineChartContainer.innerHTML = '<div class="empty">No samples for the selected day yet.</div>';
          return;
        }
        const axisMarkup = series
          .map((point, idx) => (idx % 4 === 0 || idx === series.length - 1 ? \`<span>\${point.label}</span>\` : ""))
          .join("");
        lineChartContainer.innerHTML = \`
          <div class="line-wrapper" id="lineChartWrapper">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" id="chartSvg">
              <defs>
                <linearGradient id="lineFillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#00adef" stop-opacity="0.8" />
                  <stop offset="100%" stop-color="#005fa9" stop-opacity="0" />
                </linearGradient>
                <linearGradient id="lineStrokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#00adef" />
                  <stop offset="100%" stop-color="#4eb848" />
                </linearGradient>
              </defs>
              <g class="line-grid">
                <line x1="0" y1="100" x2="100" y2="100" />
                <line x1="0" y1="50" x2="100" y2="50" />
                <line x1="0" y1="0" x2="100" y2="0" />
              </g>
              <path class="line-fill" d="\${buildBezierArea(series)}" />
              <path class="line-path" d="\${buildBezierPath(series)}" />
              <line id="crosshair" x1="0" y1="0" x2="0" y2="100" stroke="rgba(255, 255, 255, 0.25)" stroke-width="0.5" stroke-dasharray="2 2" style="display: none;" />
              <circle id="activePoint" cx="0" cy="0" r="1.5" fill="#00adef" stroke="#fff" stroke-width="0.5" style="display: none; filter: drop-shadow(0 0 4px #00aef0);" />
            </svg>
            <div id="chartTooltip" class="chart-tooltip" style="opacity: 0; left: 0; top: 0; position: absolute;"></div>
          </div>
          <div class="axis">\${axisMarkup}</div>
        \`;
        initTooltipListeners(series);
      }

      function initTooltipListeners(currentSeries) {
        const lineWrapper = document.getElementById("lineChartWrapper");
        const crosshair = document.getElementById("crosshair");
        const activePoint = document.getElementById("activePoint");
        const tooltip = document.getElementById("chartTooltip");

        if (!lineWrapper || !crosshair || !activePoint || !tooltip || currentSeries.length === 0) {
          return;
        }

        lineWrapper.addEventListener("mousemove", (e) => {
          const rect = lineWrapper.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          
          const percentX = (mouseX / rect.width) * 100;
          const lastIndex = currentSeries.length - 1 || 1;
          const idx = Math.min(Math.max(Math.round((percentX / 100) * lastIndex), 0), currentSeries.length - 1);
          const point = currentSeries[idx];
          
          if (point) {
            const pointX = (idx / lastIndex) * 100;
            const limit = dailyLimit > 0 ? dailyLimit : 1;
            const pointY = 100 - Math.min((point.vasUsed / limit) * 100, 100);
            
            crosshair.setAttribute("x1", pointX.toFixed(2));
            crosshair.setAttribute("x2", pointX.toFixed(2));
            crosshair.style.display = "block";
            
            activePoint.setAttribute("cx", pointX.toFixed(2));
            activePoint.setAttribute("cy", pointY.toFixed(2));
            activePoint.style.display = "block";
            
            const tooltipX = (pointX / 100) * rect.width;
            const tooltipY = (pointY / 100) * rect.height;
            
            tooltip.style.opacity = "1";
            tooltip.style.left = \`\${tooltipX}px\`;
            tooltip.style.top = \`\${tooltipY - 12}px\`;
            tooltip.innerHTML = \`
              <span class="tooltip-time">\${point.label}</span>
              <span class="tooltip-value">\${point.vasUsed.toFixed(2)} GB</span>
            \`;
          }
        });
        
        lineWrapper.addEventListener("mouseleave", () => {
          crosshair.style.display = "none";
          activePoint.style.display = "none";
          tooltip.style.opacity = "0";
        });
      }

      function buildBezierPath(series) {
        if (!Array.isArray(series) || series.length === 0) {
          return "";
        }
        const limit = dailyLimit > 0 ? dailyLimit : 1;
        const lastIndex = series.length - 1 || 1;
        let d = "";
        series.forEach((point, idx) => {
          const x = (idx / lastIndex) * 100;
          const y = 100 - Math.min((point.vasUsed / limit) * 100, 100);
          if (idx === 0) {
            d = \`M \${x.toFixed(2)},\${y.toFixed(2)}\`;
          } else {
            const prevX = ((idx - 1) / lastIndex) * 100;
            const prevY = 100 - Math.min((series[idx - 1].vasUsed / limit) * 100, 100);
            const cp1x = prevX + (x - prevX) / 3;
            const cp1y = prevY;
            const cp2x = prevX + (2 * (x - prevX)) / 3;
            const cp2y = y;
            d += \` C \${cp1x.toFixed(2)},\${cp1y.toFixed(2)} \${cp2x.toFixed(2)},\${cp2y.toFixed(2)} \${x.toFixed(2)},\${y.toFixed(2)}\`;
          }
        });
        return d;
      }

      function buildBezierArea(series) {
        const path = buildBezierPath(series);
        if (!path) return "";
        return \`\${path} L 100,100 L 0,100 Z\`;
      }

      function highlightSelectedBar(target) {
        monthlyBars.forEach((bar) => {
          bar.classList.remove("selected");
          bar.setAttribute("aria-pressed", "false");
        });
        if (target) {
          target.classList.add("selected");
          target.setAttribute("aria-pressed", "true");
        }
      }

      function updateSelectedDayTitle(dayKey) {
        selectedDayTitleEl.textContent = formatSelectedDayTitle(dayKey);
      }

      function formatSelectedDayTitle(dayKey) {
        if (dayKey === todayDayKey) {
          return "Today";
        }
        const parsed = Date.parse(\`\${dayKey}T00:00:00+05:30\`);
        if (Number.isNaN(parsed)) {
          return dayKey;
        }
        return dayFormatter.format(new Date(parsed));
      }
    }
  </script>
</body>
</html>
`;
}
function bezierPath(series, limit) {
  if (series.length === 0)
    return "";
  const lastIndex = series.length - 1 || 1;
  let d = "";
  series.forEach((point, idx) => {
    const x = (idx / lastIndex) * 100;
    const y = 100 - Math.min((point.vasUsed / limit) * 100, 100);
    if (idx === 0) {
      d = `M ${x.toFixed(2)},${y.toFixed(2)}`;
    }
    else {
      const prevX = ((idx - 1) / lastIndex) * 100;
      const prevY = 100 - Math.min((series[idx - 1].vasUsed / limit) * 100, 100);
      const cp1x = prevX + (x - prevX) / 3;
      const cp1y = prevY;
      const cp2x = prevX + (2 * (x - prevX)) / 3;
      const cp2y = y;
      d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${x.toFixed(2)},${y.toFixed(2)}`;
    }
  });
  return d;
}
function bezierArea(series, limit) {
  const path = bezierPath(series, limit);
  if (!path)
    return "";
  return `${path} L 100,100 L 0,100 Z`;
}
function formatSelectedDayTitle(dayKey, todayDayKey) {
  if (dayKey === todayDayKey) {
    return "Today";
  }
  const parsed = Date.parse(`${dayKey}T00:00:00+05:30`);
  if (Number.isNaN(parsed)) {
    return dayKey;
  }
  return new Date(parsed).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}
