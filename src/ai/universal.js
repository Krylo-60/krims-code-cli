// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Universal API Caller
// Handles OpenAI-compatible, Google, Anthropic, and Cohere APIs
// ═══════════════════════════════════════════════════════════

/**
 * Calls any OpenAI-compatible API (OpenAI, Groq, Together, Mistral, xAI, etc.)
 * @param {string} prompt - User message
 * @param {string} systemPrompt - System prompt
 * @param {string} apiKey - API key
 * @param {string} baseUrl - Full endpoint URL
 * @param {string} model - Model identifier
 * @param {string} providerName - For error messages
 * @returns {Promise<{ text: string, provider: string, model: string }>}
 */
export async function callOpenAICompatible(prompt, systemPrompt, apiKey, baseUrl, model, providerName) {
  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // OpenRouter requires extra headers
  if (baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "https://github.com/Krylo-60/aether-ai-cli";
    headers["X-Title"] = "Aether AI CLI";
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`${providerName} API error (${response.status}): ${response.statusText}. ${errorBody}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(`${providerName} returned empty response`);
  }

  return { text, provider: providerName.toLowerCase(), model };
}

/**
 * Calls the Google Gemini API (non-OpenAI format).
 * @param {string} prompt - User message
 * @param {string} systemPrompt - System prompt
 * @param {string} apiKey - Google API key
 * @param {string} model - Model name
 * @returns {Promise<{ text: string, provider: string, model: string }>}
 */
export async function callGoogleGemini(prompt, systemPrompt, apiKey, model = "gemini-2.5-flash") {
  const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
  let fullText = "";
  let currentPrompt = prompt;
  let continuations = 0;
  const MAX = 3;

  while (continuations <= MAX) {
    const url = `${BASE}/${model}:generateContent?key=${apiKey}`;
    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: currentPrompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Gemini API error (${response.status}): ${response.statusText}. ${errorBody}`);
    }

    const data = await response.json();
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Content blocked: ${data.promptFeedback.blockReason}`);
    }

    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error("Gemini returned no candidates");

    const chunkText = candidate.content?.parts?.map((p) => p.text).filter(Boolean).join("") || "";
    fullText += chunkText;

    if (candidate.finishReason === "MAX_TOKENS" && continuations < MAX) {
      continuations++;
      currentPrompt = "Continue your previous response from exactly where you left off.";
    } else {
      break;
    }
  }

  if (!fullText.trim()) throw new Error("Gemini returned empty response");
  return { text: fullText, provider: "google", model };
}

/**
 * Calls the Anthropic Claude API.
 * @param {string} prompt - User message
 * @param {string} systemPrompt - System prompt
 * @param {string} apiKey - Anthropic API key
 * @param {string} model - Model name
 * @returns {Promise<{ text: string, provider: string, model: string }>}
 */
export async function callAnthropic(prompt, systemPrompt, apiKey, model = "claude-sonnet-4-20250514") {
  const url = "https://api.anthropic.com/v1/messages";
  const body = {
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Anthropic API error (${response.status}): ${response.statusText}. ${errorBody}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;

  if (!text) throw new Error("Anthropic returned empty response");
  return { text, provider: "anthropic", model };
}

/**
 * Calls the Cohere API (v2 chat format).
 * @param {string} prompt - User message
 * @param {string} systemPrompt - System prompt
 * @param {string} apiKey - Cohere API key
 * @param {string} model - Model name
 * @returns {Promise<{ text: string, provider: string, model: string }>}
 */
export async function callCohere(prompt, systemPrompt, apiKey, model = "command-r-plus") {
  const url = "https://api.cohere.com/v2/chat";
  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Cohere API error (${response.status}): ${response.statusText}. ${errorBody}`);
  }

  const data = await response.json();
  const text = data?.message?.content?.[0]?.text;

  if (!text) throw new Error("Cohere returned empty response");
  return { text, provider: "cohere", model };
}
