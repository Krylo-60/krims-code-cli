import os from "node:os";
import { join } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

// Redirect homedir before importing config and updater to point to a temporary test folder
const tempHome = join(process.cwd(), "temp-test-home-updater");
process.env.USERPROFILE = tempHome;
process.env.HOME = tempHome;

const { resetConfig, setConfigValue, getConfigValue } = await import("../src/config.js");
const { isNewerVersion, checkForUpdates, showReleaseHighlights } = await import("../src/updater.js");

const originalFetch = globalThis.fetch;

test("Auto-Updater & Highlights Suite", async (t) => {
  let fetchCalls = [];

  before(async () => {
    await mkdir(tempHome, { recursive: true });
  });

  after(async () => {
    await rm(tempHome, { recursive: true, force: true });
  });

  beforeEach(async () => {
    fetchCalls = [];
    await resetConfig();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await resetConfig();
  });

  await t.test("isNewerVersion compares semver versions correctly", () => {
    assert.strictEqual(isNewerVersion("1.1.9", "1.1.8"), true);
    assert.strictEqual(isNewerVersion("1.2.0", "1.1.9"), true);
    assert.strictEqual(isNewerVersion("2.0.0", "1.9.9"), true);
    assert.strictEqual(isNewerVersion("1.1.9", "1.1.9"), false);
    assert.strictEqual(isNewerVersion("1.1.8", "1.1.9"), false);
    assert.strictEqual(isNewerVersion("1.0.0", "2.0.0"), false);
  });

  await t.test("checkForUpdates respects 24h throttling", async () => {
    const now = Date.now();
    // Set last check to 1 hour ago
    await setConfigValue("LAST_UPDATE_CHECK", (now - 60 * 60 * 1000).toString());
    // Set last notified version to current version so highlights are not triggered
    await setConfigValue("LAST_NOTIFIED_VERSION", pkg.version);

    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return { ok: false };
    };

    await checkForUpdates();
    // Should NOT call fetch because it hasn't been 24 hours
    assert.strictEqual(fetchCalled, false);
  });

  await t.test("checkForUpdates triggers check if 24h passed", async () => {
    const now = Date.now();
    // Set last check to 25 hours ago
    await setConfigValue("LAST_UPDATE_CHECK", (now - 25 * 60 * 60 * 1000).toString());

    let fetchCalled = false;
    globalThis.fetch = async (url) => {
      fetchCalled = true;
      assert.ok(url.includes("registry.npmjs.org"));
      return {
        ok: true,
        json: async () => ({ version: "1.1.9" })
      };
    };

    await checkForUpdates();
    assert.strictEqual(fetchCalled, true);
    
    // Check that LAST_UPDATE_CHECK was updated to a recent timestamp
    const updatedCheck = parseInt(await getConfigValue("LAST_UPDATE_CHECK") || "0", 10);
    assert.ok(updatedCheck > now - 10000);
  });
});
