import { test } from "node:test";
import assert from "node:assert";
import {
  estimateTokens,
  getSessionTokenStats,
  resetSessionTokenStats,
  recordTokenUsage,
  getBreakdownByModel
} from "../src/ai/tokens.js";

test("Token Estimation & Usage Telemetry Suite", async (t) => {
  await t.test("estimateTokens uses standard character heuristics", () => {
    assert.strictEqual(estimateTokens(""), 0);
    assert.strictEqual(estimateTokens(null), 0);
    // 8 characters should be 2 tokens (8 / 4)
    assert.strictEqual(estimateTokens("12345678"), 2);
    // 9 characters should be 3 tokens (Math.ceil(9 / 4))
    assert.strictEqual(estimateTokens("123456789"), 3);
  });

  await t.test("recordTokenUsage updates session stats and breakdowns", () => {
    resetSessionTokenStats();

    // 1. Initial State
    let stats = getSessionTokenStats();
    assert.strictEqual(stats.prompt, 0);
    assert.strictEqual(stats.completion, 0);
    assert.strictEqual(stats.total, 0);
    assert.strictEqual(stats.exchanges, 0);

    // 2. Record first usage
    const result1 = recordTokenUsage("gpt-4o", 100, 50);
    assert.deepStrictEqual(result1, { promptTokens: 100, completionTokens: 50, totalTokens: 150 });

    stats = getSessionTokenStats();
    assert.strictEqual(stats.prompt, 100);
    assert.strictEqual(stats.completion, 50);
    assert.strictEqual(stats.total, 150);
    assert.strictEqual(stats.exchanges, 1);

    let breakdown = getBreakdownByModel();
    assert.ok(breakdown["gpt-4o"]);
    assert.strictEqual(breakdown["gpt-4o"].prompt, 100);
    assert.strictEqual(breakdown["gpt-4o"].completion, 50);
    assert.strictEqual(breakdown["gpt-4o"].total, 150);
    assert.strictEqual(breakdown["gpt-4o"].exchanges, 1);

    // 3. Record second usage for same model
    recordTokenUsage("gpt-4o", 200, 100);
    stats = getSessionTokenStats();
    assert.strictEqual(stats.prompt, 300);
    assert.strictEqual(stats.completion, 150);
    assert.strictEqual(stats.total, 450);
    assert.strictEqual(stats.exchanges, 2);

    breakdown = getBreakdownByModel();
    assert.strictEqual(breakdown["gpt-4o"].prompt, 300);
    assert.strictEqual(breakdown["gpt-4o"].completion, 150);
    assert.strictEqual(breakdown["gpt-4o"].total, 450);
    assert.strictEqual(breakdown["gpt-4o"].exchanges, 2);

    // 4. Record usage for another model
    recordTokenUsage("gemini-2.5-flash", 50, 25);
    stats = getSessionTokenStats();
    assert.strictEqual(stats.prompt, 350);
    assert.strictEqual(stats.completion, 175);
    assert.strictEqual(stats.total, 525);
    assert.strictEqual(stats.exchanges, 3);

    breakdown = getBreakdownByModel();
    assert.ok(breakdown["gemini-2.5-flash"]);
    assert.strictEqual(breakdown["gemini-2.5-flash"].prompt, 50);
    assert.strictEqual(breakdown["gemini-2.5-flash"].completion, 25);
    assert.strictEqual(breakdown["gemini-2.5-flash"].total, 75);
    assert.strictEqual(breakdown["gemini-2.5-flash"].exchanges, 1);
  });

  await t.test("resetSessionTokenStats clears stats and breakdowns", () => {
    resetSessionTokenStats();
    const stats = getSessionTokenStats();
    assert.strictEqual(stats.prompt, 0);
    assert.strictEqual(stats.completion, 0);
    assert.strictEqual(stats.total, 0);
    assert.strictEqual(stats.exchanges, 0);

    const breakdown = getBreakdownByModel();
    assert.strictEqual(Object.keys(breakdown).length, 0);
  });
});
