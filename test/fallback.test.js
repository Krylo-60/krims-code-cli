import { test } from "node:test";
import assert from "node:assert";
import {
  detectMathExpression,
  solveMath,
  generateKryloReply,
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

  await t.test("generateKryloReply responds to help and shortcut keywords", () => {
    const reply = generateKryloReply("I need help with commands");
    assert.strictEqual(reply.type, "krylo-local");
    assert.ok(reply.text.includes("[SYSTEM DECK CHEAT SHEET]"));
    assert.ok(reply.text.includes("Ctrl + K"));
  });

  await t.test("generateKryloReply responds to status and diagnostic keywords", () => {
    const reply = generateKryloReply("What is the CPU status?");
    assert.strictEqual(reply.type, "krylo-local");
    assert.ok(reply.text.includes("[LIVE DIAGNOSTIC READOUT]"));
    assert.ok(reply.text.includes("Failover Mesh"));
  });

  await t.test("generateKryloReply responds to matrix/rain/color keywords", () => {
    const reply = generateKryloReply("change matrix color");
    assert.strictEqual(reply.type, "krylo-local");
    assert.ok(reply.text.includes("[NEURAL GRIDS MODULATION]"));
    assert.ok(reply.text.includes("Classic Green"));
  });

  await t.test("generateKryloReply responds to who/name/creator keywords", () => {
    const reply = generateKryloReply("who is your creator?");
    assert.strictEqual(reply.type, "krylo-local");
    assert.ok(reply.text.includes("[HOLOGRAPHIC COMPANION PROTOCOL]"));
    assert.ok(reply.text.includes("Krishiv PB"));
  });

  await t.test("generateKryloReply falls back to random terminal responses", () => {
    const reply = generateKryloReply("Unrelated query");
    assert.strictEqual(reply.type, "krylo-local");
    assert.ok(reply.text.includes("[KRYLO TERMINAL RESPONSE]"));
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
