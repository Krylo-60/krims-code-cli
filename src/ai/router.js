// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Universal AI Router with Failover Mesh
// Routes through ALL configured providers automatically
// ═══════════════════════════════════════════════════════════

import { detectMathExpression, solveMath, generateKryloReply } from "./fallback.js";
import { PROVIDERS, getActiveProviders } from "./providers.js";
import {
  callOpenAICompatible,
  callGoogleGemini,
  callAnthropic,
  callCohere,
} from "./universal.js";

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
export async function routePrompt(prompt, systemPrompt, config) {
  // ── Node 0: Local Math Solver ───────────────────────────
  const mathExpr = detectMathExpression(prompt);
  if (mathExpr) {
    const mathResult = solveMath(mathExpr);
    if (mathResult) {
      return { ...mathResult, provider: "local", node: 0 };
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

  // ── No providers configured → Krylo ────────────────────
  if (active.length === 0) {
    const kryloReply = generateKryloReply(prompt);
    return { ...kryloReply, provider: "krylo-fallback", node: 0 };
  }

  // ── Try each provider in order ──────────────────────────
  const errors = [];
  let nodeIndex = 1;

  for (const { id, provider, apiKey } of active) {
    try {
      const model = config[`${id.toUpperCase()}_MODEL`] || provider.defaultModel;
      let result;

      switch (provider.format) {
        case "openai":
          result = await callOpenAICompatible(
            prompt, systemPrompt, apiKey,
            provider.baseUrl, model, provider.name
          );
          break;

        case "custom-google":
          result = await callGoogleGemini(prompt, systemPrompt, apiKey, model);
          break;

        case "custom-anthropic":
          result = await callAnthropic(prompt, systemPrompt, apiKey, model);
          break;

        case "custom-cohere":
          result = await callCohere(prompt, systemPrompt, apiKey, model);
          break;

        default:
          // Treat unknown formats as OpenAI-compatible
          result = await callOpenAICompatible(
            prompt, systemPrompt, apiKey,
            provider.baseUrl, model, provider.name
          );
      }

      return { ...result, node: nodeIndex };
    } catch (err) {
      errors.push(`[Node ${nodeIndex} ${provider.name}] ${err.message}`);
      nodeIndex++;
    }
  }

  // ── Final Fallback: Krylo Companion ─────────────────────
  const kryloReply = generateKryloReply(prompt);
  return {
    ...kryloReply,
    provider: "krylo-fallback",
    node: 0,
    errors,
  };
}
