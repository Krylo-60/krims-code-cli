// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — xAI/Grok API Provider
// ═══════════════════════════════════════════════════════════

/**
 * Sends a prompt to the xAI (Grok) API.
 * @param {string} prompt - The user message
 * @param {string} systemPrompt - System prompt for the mode
 * @param {string} apiKey - xAI API key
 * @param {string} [model='grok-2'] - Model name
 * @returns {Promise<{ text: string, provider: string, model: string }>}
 */
export async function callXai(prompt, systemPrompt, apiKey, model = "grok-2") {
  const url = "https://api.x.ai/v1/chat/completions";

  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 4096,
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
    throw new Error(
      `xAI API error (${response.status}): ${response.statusText}. ${errorBody}`
    );
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("xAI API returned empty response");
  }

  return { text, provider: "xai", model };
}
