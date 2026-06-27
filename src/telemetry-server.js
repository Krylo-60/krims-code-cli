// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Visual Telemetry Server & Dashboard
// Zero-dependency local server serving a cyberpunk observability HUD.
// ═══════════════════════════════════════════════════════════

import http from "node:http";
import { exec } from "node:child_process";
import { getTelemetryData, clearTelemetryLogs } from "./ai/telemetry.js";
import { getAIConfig } from "./config.js";

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aether Core // Visual Telemetry HUD</title>
  <style>
    /* Reset & variables */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #070a13;
      --panel-bg: rgba(13, 19, 38, 0.7);
      --border: #1f2d5a;
      --text: #a9b2c3;
      --text-bright: #e2e8f0;
      --cyan: #00f0ff;
      --magenta: #ff007f;
      --green: #39ff14;
      --orange: #ffaa00;
      --red: #ff3b30;
      --font-mono: 'Roboto Mono', 'Courier New', monospace;
    }
    body {
      background-color: var(--bg);
      background-image: linear-gradient(rgba(31, 45, 90, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(31, 45, 90, 0.1) 1px, transparent 1px);
      background-size: 20px 20px;
      color: var(--text);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--cyan); }

    /* HUD Header */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid var(--border);
      padding-bottom: 12px;
      margin-bottom: 10px;
    }
    .hud-title {
      font-family: var(--font-mono);
      font-weight: 800;
      font-size: 1.5rem;
      letter-spacing: 2px;
      color: var(--cyan);
      text-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .hud-title::before {
      content: "";
      display: inline-block;
      width: 12px;
      height: 12px;
      background-color: var(--cyan);
      box-shadow: 0 0 8px var(--cyan);
      border-radius: 50%;
    }
    .system-status {
      display: flex;
      align-items: center;
      gap: 15px;
      font-family: var(--font-mono);
      font-size: 0.85rem;
    }
    .badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: bold;
      border: 1px solid transparent;
    }
    .badge-cyan {
      background: rgba(0, 240, 255, 0.1);
      color: var(--cyan);
      border-color: var(--cyan);
    }
    .badge-green {
      background: rgba(57, 255, 20, 0.1);
      color: var(--green);
      border-color: var(--green);
      animation: pulse 2s infinite;
    }
    .badge-danger {
      background: rgba(255, 59, 48, 0.1);
      color: var(--red);
      border-color: var(--red);
      cursor: pointer;
    }
    .badge-danger:hover {
      background: var(--red);
      color: white;
    }

    @keyframes pulse {
      0% { opacity: 0.6; box-shadow: 0 0 0 0 rgba(57, 255, 20, 0.4); }
      70% { opacity: 1; box-shadow: 0 0 0 6px rgba(57, 255, 20, 0); }
      100% { opacity: 0.6; box-shadow: 0 0 0 0 rgba(57, 255, 20, 0); }
    }

    /* Grid layout */
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }
    .card {
      background: var(--panel-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      position: relative;
      overflow: hidden;
      backdrop-filter: blur(8px);
      transition: all 0.3s ease;
    }
    .card::before {
      content: "";
      position: absolute;
      top: 0; left: 0; width: 4px; height: 100%;
      background: var(--border);
      transition: background 0.3s;
    }
    .card:hover {
      border-color: var(--cyan);
      box-shadow: 0 0 15px rgba(0, 240, 255, 0.15);
      transform: translateY(-2px);
    }
    .card:hover::before {
      background: var(--cyan);
    }
    .card-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text);
      margin-bottom: 6px;
    }
    .card-value {
      font-size: 1.8rem;
      font-weight: 700;
      color: var(--text-bright);
      font-family: var(--font-mono);
    }
    .card-subtext {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 4px;
    }

    /* Two Columns Panels */
    .panels-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 900px) {
      .panels-row { grid-template-columns: 1fr; }
    }

    .panel {
      background: var(--panel-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      backdrop-filter: blur(8px);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
    }
    .panel-title {
      font-family: var(--font-mono);
      font-size: 0.95rem;
      font-weight: bold;
      color: var(--cyan);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    /* Topology styles */
    .topology-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 250px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .topology-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: rgba(31, 45, 90, 0.2);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .topology-name {
      font-weight: 600;
      color: var(--text-bright);
    }
    .topology-model {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: #64748b;
    }
    .topology-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-mono);
      font-size: 0.75rem;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot-online { background-color: var(--green); box-shadow: 0 0 6px var(--green); }
    .dot-offline { background-color: #64748b; }

    /* Chart / SVG Container */
    .chart-container {
      width: 100%;
      height: 200px;
      position: relative;
    }
    .chart-svg {
      width: 100%;
      height: 100%;
    }

    /* Progress bars for models */
    .model-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 250px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .model-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .model-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      font-family: var(--font-mono);
    }
    .model-name-text { color: var(--text-bright); }
    .model-tokens { color: var(--magenta); }
    .progress-bar-bg {
      height: 8px;
      background: rgba(31, 45, 90, 0.4);
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--magenta), var(--cyan));
      border-radius: 4px;
      width: 0%;
      transition: width 0.8s ease;
    }

    /* Terminal Console */
    .console-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 250px;
    }
    .table-container {
      overflow-x: auto;
      flex: 1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      text-align: left;
    }
    th {
      border-bottom: 2px solid var(--border);
      padding: 8px;
      color: var(--cyan);
      text-transform: uppercase;
      font-weight: bold;
    }
    td {
      border-bottom: 1px solid rgba(31, 45, 90, 0.3);
      padding: 8px;
    }
    tr:hover td {
      background: rgba(0, 240, 255, 0.05);
      color: var(--text-bright);
    }
    .status-ok { color: var(--green); font-weight: bold; }
    .status-fail { color: var(--red); font-weight: bold; }

    /* Action buttons */
    .btn-container {
      display: flex;
      gap: 10px;
    }
    .btn {
      background: rgba(31, 45, 90, 0.3);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      transition: all 0.2s;
    }
    .btn:hover {
      border-color: var(--cyan);
      color: var(--cyan);
      box-shadow: 0 0 8px rgba(0, 240, 255, 0.3);
    }
    .btn-clear:hover {
      border-color: var(--magenta);
      color: var(--magenta);
      box-shadow: 0 0 8px rgba(255, 0, 127, 0.3);
    }
    .btn-refresh {
      background: rgba(0, 240, 255, 0.1);
      border-color: var(--cyan);
      color: var(--cyan);
    }
  </style>
</head>
<body>
  <header>
    <div class="hud-title">Aether Core // Telemetry HUD</div>
    <div class="system-status">
      <span class="badge badge-cyan" id="node-count">NODES: 0</span>
      <span class="badge badge-green">LIVE STREAMING</span>
      <span class="badge badge-danger" onclick="shutdownServer()">SHUTDOWN HUD</span>
    </div>
  </header>

  <div class="dashboard-grid">
    <div class="card">
      <div class="card-label">Avg Mesh Latency</div>
      <div class="card-value" id="stat-latency">--</div>
      <div class="card-subtext">Across success queries</div>
    </div>
    <div class="card">
      <div class="card-label">Success Rate</div>
      <div class="card-value" id="stat-success-rate">--</div>
      <div class="card-subtext" id="stat-success-fraction">0 / 0 runs</div>
    </div>
    <div class="card">
      <div class="card-label">Cumulative Tokens</div>
      <div class="card-value" id="stat-tokens">--</div>
      <div class="card-subtext" id="stat-tokens-breakdown">I: 0  |  O: 0</div>
    </div>
    <div class="card">
      <div class="card-label">Active Mesh Nodes</div>
      <div class="card-value" id="stat-mesh-nodes">--</div>
      <div class="card-subtext" id="stat-mesh-ratio">0 configured</div>
    </div>
  </div>

  <div class="panels-row">
    <!-- Failover Mesh Topology Panel -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">Failover Mesh Nodes</div>
        <div id="mesh-status-indicator" class="topology-status"><span class="dot dot-online"></span>ONLINE</div>
      </div>
      <div class="topology-list" id="topology-list">
        <!-- populated by js -->
      </div>
    </div>

    <!-- Latency History Panel -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">Latency Timeline (ms)</div>
        <div class="topology-status" id="latency-span">Past queries</div>
      </div>
      <div class="chart-container" id="chart-container">
        <!-- SVG injected by JS -->
      </div>
    </div>
  </div>

  <div class="panels-row">
    <!-- Model Breakdown Panel -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">Model Token Breakdown</div>
      </div>
      <div class="model-list" id="model-list">
        <!-- populated by js -->
      </div>
    </div>

    <!-- Quick controls / sessions -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">HUD Observability Control</div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 15px; font-size: 0.85rem; line-height: 1.5;">
        <div>
          This dashboard provides real-time latency diagnostics, mesh failover trace telemetry, and token accounting for Aether Core AI. 
          It tracks active providers, network latencies, and offline fallback routes.
        </div>
        <div class="btn-container">
          <button class="btn btn-refresh" onclick="updateData()">Force Poll HUD</button>
          <button class="btn btn-clear" onclick="clearTelemetry()">Format Logs</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Terminal Console Panel -->
  <div class="panel console-panel">
    <div class="panel-header">
      <div class="panel-title">Live Telemetry Logs</div>
      <div class="btn-container">
        <input type="text" id="log-search" placeholder="Filter provider/model..." class="btn" style="padding: 4px 8px; cursor: text;" oninput="filterLogs()">
      </div>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Node / Provider</th>
            <th>Model</th>
            <th>Latency</th>
            <th>Tokens (I/O)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="logs-tbody">
          <!-- populated by js -->
        </tbody>
      </table>
    </div>
  </div>

  <script>
    let globalData = null;

    async function fetchData() {
      try {
        const res = await fetch('/api/telemetry');
        const data = await res.json();
        globalData = data;
        renderDashboard(data);
      } catch (err) {
        console.error("Failed to fetch telemetry data", err);
      }
    }

    function renderDashboard(data) {
      const logs = data.latencyLogs || [];
      const mesh = data.meshStructure || [];
      const tokenStats = data.tokenStats || { prompt: 0, completion: 0, total: 0, exchanges: 0 };
      const modelBreakdown = data.modelBreakdown || {};

      // 1. Calculate historical metrics from logs (cumulative across CLI runs)
      const successRuns = logs.filter(l => l.success);
      const totalRuns = logs.length;
      const successRate = totalRuns > 0 ? Math.round((successRuns.length / totalRuns) * 100) : 100;
      
      const totalSuccessLatency = successRuns.reduce((sum, l) => sum + l.latencyMs, 0);
      const avgLatency = successRuns.length > 0 ? Math.round(totalSuccessLatency / successRuns.length) : null;

      // Cumulative tokens in the logs
      const logPromptTokens = logs.reduce((sum, l) => sum + (l.promptTokens || 0), 0);
      const logCompletionTokens = logs.reduce((sum, l) => sum + (l.completionTokens || 0), 0);
      const logTotalTokens = logPromptTokens + logCompletionTokens;

      // Update stat cards
      document.getElementById('stat-latency').innerText = avgLatency ? avgLatency + ' ms' : '--';
      document.getElementById('stat-success-rate').innerText = successRate + '%';
      document.getElementById('stat-success-fraction').innerText = successRuns.length + ' / ' + totalRuns + ' successful';
      
      document.getElementById('stat-tokens').innerText = logTotalTokens.toLocaleString();
      document.getElementById('stat-tokens-breakdown').innerText = 'I: ' + logPromptTokens.toLocaleString() + '  |  O: ' + logCompletionTokens.toLocaleString();

      // Mesh stats
      const activeCount = mesh.filter(m => m.configured).length;
      const totalCount = mesh.length;
      document.getElementById('node-count').innerText = 'NODES: ' + (activeCount + 1); // +1 for local solver / companion
      document.getElementById('stat-mesh-nodes').innerText = (activeCount + 1) + ' Online';
      document.getElementById('stat-mesh-ratio').innerText = activeCount + ' / ' + totalCount + ' config providers';

      // Update Mesh list
      const topoList = document.getElementById('topology-list');
      topoList.innerHTML = '';
      
      // Always add Local Math / Fallback Node 0
      topoList.appendChild(createTopologyElement({
        name: "Local Solver Node",
        configured: true,
        defaultModel: "Offline Math + Krylo Companion",
        tier: "free",
        description: "Zero-latency mathematical reasoning & local assistant fallbacks."
      }, "Node 0 (Local)"));

      mesh.forEach((provider, idx) => {
        topoList.appendChild(createTopologyElement(provider, "Node " + (idx + 1)));
      });

      // Update Model list
      // We calculate model token usage from logs to show cumulative token distribution
      const logModels = {};
      logs.forEach(l => {
        if (l.success && l.model) {
          if (!logModels[l.model]) {
            logModels[l.model] = 0;
          }
          logModels[l.model] += (l.promptTokens || 0) + (l.completionTokens || 0);
        }
      });

      const modelList = document.getElementById('model-list');
      modelList.innerHTML = '';
      
      const modelKeys = Object.keys(logModels);
      if (modelKeys.length === 0) {
        modelList.innerHTML = '<div style="font-size: 0.8rem; color: #64748b;">No model data recorded.</div>';
      } else {
        const maxTokens = Math.max(...Object.values(logModels));
        modelKeys.forEach(model => {
          const tokens = logModels[model];
          const percent = maxTokens > 0 ? (tokens / maxTokens) * 100 : 0;
          
          const modelDiv = document.createElement('div');
          modelDiv.className = 'model-item';
          modelDiv.innerHTML = \`
            <div class="model-meta">
              <span class="model-name-text">\${model}</span>
              <span class="model-tokens">\${tokens.toLocaleString()} tokens</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: \${percent}%"></div>
            </div>
          \`;
          modelList.appendChild(modelDiv);
        });
      }

      // Draw SVG chart
      drawSvgChart(logs);

      // Render logs table
      renderLogsTable(logs);
    }

    function createTopologyElement(provider, nodeLabel) {
      const el = document.createElement('div');
      el.className = 'topology-item';
      el.innerHTML = \`
        <div>
          <div class="topology-name">\${provider.name} <span style="font-size:0.75rem; color: var(--cyan); margin-left: 5px;">\${nodeLabel}</span></div>
          <div class="topology-model">\${provider.defaultModel}</div>
        </div>
        <div class="topology-status">
          <span class="dot \${provider.configured ? 'dot-online' : 'dot-offline'}"></span>
          \${provider.configured ? 'ONLINE' : 'OFFLINE'}
        </div>
      \`;
      return el;
    }

    function drawSvgChart(logs) {
      const container = document.getElementById('chart-container');
      container.innerHTML = '';

      if (!logs || logs.length === 0) {
        container.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; font-size:0.85rem; color:#64748b;">Waiting for telemetry trace signals...</div>';
        return;
      }

      // Take last 20 queries for chart
      const chartLogs = logs.slice(-20);
      const maxLatency = Math.max(...chartLogs.map(l => l.latencyMs), 1000); // at least 1000ms ceiling
      
      const width = container.clientWidth || 400;
      const height = 180;
      const padding = 25;

      const chartW = width - padding * 2;
      const chartH = height - padding * 2;

      // Draw SVG elements
      let svg = \`<svg class="chart-svg" viewBox="0 0 \${width} \${height}" xmlns="http://www.w3.org/2000/svg">\`;
      
      // Grid lines (y)
      const gridLevels = [0, 0.25, 0.5, 0.75, 1];
      gridLevels.forEach(lvl => {
        const y = padding + chartH * (1 - lvl);
        const val = Math.round(maxLatency * lvl);
        svg += \`
          <line x1="\${padding}" y1="\${y}" x2="\${width - padding}" y2="\${y}" stroke="#1f2d5a" stroke-dasharray="3,3" stroke-width="1"/>
          <text x="\${padding - 5}" y="\${y + 4}" fill="#64748b" font-family="monospace" font-size="8" text-anchor="end">\${val}ms</text>
        \`;
      });

      // Calculate coordinates
      const points = [];
      const stepX = chartLogs.length > 1 ? chartW / (chartLogs.length - 1) : chartW;

      chartLogs.forEach((log, idx) => {
        const x = padding + (idx * stepX);
        const y = padding + chartH * (1 - (log.latencyMs / maxLatency));
        points.push({ x, y, log });
      });

      // Draw path (line)
      if (points.length > 1) {
        let pathD = \`M \${points[0].x} \${points[0].y}\`;
        for (let i = 1; i < points.length; i++) {
          pathD += \` L \${points[i].x} \${points[i].y}\`;
        }
        svg += \`<path d="\${pathD}" fill="none" stroke="var(--cyan)" stroke-width="2" style="filter: drop-shadow(0px 0px 4px rgba(0,240,255,0.5));"/>\`;
      }

      // Draw points
      points.forEach((p, idx) => {
        const color = p.log.success ? 'var(--cyan)' : 'var(--red)';
        const title = \`\${p.log.provider} (\${p.log.latencyMs}ms)\`;
        svg += \`
          <circle cx="\${p.x}" cy="\${p.y}" r="4" fill="\${color}" stroke="var(--bg)" stroke-width="1" class="chart-point">
            <title>\${title}</title>
          </circle>
        \`;
      });

      // X Axis timestamps (only draw first, middle, last to avoid overlap)
      if (points.length > 0) {
        const timeIndices = [0];
        if (points.length > 2) timeIndices.push(Math.floor(points.length / 2));
        if (points.length > 1) timeIndices.push(points.length - 1);

        timeIndices.forEach(idx => {
          const p = points[idx];
          const d = new Date(p.log.timestamp);
          const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          svg += \`
            <text x="\${p.x}" y="\${height - 5}" fill="#64748b" font-family="monospace" font-size="8" text-anchor="middle">\${timeStr}</text>
          \`;
        });
      }

      svg += \`</svg>\`;
      container.innerHTML = svg;
    }

    function renderLogsTable(logs) {
      const tbody = document.getElementById('logs-tbody');
      tbody.innerHTML = '';

      if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">No telemetry frames captured yet. Run a prompt in another terminal.</td></tr>';
        return;
      }

      const filterVal = document.getElementById('log-search').value.toLowerCase();

      // Render logs in reverse order (newest first)
      const reversed = [...logs].reverse();
      let shownCount = 0;

      reversed.forEach(log => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const prov = log.provider || 'unknown';
        const model = log.model || 'unknown';
        
        if (filterVal && !prov.toLowerCase().includes(filterVal) && !model.toLowerCase().includes(filterVal)) {
          return;
        }

        shownCount++;
        const row = document.createElement('tr');
        const totalTok = (log.promptTokens || 0) + (log.completionTokens || 0);
        const tokensText = totalTok > 0 ? \`\${totalTok} (\${log.promptTokens}/\${log.completionTokens})\` : '--';
        
        row.innerHTML = \`
          <td>\${time}</td>
          <td style="color: var(--text-bright);">\${prov}</td>
          <td>\${model}</td>
          <td>\${log.latencyMs} ms</td>
          <td>\${tokensText}</td>
          <td class="\${log.success ? 'status-ok' : 'status-fail'}">\${log.success ? '[ OK ]' : '[ FAIL ]'}</td>
        \`;
        tbody.appendChild(row);
      });

      if (shownCount === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">No logs match your filter.</td></tr>';
      }
    }

    function filterLogs() {
      if (globalData && globalData.latencyLogs) {
        renderLogsTable(globalData.latencyLogs);
      }
    }

    async function clearTelemetry() {
      if (confirm("Are you sure you want to format and clear all persisted telemetry database?")) {
        try {
          await fetch('/api/clear', { method: 'POST' });
          fetchData();
        } catch (err) {
          console.error(err);
        }
      }
    }

    async function shutdownServer() {
      if (confirm("Terminate Visual Telemetry HUD local server?")) {
        try {
          await fetch('/api/shutdown', { method: 'POST' });
          document.body.innerHTML = '<div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:90vh; gap:20px; font-family:monospace; color:var(--magenta);"><h1 style="font-size:2rem;">HUD TERMINATED</h1><p style="color:var(--text);">Local telemetry server was shut down successfully.</p></div>';
        } catch (err) {
          console.error(err);
        }
      }
    }

    function updateData() {
      fetchData();
    }

    // Initial load
    fetchData();

    // Auto update every 2 seconds
    setInterval(fetchData, 2000);
  </script>
</body>
</html>
`;

/**
 * Starts the telemetry server on a free port, starting at `port`.
 * @param {number} port - Preferred port to start on
 * @returns {Promise<{server: object, port: number}>}
 */
export function startTelemetryServer(port = 5050) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (req.url === "/api/telemetry" && req.method === "GET") {
        try {
          const config = await getAIConfig();
          const telemetryData = getTelemetryData(config);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(telemetryData));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Internal Server Error: " + err.message);
        }
      } else if (req.url === "/api/clear" && req.method === "POST") {
        try {
          clearTelemetryLogs();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Internal Server Error: " + err.message);
        }
      } else if (req.url === "/api/shutdown" && req.method === "POST") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        setTimeout(() => {
          server.close(() => {
            // In unit tests, we don't want to kill the test runner process
            if (process.env.NODE_ENV !== "test") {
              process.exit(0);
            }
          });
        }, 300);
      } else if (req.url === "/" || req.url === "/index.html") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(HTML_CONTENT);
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(startTelemetryServer(port + 1));
      } else {
        reject(err);
      }
    });

    server.listen(port, () => {
      resolve({ server, port });
    });
  });
}

/**
 * Opens the telemetry HUD page in the default system browser.
 * @param {string} url - The localhost URL to open
 */
export function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  // On Windows, start can require a title argument before the URL
  const runCmd = process.platform === "win32" ? `start "" "${url}"` : `${cmd} "${url}"`;
  exec(runCmd, (err) => {
    if (err) {
      // Fail silently, user can open url manually printed in console
    }
  });
}
