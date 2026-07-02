// ═══════════════════════════════════════════════════════════
// Krims Code AI CLI — Telemetry & Latency Logger
// Logs request latencies, prompt speeds, and meshes provider logs.
// ═══════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { getSessionTokenStats, getBreakdownByModel } from "./tokens.js";
import { getActiveProviders, PROVIDERS } from "./providers.js";
import { listSessions } from "../config.js";

const CONFIG_DIR = join(homedir(), ".krims-code");
const TELEMETRY_FILE = join(CONFIG_DIR, "telemetry.json");

/**
 * Loads telemetry logs from disk.
 * @returns {Array}
 */
function loadTelemetryFromDisk() {
  try {
    if (existsSync(TELEMETRY_FILE)) {
      const raw = readFileSync(TELEMETRY_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Saves telemetry logs to disk.
 * @param {Array} logs
 */
function saveTelemetryToDisk(logs) {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(TELEMETRY_FILE, JSON.stringify(logs, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

const latencyLogs = loadTelemetryFromDisk();

/**
 * Records telemetry metrics for an AI call.
 * @param {string} provider - The provider name
 * @param {string} model - The model name
 * @param {number} latencyMs - The request latency in ms
 * @param {number} promptTokens - Prompt token count
 * @param {number} completionTokens - Completion token count
 * @param {boolean} success - Whether the call succeeded
 */
export function recordLatency(provider, model, latencyMs, promptTokens, completionTokens, success) {
  latencyLogs.push({
    timestamp: new Date().toISOString(),
    provider: provider || "unknown",
    model: model || "unknown",
    latencyMs: Math.round(latencyMs),
    promptTokens: promptTokens || 0,
    completionTokens: completionTokens || 0,
    success: !!success,
  });

  // Limit to last 100 entries for historical visualization
  if (latencyLogs.length > 100) {
    latencyLogs.shift();
  }

  saveTelemetryToDisk(latencyLogs);
}

/**
 * Returns raw latency records.
 * @returns {Array}
 */
export function getLatencyLogs() {
  return latencyLogs;
}

/**
 * Clears all telemetry logs.
 */
export function clearTelemetryLogs() {
  latencyLogs.length = 0;
  try {
    if (existsSync(TELEMETRY_FILE)) {
      unlinkSync(TELEMETRY_FILE);
    }
  } catch {
    // ignore
  }
}

/**
 * Gathers all metrics needed for the web dashboard visualization.
 * @param {object} config - krims-code configuration object
 * @returns {object}
 */
export function getTelemetryData(config = {}) {
  // Map active status for all providers in our registry
  const mesh = Object.entries(PROVIDERS).map(([id, provider]) => {
    const isConfigured = !!config[provider.key];
    return {
      id,
      name: provider.name,
      configured: isConfigured,
      defaultModel: provider.defaultModel,
      tier: provider.tier,
      description: provider.description,
    };
  });

  return {
    tokenStats: getSessionTokenStats(),
    modelBreakdown: getBreakdownByModel(),
    latencyLogs: [...latencyLogs],
    meshStructure: mesh,
    sessions: listSessions(),
  };
}
