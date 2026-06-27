import { test, before, after } from "node:test";
import assert from "node:assert";
import { join } from "node:path";
import { mkdir, rm } from "node:fs/promises";

// Redirect homedir for testing
const tempHome = join(process.cwd(), "temp-test-home-telemetry");
process.env.USERPROFILE = tempHome;
process.env.HOME = tempHome;
process.env.NODE_ENV = "test";

const { recordLatency, getLatencyLogs, clearTelemetryLogs, getTelemetryData } = await import("../src/ai/telemetry.js");
const { startTelemetryServer } = await import("../src/telemetry-server.js");

test("Visual Telemetry and Dashboard Suite", async (t) => {
  before(async () => {
    await mkdir(tempHome, { recursive: true });
  });

  after(async () => {
    await rm(tempHome, { recursive: true, force: true });
  });

  await t.test("recordLatency saves metrics to memory and disk, getLatencyLogs returns them", () => {
    clearTelemetryLogs();
    
    assert.strictEqual(getLatencyLogs().length, 0);

    recordLatency("openai", "gpt-4o", 150, 20, 15, true);
    recordLatency("google", "gemini-1.5", 300, 30, 25, false);

    const logs = getLatencyLogs();
    assert.strictEqual(logs.length, 2);
    
    assert.strictEqual(logs[0].provider, "openai");
    assert.strictEqual(logs[0].model, "gpt-4o");
    assert.strictEqual(logs[0].latencyMs, 150);
    assert.strictEqual(logs[0].promptTokens, 20);
    assert.strictEqual(logs[0].completionTokens, 15);
    assert.strictEqual(logs[0].success, true);

    assert.strictEqual(logs[1].provider, "google");
    assert.strictEqual(logs[1].success, false);
  });

  await t.test("clearTelemetryLogs clears all saved logs", () => {
    assert.ok(getLatencyLogs().length > 0);
    clearTelemetryLogs();
    assert.strictEqual(getLatencyLogs().length, 0);
  });

  await t.test("getTelemetryData returns structured data for visual HUD", () => {
    clearTelemetryLogs();
    recordLatency("groq", "llama-3", 100, 10, 5, true);
    
    const data = getTelemetryData({ GROQ_API_KEY: "fake-key" });
    
    assert.ok(data.tokenStats);
    assert.ok(data.modelBreakdown);
    assert.strictEqual(data.latencyLogs.length, 1);
    assert.strictEqual(data.latencyLogs[0].provider, "groq");

    // Mesh structure verification
    assert.ok(Array.isArray(data.meshStructure));
    const groqItem = data.meshStructure.find(m => m.id === "groq");
    assert.ok(groqItem);
    assert.strictEqual(groqItem.configured, true);
  });

  await t.test("startTelemetryServer serves HTTP endpoints correctly", async () => {
    const { server, port } = await startTelemetryServer(5500);
    const baseUrl = `http://localhost:${port}`;

    try {
      // 1. Fetch dashboard HTML
      const htmlRes = await fetch(`${baseUrl}/`);
      assert.strictEqual(htmlRes.status, 200);
      const htmlText = await htmlRes.text();
      assert.ok(htmlText.includes("Telemetry HUD"));

      // 2. Fetch telemetry JSON API
      const apiRes = await fetch(`${baseUrl}/api/telemetry`);
      assert.strictEqual(apiRes.status, 200);
      const apiData = await apiRes.json();
      assert.ok(apiData.latencyLogs);
      assert.ok(apiData.meshStructure);

      // 3. POST clear logs API
      const clearRes = await fetch(`${baseUrl}/api/clear`, { method: "POST" });
      assert.strictEqual(clearRes.status, 200);
      const clearData = await clearRes.json();
      assert.strictEqual(clearData.success, true);
      assert.strictEqual(getLatencyLogs().length, 0);

      // 4. POST shutdown server API
      const shutdownRes = await fetch(`${baseUrl}/api/shutdown`, { method: "POST" });
      assert.strictEqual(shutdownRes.status, 200);
      const shutdownData = await shutdownRes.json();
      assert.strictEqual(shutdownData.success, true);
    } finally {
      server.close();
    }
  });
});
