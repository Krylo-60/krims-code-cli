import os from "node:os";
import { join } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert";

// Redirect homedir before importing config.js to point to a temporary test folder
const tempHome = join(process.cwd(), "temp-test-home");
process.env.USERPROFILE = tempHome;
process.env.HOME = tempHome;

// Dynamically import config.js so it gets the redirected homedir
const {
  getConfigPath,
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  deleteConfigValue,
  resetConfig,
  listConfig,
  getAIConfig,
  configExists,
  isValidConfigKey,
  loadHistory,
  saveHistory,
  clearHistory,
  listSessions,
  switchSession,
  startNewSession,
} = await import("../src/config.js");

const { getAllConfigKeys } = await import("../src/ai/providers.js");

test("Configuration Loading Suite", async (t) => {
  let originalEnv = {};
  const configKeys = getAllConfigKeys();

  before(async () => {
    await mkdir(tempHome, { recursive: true });
    // Backup relevant env vars
    for (const key of configKeys) {
      if (key in process.env) {
        originalEnv[key] = process.env[key];
      }
    }
  });

  after(async () => {
    await rm(tempHome, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await resetConfig();
    // Clear config env vars
    for (const key of configKeys) {
      delete process.env[key];
    }
    delete process.env.CUSTOM_TEST_API_KEY;
  });

  afterEach(async () => {
    await resetConfig();
    // Restore original env vars
    for (const key of configKeys) {
      if (key in originalEnv) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  await t.test("getConfigPath should return path inside temporary home", () => {
    const path = getConfigPath();
    assert.ok(path.startsWith(tempHome));
    assert.ok(path.endsWith(join(".aether", "config.json")));
  });

  await t.test("loadConfig should return empty object if file does not exist", async () => {
    const config = await loadConfig();
    assert.deepStrictEqual(config, {});
  });

  await t.test("saveConfig and loadConfig should save and load config file", async () => {
    const testConfig = { GROQ_API_KEY: "test-groq-key", OPENAI_MODEL: "gpt-4" };
    await saveConfig(testConfig);
    assert.strictEqual(await configExists(), true);

    const loaded = await loadConfig();
    assert.deepStrictEqual(loaded, testConfig);
  });

  await t.test("getConfigValue and setConfigValue read and write specific keys", async () => {
    await setConfigValue("TOGETHER_API_KEY", "together-val");
    const val = await getConfigValue("TOGETHER_API_KEY");
    assert.strictEqual(val, "together-val");

    await deleteConfigValue("TOGETHER_API_KEY");
    const deletedVal = await getConfigValue("TOGETHER_API_KEY");
    assert.strictEqual(deletedVal, undefined);
  });

  await t.test("listConfig should mask sensitive keys", async () => {
    await saveConfig({
      GROQ_API_KEY: "supersecretgroqkey",
      OPENAI_MODEL: "gpt-4o",
      OTHER_PROP: "not-sensitive-but-short",
      SHORT_SECRET: "123", // too short to mask (<= 8 chars)
    });

    const masked = await listConfig();
    assert.strictEqual(masked.OPENAI_MODEL, "gpt-4o");
    assert.strictEqual(masked.OTHER_PROP, "not-sensitive-but-short");
    assert.strictEqual(masked.SHORT_SECRET, "123");
    // GROQ_API_KEY contains "KEY", so it is sensitive. It has length 18 (> 8).
    // It should be masked: first 6 chars + "•••" + last 3 chars
    // "supers" + "•••" + "key" = "supers•••key"
    assert.strictEqual(masked.GROQ_API_KEY, "supers•••key");
  });

  await t.test("getAIConfig Priority: config file overrides process.env", async () => {
    // 1. Set environment variables
    process.env.GROQ_API_KEY = "env-groq-key";
    process.env.OPENAI_API_KEY = "env-openai-key";

    // 2. Set config file value for GROQ_API_KEY (should override env)
    // but leave OPENAI_API_KEY empty in config (should fall back to env)
    await saveConfig({
      GROQ_API_KEY: "file-groq-key",
    });

    const aiConfig = await getAIConfig();
    assert.strictEqual(aiConfig.GROQ_API_KEY, "file-groq-key"); // overrides
    assert.strictEqual(aiConfig.OPENAI_API_KEY, "env-openai-key"); // falls back
  });

  await t.test("getAIConfig supports fallback for any custom key ending with _API_KEY from process.env", async () => {
    process.env.CUSTOM_TEST_API_KEY = "custom-env-key";
    const aiConfig = await getAIConfig();
    assert.strictEqual(aiConfig.CUSTOM_TEST_API_KEY, "custom-env-key");
  });

  await t.test("isValidConfigKey checks key formats and known keys", () => {
    assert.strictEqual(isValidConfigKey("GROQ_API_KEY"), true);
    assert.strictEqual(isValidConfigKey("CUSTOM_API_KEY"), true);
    assert.strictEqual(isValidConfigKey("OPENAI_MODEL"), true);
    assert.strictEqual(isValidConfigKey("GOOGLE_API_KEYS"), true);
    assert.strictEqual(isValidConfigKey("THEME"), true);
    assert.strictEqual(isValidConfigKey("CUSTOM_COMMANDS"), true);
    assert.strictEqual(isValidConfigKey("INVALID_KEY_NAME"), false);
  });

  await t.test("loadHistory, saveHistory, and clearHistory write and delete log files", async () => {
    // 1. Initial state: history should be empty
    const initial = await loadHistory();
    assert.deepStrictEqual(initial, []);

    // 2. Save history
    const testHistory = [
      { role: "user", content: "ping" },
      { role: "assistant", content: "pong" }
    ];
    await saveHistory(testHistory);
    
    // 3. Load back
    const loaded = await loadHistory();
    assert.deepStrictEqual(loaded, testHistory);

    // 4. Clear history
    await clearHistory();
    const cleared = await loadHistory();
    assert.deepStrictEqual(cleared, []);
  });

  await t.test("listSessions, switchSession, and startNewSession handle multi-session histories", async () => {
    // 1. Start new session
    const file1 = startNewSession();
    await saveHistory([{ role: "user", content: "session 1" }], "research");

    // 2. Start another new session
    const file2 = startNewSession();
    await saveHistory([{ role: "user", content: "session 2" }], "architect");

    // 3. List sessions
    const sessions = listSessions();
    assert.ok(sessions.length >= 2);
    // The most recent session (file2) should be first
    assert.strictEqual(sessions[0].file, file2);
    assert.strictEqual(sessions[0].mode, "architect");
    assert.strictEqual(sessions[1].file, file1);
    assert.strictEqual(sessions[1].mode, "research");

    // 4. Switch session back to file1
    switchSession(file1);
    const loaded = await loadHistory();
    assert.strictEqual(loaded[0].content, "session 1");
  });

  await t.test("getAIConfig supports and loads CUSTOM_COMMANDS correctly", async () => {
    const testCommands = { "/explain": "Explain this:", "/refactor": "Refactor this:" };
    await saveConfig({
      CUSTOM_COMMANDS: testCommands
    });
    
    const config = await getAIConfig();
    assert.deepStrictEqual(config.CUSTOM_COMMANDS, testCommands);
  });
});
