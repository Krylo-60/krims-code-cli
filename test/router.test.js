import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { routePrompt } from "../src/ai/router.js";

const originalFetch = globalThis.fetch;

test("Universal AI Router Suite", async (t) => {
  let fetchCalls = [];

  beforeEach(() => {
    fetchCalls = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test("routePrompt routes to local math solver when pure math expression", async () => {
    globalThis.fetch = async () => {
      throw new Error("Fetch should not be called for local math solver");
    };

    const result = await routePrompt("5 * 5", "You are a helpful assistant", {});
    assert.strictEqual(result.provider, "local");
    assert.strictEqual(result.node, 0);
    assert.strictEqual(result.type, "local-math");
    assert.ok(result.text.includes("Result: 25"));
  });

  await t.test("routePrompt routes to active providers in order of priority", async () => {
    globalThis.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      if (url.includes("api.groq.com")) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "Groq success response" } }],
          }),
        };
      }
      return { ok: false, status: 400 };
    };

    const config = {
      GROQ_API_KEY: "groq-ok-key",
      OPENAI_API_KEY: "openai-ok-key",
    };

    const result = await routePrompt("What is the capital of France?", "Sys prompt", config);
    
    assert.strictEqual(result.provider, "groq");
    assert.strictEqual(result.text, "Groq success response");
    assert.strictEqual(result.node, 1);

    // Verify only Groq was called, OpenAI was skipped since Groq succeeded
    assert.strictEqual(fetchCalls.length, 1);
    assert.ok(fetchCalls[0].url.includes("api.groq.com"));
  });

  await t.test("routePrompt falls back to next provider if priority provider fails", async () => {
    globalThis.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      if (url.includes("api.groq.com")) {
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: async () => "Groq overloaded",
        };
      }
      if (url.includes("api.openai.com")) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "OpenAI success response" } }],
          }),
        };
      }
      return { ok: false, status: 400 };
    };

    const config = {
      GROQ_API_KEY: "groq-fail-key",
      OPENAI_API_KEY: "openai-ok-key",
    };

    const result = await routePrompt("Explain quantum computing", "Sys prompt", config);
    
    assert.strictEqual(result.provider, "openai");
    assert.strictEqual(result.text, "OpenAI success response");
    // Node index increments for failed providers, so OpenAI should be node 2
    assert.strictEqual(result.node, 2);

    // Verify both were called in order
    assert.strictEqual(fetchCalls.length, 2);
    assert.ok(fetchCalls[0].url.includes("api.groq.com"));
    assert.ok(fetchCalls[1].url.includes("api.openai.com"));
  });

  await t.test("routePrompt handles Google extra key rotation and failover", async () => {
    globalThis.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      if (url.includes("key=key-fail")) {
        return {
          ok: false,
          status: 403,
          statusText: "Forbidden",
          text: async () => "Invalid Key",
        };
      }
      if (url.includes("key=key-success")) {
        return {
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: "Gemini success response" }] } }],
          }),
        };
      }
      return { ok: false, status: 400 };
    };

    const config = {
      GOOGLE_API_KEYS: "key-fail, key-success",
    };

    const result = await routePrompt("Tell me a joke", "Sys prompt", config);
    
    assert.strictEqual(result.provider, "google");
    assert.strictEqual(result.text, "Gemini success response");
    assert.strictEqual(result.node, 2);

    assert.strictEqual(fetchCalls.length, 2);
    assert.ok(fetchCalls[0].url.includes("key=key-fail"));
    assert.ok(fetchCalls[1].url.includes("key=key-success"));
  });

  await t.test("routePrompt falls back to Krylo companion when no providers are configured", async () => {
    globalThis.fetch = async () => {
      throw new Error("Fetch should not be called");
    };

    const result = await routePrompt("status", "Sys prompt", {});
    assert.strictEqual(result.provider, "krylo-fallback");
    assert.strictEqual(result.node, 0);
    assert.strictEqual(result.type, "krylo-local");
    assert.ok(result.text.includes("[LIVE DIAGNOSTIC READOUT]"));
  });

  await t.test("routePrompt falls back to Krylo companion when all providers fail", async () => {
    globalThis.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        ok: false,
        status: 500,
        statusText: "Service Unavailable",
        text: async () => "Server Down",
      };
    };

    const config = {
      GROQ_API_KEY: "groq-bad",
      OPENAI_API_KEY: "openai-bad",
    };

    const result = await routePrompt("Hello", "Sys prompt", config);
    
    assert.strictEqual(result.provider, "krylo-fallback");
    assert.strictEqual(result.node, 0);
    assert.ok(result.errors);
    assert.strictEqual(result.errors.length, 2);
    assert.ok(result.errors[0].includes("Node 1 Groq"));
    assert.ok(result.errors[1].includes("Node 2 OpenAI"));
  });

  await t.test("routePrompt forwards chat history to OpenAI and Google payloads correctly", async () => {
    const history = [
      { role: "user", content: "What is your name?" },
      { role: "assistant", content: "I am Aether." }
    ];

    // 1. Test Groq (OpenAI-compatible) receives history
    globalThis.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Groq reply" } }],
        }),
      };
    };

    await routePrompt("How are you?", "Sys prompt", { GROQ_API_KEY: "groq-key" }, null, history);
    assert.strictEqual(fetchCalls.length, 1);
    const groqBody = JSON.parse(fetchCalls[0].options.body);
    assert.deepStrictEqual(groqBody.messages, [
      { role: "system", content: "Sys prompt" },
      { role: "user", content: "What is your name?" },
      { role: "assistant", content: "I am Aether." },
      { role: "user", content: "How are you?" }
    ]);

    fetchCalls = [];

    // 2. Test Google Gemini receives history
    globalThis.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "Gemini reply" }] } }],
        }),
      };
    };

    await routePrompt("How are you?", "Sys prompt", { GOOGLE_API_KEYS: "google-key" }, null, history);
    assert.strictEqual(fetchCalls.length, 1);
    const googleBody = JSON.parse(fetchCalls[0].options.body);
    assert.deepStrictEqual(googleBody.contents, [
      { role: "user", parts: [{ text: "What is your name?" }] },
      { role: "model", parts: [{ text: "I am Aether." }] },
      { role: "user", parts: [{ text: "How are you?" }] }
    ]);
  });
});
