// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Real-time Token & Telemetry Tracker
// Tracks input/output token counts and session usage metrics.
// ═══════════════════════════════════════════════════════════

// Session token accumulator
let sessionTokens = {
  prompt: 0,
  completion: 0,
  total: 0,
  exchanges: 0,
};

// Model-by-model breakdown
const modelBreakdown = {};

/**
 * Heuristically estimates the token count of a string based on character length.
 * Standard rule of thumb: 1 token ≈ 4 characters.
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Returns a copy of the current session token stats.
 * @returns {{prompt: number, completion: number, total: number, exchanges: number}}
 */
export function getSessionTokenStats() {
  return { ...sessionTokens };
}

/**
 * Resets all accumulated session token statistics and breakdowns.
 */
export function resetSessionTokenStats() {
  sessionTokens = {
    prompt: 0,
    completion: 0,
    total: 0,
    exchanges: 0,
  };
  // Clear object properties safely without losing reference
  for (const key of Object.keys(modelBreakdown)) {
    delete modelBreakdown[key];
  }
}

/**
 * Records token usage for a query.
 * @param {string} model - The model name
 * @param {number} promptTokens - Input prompt tokens count
 * @param {number} completionTokens - Output completion tokens count
 * @returns {{promptTokens: number, completionTokens: number, totalTokens: number}}
 */
export function recordTokenUsage(model, promptTokens, completionTokens) {
  const modelName = model || "unknown-model";
  const totalTokens = promptTokens + completionTokens;

  // Update session totals
  sessionTokens.prompt += promptTokens;
  sessionTokens.completion += completionTokens;
  sessionTokens.total += totalTokens;
  sessionTokens.exchanges += 1;

  // Update model breakdown
  if (!modelBreakdown[modelName]) {
    modelBreakdown[modelName] = {
      prompt: 0,
      completion: 0,
      total: 0,
      exchanges: 0,
    };
  }
  modelBreakdown[modelName].prompt += promptTokens;
  modelBreakdown[modelName].completion += completionTokens;
  modelBreakdown[modelName].total += totalTokens;
  modelBreakdown[modelName].exchanges += 1;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

/**
 * Returns the model-by-model token usage breakdown.
 * @returns {object}
 */
export function getBreakdownByModel() {
  // Deep clone modelBreakdown
  const clone = {};
  for (const [key, value] of Object.entries(modelBreakdown)) {
    clone[key] = { ...value };
  }
  return clone;
}
