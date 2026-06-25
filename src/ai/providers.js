// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Universal Provider Registry
// Supports ANY OpenAI-compatible API + custom providers
// ═══════════════════════════════════════════════════════════

/**
 * Registry of all supported AI providers.
 * Each provider defines its API format, base URL, default model, and pricing tier.
 *
 * Providers with `format: "openai"` use the standard /v1/chat/completions endpoint.
 * Providers with `format: "custom"` have their own handler in dedicated files.
 */
export const PROVIDERS = {
  // ── Free Tier Providers ─────────────────────────────────
  groq: {
    name: "Groq",
    key: "GROQ_API_KEY",
    format: "openai",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"],
    tier: "free",
    description: "Ultra-fast inference on Llama, Mixtral, Gemma (generous free tier)",
  },
  together: {
    name: "Together AI",
    key: "TOGETHER_API_KEY",
    format: "openai",
    baseUrl: "https://api.together.xyz/v1/chat/completions",
    defaultModel: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    models: ["meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", "mistralai/Mixtral-8x7B-Instruct-v0.1", "Qwen/Qwen2.5-72B-Instruct-Turbo"],
    tier: "free",
    description: "Open-source models with free credits on signup",
  },
  cerebras: {
    name: "Cerebras",
    key: "CEREBRAS_API_KEY",
    format: "openai",
    baseUrl: "https://api.cerebras.ai/v1/chat/completions",
    defaultModel: "llama-3.3-70b",
    models: ["llama-3.3-70b", "llama-3.1-8b"],
    tier: "free",
    description: "Fastest inference engine — free tier available",
  },

  // ── OpenAI-Compatible Providers ─────────────────────────
  openai: {
    name: "OpenAI",
    key: "OPENAI_API_KEY",
    format: "openai",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1-mini", "o3-mini"],
    tier: "paid",
    description: "GPT-4o, GPT-4, o1 reasoning models",
  },
  mistral: {
    name: "Mistral AI",
    key: "MISTRAL_API_KEY",
    format: "openai",
    baseUrl: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-large-latest",
    models: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "open-mistral-nemo"],
    tier: "paid",
    description: "Mistral Large, Medium, and open-weight models",
  },
  fireworks: {
    name: "Fireworks AI",
    key: "FIREWORKS_API_KEY",
    format: "openai",
    baseUrl: "https://api.fireworks.ai/inference/v1/chat/completions",
    defaultModel: "accounts/fireworks/models/llama-v3p1-70b-instruct",
    models: ["accounts/fireworks/models/llama-v3p1-70b-instruct", "accounts/fireworks/models/mixtral-8x7b-instruct"],
    tier: "free",
    description: "Fast open-source model hosting with free tier",
  },
  openrouter: {
    name: "OpenRouter",
    key: "OPENROUTER_API_KEY",
    format: "openai",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "meta-llama/llama-3.1-70b-instruct:free",
    models: ["meta-llama/llama-3.1-70b-instruct:free", "google/gemini-2.5-flash-preview:free", "mistralai/mistral-7b-instruct:free", "anthropic/claude-sonnet-4", "openai/gpt-4o"],
    tier: "free+paid",
    description: "Gateway to 200+ models — many free options available",
  },
  deepseek: {
    name: "DeepSeek",
    key: "DEEPSEEK_API_KEY",
    format: "openai",
    baseUrl: "https://api.deepseek.com/v1/chat/completions",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    tier: "paid",
    description: "DeepSeek-V3 and R1 reasoning model",
  },
  perplexity: {
    name: "Perplexity",
    key: "PERPLEXITY_API_KEY",
    format: "openai",
    baseUrl: "https://api.perplexity.ai/chat/completions",
    defaultModel: "sonar",
    models: ["sonar", "sonar-pro", "sonar-reasoning"],
    tier: "paid",
    description: "Search-augmented AI with real-time web access",
  },

  // ── Custom Format Providers ─────────────────────────────
  xai: {
    name: "xAI Grok",
    key: "XAI_API_KEY",
    format: "openai",
    baseUrl: "https://api.x.ai/v1/chat/completions",
    defaultModel: "grok-2",
    models: ["grok-2", "grok-2-mini"],
    tier: "paid",
    description: "Grok-2 by xAI — witty, uncensored",
  },
  google: {
    name: "Google Gemini",
    key: "GOOGLE_API_KEY",
    format: "custom-google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-pro"],
    tier: "free+paid",
    description: "Gemini 2.5 Flash/Pro — free tier with generous limits",
  },
  anthropic: {
    name: "Anthropic Claude",
    key: "ANTHROPIC_API_KEY",
    format: "custom-anthropic",
    baseUrl: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-sonnet-4-20250514",
    models: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"],
    tier: "paid",
    description: "Claude Sonnet 4, Haiku — premium reasoning",
  },
  cohere: {
    name: "Cohere",
    key: "COHERE_API_KEY",
    format: "custom-cohere",
    baseUrl: "https://api.cohere.com/v2/chat",
    defaultModel: "command-r-plus",
    models: ["command-r-plus", "command-r", "command-light"],
    tier: "free+paid",
    description: "Command R+ — free tier for developers",
  },
};

/**
 * Gets a flat list of all provider keys that can be configured.
 * @returns {string[]}
 */
export function getAllConfigKeys() {
  const keys = new Set();
  for (const p of Object.values(PROVIDERS)) {
    keys.add(p.key);
  }
  // Also include multi-key support for Google
  keys.add("GOOGLE_API_KEYS");
  return [...keys];
}

/**
 * Gets a provider by its config key name (e.g., "OPENAI_API_KEY" → openai provider).
 * @param {string} configKey
 * @returns {object|null}
 */
export function getProviderByKey(configKey) {
  for (const [id, p] of Object.entries(PROVIDERS)) {
    if (p.key === configKey) return { id, ...p };
  }
  return null;
}

/**
 * Gets all providers that have a valid key in the given config.
 * @param {object} config - Config object with API keys
 * @returns {Array<{ id: string, provider: object, apiKey: string }>}
 */
export function getActiveProviders(config) {
  const active = [];
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    const apiKey = config[provider.key];
    if (apiKey) {
      active.push({ id, provider, apiKey });
    }
  }
  return active;
}

/**
 * Groups providers by pricing tier for display.
 * @returns {{ free: object[], paid: object[], mixed: object[] }}
 */
export function getProvidersByTier() {
  const result = { free: [], "free+paid": [], paid: [] };
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    result[provider.tier]?.push({ id, ...provider });
  }
  return result;
}
