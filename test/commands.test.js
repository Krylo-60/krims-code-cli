import { test } from "node:test";
import assert from "node:assert";
import { registry } from "../src/commands/index.js";

test("Command Registry System Suite", async (t) => {
  await registry.load();

  await t.test("Registry should load all core commands", () => {
    const allCmds = registry.getAll();
    const names = allCmds.map(c => c.name);
    
    assert.ok(names.includes("status"));
    assert.ok(names.includes("commit"));
    assert.ok(names.includes("dashboard"));
    assert.ok(names.includes("theme"));
    assert.ok(names.includes("themes"));
  });

  await t.test("Registry should support retrieval by name (case-insensitive)", () => {
    const statusCmd = registry.get("status");
    assert.ok(statusCmd);
    assert.strictEqual(statusCmd.name, "status");

    const statusCmdUpper = registry.get("STATUS");
    assert.ok(statusCmdUpper);
    assert.strictEqual(statusCmdUpper.name, "status");
  });

  await t.test("Registry should support retrieval by alias", () => {
    const dashboardCmd = registry.get("telemetry");
    assert.ok(dashboardCmd);
    assert.strictEqual(dashboardCmd.name, "dashboard");
  });

  await t.test("Registry command modules must satisfy the unified command contract", () => {
    const allCmds = registry.getAll();
    for (const cmd of allCmds) {
      assert.strictEqual(typeof cmd.name, "string", `Command ${cmd.name} has invalid name type`);
      assert.strictEqual(typeof cmd.description, "string", `Command ${cmd.name} has invalid description type`);
      assert.ok(Array.isArray(cmd.aliases), `Command ${cmd.name} has invalid aliases type`);
      assert.ok(Array.isArray(cmd.options), `Command ${cmd.name} has invalid options type`);
      assert.strictEqual(typeof cmd.executeChat, "function", `Command ${cmd.name} is missing executeChat`);
      assert.strictEqual(typeof cmd.executeCLI, "function", `Command ${cmd.name} is missing executeCLI`);
    }
  });
});
