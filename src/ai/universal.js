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
export async function callOpenAICompatible(prompt, systemPrompt, apiKey, baseUrl, model, providerName, onToken, history = []) {
  const isStreaming = typeof onToken === "function";
  const formattedHistory = history.map(h => ({
    role: h.role === "assistant" ? "assistant" : "user",
    content: h.content
  }));
  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...formattedHistory,
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 4096,
    ...(isStreaming ? { stream: true } : {}),
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

  if (isStreaming && response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop(); // Keep the partial line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed === "data: [DONE]") continue;
        if (trimmed.startsWith("data: ")) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const content = data?.choices?.[0]?.delta?.content || "";
            if (content) {
              onToken(content);
              fullText += content;
            }
          } catch (e) {
            // Ignore partial line errors
          }
        }
      }
    }
    // Flush remaining buffer
    if (buffer && buffer.startsWith("data: ")) {
      try {
        const data = JSON.parse(buffer.slice(6));
        const content = data?.choices?.[0]?.delta?.content || "";
        if (content) {
          onToken(content);
          fullText += content;
        }
      } catch (e) {}
    }

    if (!fullText) {
      throw new Error(`${providerName} returned empty response`);
    }
    return { text: fullText, provider: providerName.toLowerCase(), model };
  } else {
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error(`${providerName} returned empty response`);
    }

    return { text, provider: providerName.toLowerCase(), model };
  }
}

/**
 * Calls the Google Gemini API (non-OpenAI format).
 * @param {string} prompt - User message
 * @param {string} systemPrompt - System prompt
 * @param {string} apiKey - Google API key
 * @param {string} model - Model name
 * @returns {Promise<{ text: string, provider: string, model: string }>}
 */
export async function callGoogleGemini(prompt, systemPrompt, apiKey, model = "gemini-2.5-flash", onToken, history = []) {
  const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
  const isStreaming = typeof onToken === "function";
  let currentHistory = [...history];

  if (isStreaming) {
    let fullText = "";
    let currentPrompt = prompt;
    let continuations = 0;
    const MAX = 3;

    while (continuations <= MAX) {
      const url = `${BASE}/${model}:streamGenerateContent?key=${apiKey}`;
      const formattedHistory = currentHistory.map(h => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }]
      }));
      const body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          ...formattedHistory,
          { role: "user", parts: [{ text: currentPrompt }] }
        ],
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

      let streamedTextInThisTurn = "";

      if (!response.body || typeof response.body.getReader !== "function") {
        // Fallback to non-streaming if response body is not streamable (e.g. in unit tests)
        const data = await response.json();
        let chunkText = "";
        let finishReason = "";
        if (Array.isArray(data)) {
          for (const chunk of data) {
            const partText = chunk.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") || "";
            chunkText += partText;
            finishReason = chunk.candidates?.[0]?.finishReason || finishReason;
          }
        } else {
          chunkText = data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") || "";
          finishReason = data.candidates?.[0]?.finishReason || finishReason;
        }

        if (chunkText) {
          onToken(chunkText);
          fullText += chunkText;
          streamedTextInThisTurn += chunkText;
        }

        if (finishReason === "MAX_TOKENS" && continuations < MAX) {
          currentHistory.push({ role: "user", content: currentPrompt });
          currentHistory.push({ role: "assistant", content: streamedTextInThisTurn });
          continuations++;
          currentPrompt = "Continue your previous response from exactly where you left off.";
        } else {
          break;
        }
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finishReason = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let braceCount = 0;
          let jsonStart = -1;
          let inString = false;
          let escape = false;

          for (let i = 0; i < buffer.length; i++) {
            const char = buffer[i];
            if (inString) {
              if (escape) {
                escape = false;
              } else if (char === "\\") {
                escape = true;
              } else if (char === '"') {
                inString = false;
              }
            } else {
              if (char === '"') {
                inString = true;
              } else if (char === "{") {
                if (braceCount === 0) {
                  jsonStart = i;
                }
                braceCount++;
              } else if (char === "}") {
                braceCount--;
                if (braceCount === 0 && jsonStart !== -1) {
                  const jsonStr = buffer.slice(jsonStart, i + 1);
                  try {
                    const obj = JSON.parse(jsonStr);
                    const text = obj.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") || "";
                    finishReason = obj.candidates?.[0]?.finishReason || finishReason;
                    if (text) {
                      onToken(text);
                      fullText += text;
                      streamedTextInThisTurn += text;
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                  buffer = buffer.slice(i + 1);
                  i = -1;
                  jsonStart = -1;
                }
              }
            }
          }
        }

        if (finishReason === "MAX_TOKENS" && continuations < MAX) {
          currentHistory.push({ role: "user", content: currentPrompt });
          currentHistory.push({ role: "assistant", content: streamedTextInThisTurn });
          continuations++;
          currentPrompt = "Continue your previous response from exactly where you left off.";
        } else {
          break;
        }
      }
    }

    if (!fullText.trim()) throw new Error("Gemini returned empty response");
    return { text: fullText, provider: "google", model };
  } else {
    let fullText = "";
    let currentPrompt = prompt;
    let continuations = 0;
    const MAX = 3;

    while (continuations <= MAX) {
      const url = `${BASE}/${model}:generateContent?key=${apiKey}`;
      const formattedHistory = currentHistory.map(h => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }]
      }));
      const body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          ...formattedHistory,
          { role: "user", parts: [{ text: currentPrompt }] }
        ],
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
        currentHistory.push({ role: "user", content: currentPrompt });
        currentHistory.push({ role: "assistant", content: chunkText });
        continuations++;
        currentPrompt = "Continue your previous response from exactly where you left off.";
      } else {
        break;
      }
    }

    if (!fullText.trim()) throw new Error("Gemini returned empty response");
    return { text: fullText, provider: "google", model };
  }
}

/**
 * Calls the Anthropic Claude API.
 * @param {string} prompt - User message
 * @param {string} systemPrompt - System prompt
 * @param {string} apiKey - Anthropic API key
 * @param {string} model - Model name
 * @returns {Promise<{ text: string, provider: string, model: string }>}
 */
export async function callAnthropic(prompt, systemPrompt, apiKey, model = "claude-sonnet-4-20250514", onToken, history = []) {
  const url = "https://api.anthropic.com/v1/messages";
  const isStreaming = typeof onToken === "function";
  const formattedHistory = history.map(h => ({
    role: h.role === "assistant" ? "assistant" : "user",
    content: h.content
  }));
  const body = {
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      ...formattedHistory,
      { role: "user", content: prompt }
    ],
    ...(isStreaming ? { stream: true } : {}),
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

  if (isStreaming && response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("data: ")) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === "content_block_delta" && data.delta?.text) {
              onToken(data.delta.text);
              fullText += data.delta.text;
            }
          } catch (e) {
            // Ignore partial JSON
          }
        }
      }
    }
    // Flush remaining
    if (buffer && buffer.startsWith("data: ")) {
      try {
        const data = JSON.parse(buffer.slice(6));
        if (data.type === "content_block_delta" && data.delta?.text) {
          onToken(data.delta.text);
          fullText += data.delta.text;
        }
      } catch (e) {}
    }

    if (!fullText) throw new Error("Anthropic returned empty response");
    return { text: fullText, provider: "anthropic", model };
  } else {
    const data = await response.json();
    const text = data?.content?.[0]?.text;

    if (!text) throw new Error("Anthropic returned empty response");
    return { text, provider: "anthropic", model };
  }
}

/**
 * Calls the Cohere API (v2 chat format).
 * @param {string} prompt - User message
 * @param {string} systemPrompt - System prompt
 * @param {string} apiKey - Cohere API key
 * @param {string} model - Model name
 * @returns {Promise<{ text: string, provider: string, model: string }>}
 */
export async function callCohere(prompt, systemPrompt, apiKey, model = "command-r-plus", onToken, history = []) {
  const url = "https://api.cohere.com/v2/chat";
  const isStreaming = typeof onToken === "function";
  const formattedHistory = history.map(h => ({
    role: h.role === "assistant" ? "assistant" : "user",
    content: h.content
  }));
  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...formattedHistory,
      { role: "user", content: prompt },
    ],
    ...(isStreaming ? { stream: true } : {}),
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

  if (isStreaming && response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("data: ")) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const content = data?.delta?.message?.content?.text || "";
            if (content) {
              onToken(content);
              fullText += content;
            }
          } catch (e) {
            // Ignore partial JSON
          }
        }
      }
    }
    // Flush remaining
    if (buffer && buffer.startsWith("data: ")) {
      try {
        const data = JSON.parse(buffer.slice(6));
        const content = data?.delta?.message?.content?.text || "";
        if (content) {
          onToken(content);
          fullText += content;
        }
      } catch (e) {}
    }

    if (!fullText) throw new Error("Cohere returned empty response");
    return { text: fullText, provider: "cohere", model };
  } else {
    const data = await response.json();
    const text = data?.message?.content?.[0]?.text;

    if (!text) throw new Error("Cohere returned empty response");
    return { text, provider: "cohere", model };
  }
}
