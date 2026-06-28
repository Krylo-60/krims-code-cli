// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Universal AI Router with Failover Mesh
// Routes through ALL configured providers automatically
// ═══════════════════════════════════════════════════════════

import { detectMathExpression, solveMath, generateOfflineReply } from "./fallback.js";
import { PROVIDERS, getActiveProviders } from "./providers.js";
import {
  callOpenAICompatible,
  callGoogleGemini,
  callAnthropic,
  callCohere,
} from "./universal.js";
import { estimateTokens, recordTokenUsage } from "./tokens.js";
import { recordLatency } from "./telemetry.js";

/**
 * Routes a prompt through the universal AI failover mesh.
 *
 * Priority Order:
 * 1. Local math solver (if pure math expression)
 * 2. All configured providers, in order of priority
 * 3. Google key rotation (if multiple keys)
 * 4. Krylo companion fallback (if everything else fails)
 *
 * @param {string} prompt - The user prompt
 * @param {string} systemPrompt - The mode system prompt
 * @param {object} config - Flat config object with all API keys
 * @returns {Promise<{ text: string, provider: string, model?: string, node: number, type?: string }>}
 */
export async function routePrompt(prompt, systemPrompt, config, onToken, history = []) {
  // ── Node 0: Local Math Solver ───────────────────────────
  const mathExpr = detectMathExpression(prompt);
  if (mathExpr) {
    const startTime = performance.now();
    const mathResult = solveMath(mathExpr);
    if (mathResult) {
      const latencyMs = performance.now() - startTime;
      const pTokens = estimateTokens(systemPrompt + prompt);
      const cTokens = estimateTokens(mathResult.text);
      const usage = recordTokenUsage("local-math", pTokens, cTokens);
      recordLatency("local", "math-solver", latencyMs, pTokens, cTokens, true);
      return { ...mathResult, provider: "local", node: 0, usage };
    }
  }

  // ── Gather all active providers ─────────────────────────
  const active = getActiveProviders(config);

  // Add extra Google keys for rotation
  const googleExtraKeys = config.GOOGLE_API_KEYS;
  if (googleExtraKeys) {
    const extras = googleExtraKeys.split(",").map((k) => k.trim()).filter(Boolean);
    for (const key of extras) {
      // Avoid duplicates
      if (!active.some((a) => a.id === "google" && a.apiKey === key)) {
        active.push({ id: "google-extra", provider: PROVIDERS.google, apiKey: key });
      }
    }
  }

  // ── No providers configured → Offline ───────────────────
  if (active.length === 0) {
    const startTime = performance.now();
    const offlineReply = generateOfflineReply(prompt);
    const latencyMs = performance.now() - startTime;
    const pTokens = estimateTokens(systemPrompt + prompt);
    const cTokens = estimateTokens(offlineReply.text);
    const usage = recordTokenUsage("offline-local", pTokens, cTokens);
    recordLatency("offline-fallback", "local", latencyMs, pTokens, cTokens, true);
    return { ...offlineReply, provider: "offline-fallback", node: 0, usage };
  }

  // ── Try each provider in order ──────────────────────────
  const errors = [];
  let nodeIndex = 1;

  for (const { id, provider, apiKey } of active) {
    const startTime = performance.now();
    try {
      const model = config[`${id.toUpperCase()}_MODEL`] || provider.defaultModel;
      let result;

      switch (provider.format) {
        case "openai":
          result = await callOpenAICompatible(
            prompt, systemPrompt, apiKey,
            provider.baseUrl, model, provider.name,
            onToken, history
          );
          break;

        case "custom-google":
          result = await callGoogleGemini(prompt, systemPrompt, apiKey, model, onToken, history);
          break;

        case "custom-anthropic":
          result = await callAnthropic(prompt, systemPrompt, apiKey, model, onToken, history);
          break;

        case "custom-cohere":
          result = await callCohere(prompt, systemPrompt, apiKey, model, onToken, history);
          break;

        default:
          // Treat unknown formats as OpenAI-compatible
          result = await callOpenAICompatible(
            prompt, systemPrompt, apiKey,
            provider.baseUrl, model, provider.name,
            onToken, history
          );
      }

      const latencyMs = performance.now() - startTime;
      const pTokens = estimateTokens(systemPrompt + prompt + history.map(h => h.content).join(""));
      const cTokens = estimateTokens(result.text);
      const usage = recordTokenUsage(result.model, pTokens, cTokens);

      recordLatency(provider.name, result.model, latencyMs, pTokens, cTokens, true);

      return { ...result, node: nodeIndex, usage };
    } catch (err) {
      const latencyMs = performance.now() - startTime;
      const pTokens = estimateTokens(systemPrompt + prompt + history.map(h => h.content).join(""));
      recordLatency(provider.name, "unknown", latencyMs, pTokens, 0, false);
      errors.push(`[Node ${nodeIndex} ${provider.name}] ${err.message}`);
      nodeIndex++;
    }
  }

  // ── Final Fallback: Offline Fallback ────────────────────
  const startTimeOffline = performance.now();
  const offlineReply = generateOfflineReply(prompt, errors);
  const latencyMsOffline = performance.now() - startTimeOffline;
  const pTokens = estimateTokens(systemPrompt + prompt + history.map(h => h.content).join(""));
  const cTokens = estimateTokens(offlineReply.text);
  const usage = recordTokenUsage("offline-local", pTokens, cTokens);
  recordLatency("offline-fallback", "local", latencyMsOffline, pTokens, cTokens, true);
  return {
    ...offlineReply,
    provider: "offline-fallback",
    node: 0,
    errors,
    usage,
  };
}
