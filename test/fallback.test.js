import { test } from "node:test";
import assert from "node:assert";
import {
  detectMathExpression,
  solveMath,
  generateOfflineReply,
  runMainframeHack,
} from "../src/ai/fallback.js";

test("Offline Math Fallback & Krylo Suite", async (t) => {
  await t.test("detectMathExpression identifies valid mathematical expressions", () => {
    assert.strictEqual(detectMathExpression("2 + 2"), "2+2");
    assert.strictEqual(detectMathExpression("10 * (5 - 3)"), "10*(5-3)");
    assert.strictEqual(detectMathExpression("2 ^ 3"), "2^3");
    assert.strictEqual(detectMathExpression("5 % 2"), "5%2");
  });

  await t.test("detectMathExpression rejects non-math and invalid expressions", () => {
    assert.strictEqual(detectMathExpression("hello world"), null);
    assert.strictEqual(detectMathExpression("2 + 2 = 4"), null);
    assert.strictEqual(detectMathExpression("x + y"), null);
    assert.strictEqual(detectMathExpression("123"), null); // No operators
    assert.strictEqual(detectMathExpression("2 + a"), null);
  });

  await t.test("solveMath evaluates simple math expressions correctly", () => {
    const result = solveMath("2+2");
    assert.ok(result);
    assert.strictEqual(result.type, "local-math");
    assert.ok(result.text.includes("Expression: 2+2"));
    assert.ok(result.text.includes("Result: 4"));
  });

  await t.test("solveMath converts ^ to ** correctly for exponentiation", () => {
    const result = solveMath("2^3");
    assert.ok(result);
    assert.ok(result.text.includes("Result: 8"));
  });

  await t.test("solveMath handles floats and division", () => {
    const result = solveMath("5/2");
    assert.ok(result);
    assert.ok(result.text.includes("Result: 2.5"));
  });

  await t.test("solveMath returns null on syntax error or unsafe code", () => {
    assert.strictEqual(solveMath("2++2"), null);
    assert.strictEqual(solveMath("2/0"), null); // Division by zero -> Infinity (isFinite checks false)
    assert.strictEqual(solveMath(""), null);
    assert.strictEqual(solveMath("console.log(1)"), null);
  });

  await t.test("generateOfflineReply returns offline error formatting", () => {
    const reply = generateOfflineReply("any query");
    assert.strictEqual(reply.type, "offline-error");
    assert.ok(reply.text.includes("No active API keys configured"));

    const replyWithErrors = generateOfflineReply("any query", ["Timeout error", "Quota exceeded"]);
    assert.strictEqual(replyWithErrors.type, "offline-error");
    assert.ok(replyWithErrors.text.includes("All configured AI provider nodes failed to respond"));
    assert.ok(replyWithErrors.text.includes("Rate Limit / Quota Exceeded"));
    assert.ok(replyWithErrors.text.includes("Timeout error"));
    assert.ok(replyWithErrors.text.includes("Quota exceeded"));
  });

  await t.test("detectMathExpression and solveMath support trig, logs, square root and constants", () => {
    assert.strictEqual(detectMathExpression("sin(pi / 2)"), "sin(pi/2)");
    assert.strictEqual(detectMathExpression("sqrt(9) + abs(-5)"), "sqrt(9)+abs(-5)");
    
    const resTrig = solveMath("sin(pi/2)");
    assert.ok(resTrig);
    assert.ok(resTrig.text.includes("Result: 1"));

    const resComplex = solveMath("sqrt(9) + abs(-5)");
    assert.ok(resComplex);
    assert.ok(resComplex.text.includes("Result: 8"));
  });

  await t.test("runMainframeHack returns the game intro template", () => {
    const gameIntro = runMainframeHack();
    assert.strictEqual(gameIntro.type, "mainframe-game");
    assert.ok(gameIntro.text.includes("Objective: Bypass security"));
  });
});
