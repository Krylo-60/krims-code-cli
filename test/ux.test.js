import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { separator, clearStreamedText, getActiveTheme, setTheme, getThemesList } from "../src/ui/theme.js";
import { createSpinner } from "../src/ui/spinner.js";
import { routePrompt } from "../src/ai/router.js";

const originalFetch = globalThis.fetch;

test("Cyberpunk UX and Streaming Suite", async (t) => {
  let fetchCalls = [];

  beforeEach(() => {
    fetchCalls = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test("createSpinner should return custom frames and 80ms interval", () => {
    const spinner = createSpinner("Loading");
    assert.strictEqual(spinner.color, "cyan");
    assert.deepEqual(spinner.spinner, {
      interval: 80,
      frames: ["▖", "▘", "▝", "▗"]
    });
  });

  await t.test("separator should adjust length dynamically based on terminal width", () => {
    const originalColumns = process.stdout.columns;
    
    // Mock columns
    Object.defineProperty(process.stdout, "columns", {
      value: 100,
      configurable: true,
    });

    const sep = separator("─");
    // Should be process.stdout.columns - 4 = 96
    assert.strictEqual(sep.length, separator("─", 96).length);

    // Reset columns definition
    if (originalColumns === undefined) {
      delete process.stdout.columns;
    } else {
      Object.defineProperty(process.stdout, "columns", {
        value: originalColumns,
        configurable: true,
      });
    }
  });

  await t.test("routePrompt calls callOpenAICompatible and streams tokens", async () => {
    globalThis.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      
      const encoder = new TextEncoder();
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        'data: {"choices":[{"delta":{"content":" Cyberpunk"}}]}\n',
        'data: {"choices":[{"delta":{"content":" World"}}]}\n',
        'data: [DONE]\n'
      ];

      const mockStream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        }
      });

      return {
        ok: true,
        body: mockStream,
        json: async () => ({
          choices: [{ message: { content: "Hello Cyberpunk World" } }],
        }),
      };
    };

    const config = {
      GROQ_API_KEY: "groq-stream-key",
    };

    let receivedTokens = [];
    const onToken = (token) => {
      receivedTokens.push(token);
    };

    const result = await routePrompt("Hello", "System prompt", config, onToken);

    assert.strictEqual(result.provider, "groq");
    assert.strictEqual(result.text, "Hello Cyberpunk World");
    assert.deepEqual(receivedTokens, ["Hello", " Cyberpunk", " World"]);
    assert.strictEqual(fetchCalls.length, 1);
    
    // Verify options body has stream: true
    const sentBody = JSON.parse(fetchCalls[0].options.body);
    assert.strictEqual(sentBody.stream, true);
  });

  await t.test("Theme switching functions manage state correctly", () => {
    // 1. Initial active theme should be cyberpunk
    assert.strictEqual(getActiveTheme(), "cyberpunk");

    // 2. Switch to matrix
    const success = setTheme("matrix");
    assert.strictEqual(success, true);
    assert.strictEqual(getActiveTheme(), "matrix");

    // 3. Switch to invalid theme should return false and not change theme
    const fail = setTheme("nonexistent-theme");
    assert.strictEqual(fail, false);
    assert.strictEqual(getActiveTheme(), "matrix");

    // 4. Get all themes list
    const list = getThemesList();
    assert.ok(list.includes("cyberpunk"));
    assert.ok(list.includes("matrix"));
    assert.ok(list.includes("synthwave"));
    assert.ok(list.includes("crimson"));

    // Reset back to cyberpunk
    setTheme("cyberpunk");
  });
});
