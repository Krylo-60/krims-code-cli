// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Google Gemini API Provider
// ═══════════════════════════════════════════════════════════

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_CONTINUATIONS = 3;

/**
 * Sends a prompt to the Google Gemini API.
 * Handles continuation if finishReason is MAX_TOKENS.
 * @param {string} prompt - The user message
 * @param {string} systemPrompt - System prompt for the mode
 * @param {string} apiKey - Google API key
 * @param {string} [model='gemini-2.5-flash'] - Model name
 * @returns {Promise<{ text: string, provider: string, model: string }>}
 */
export async function callGemini(prompt, systemPrompt, apiKey, model = "gemini-2.5-flash") {
  let fullText = "";
  let currentPrompt = prompt;
  let continuations = 0;

  while (continuations <= MAX_CONTINUATIONS) {
    const url = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;

    const body = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: currentPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `Gemini API error (${response.status}): ${response.statusText}. ${errorBody}`
      );
    }

    const data = await response.json();

    // Check for blocked content
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Content blocked: ${data.promptFeedback.blockReason}`);
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error("Gemini API returned no candidates");
    }

    const chunkText = candidate.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join("") || "";

    fullText += chunkText;

    // Check if the response was cut short
    if (candidate.finishReason === "MAX_TOKENS" && continuations < MAX_CONTINUATIONS) {
      continuations++;
      currentPrompt = "Continue your previous response from exactly where you left off.";
    } else {
      break;
    }
  }

  if (!fullText.trim()) {
    throw new Error("Gemini API returned empty response");
  }

  return { text: fullText, provider: "google", model };
}
