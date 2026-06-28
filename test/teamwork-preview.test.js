import { test, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

import {
  parseAgentState,
  scanAgents,
  printAgentDetails,
  parseArgs,
} from "../src/commands/teamwork-preview.js";

const tempAgentsDir = path.join(process.cwd(), "temp-test-agents");

test("Teamwork Preview Command Suite", async (t) => {
  before(() => {
    if (!fs.existsSync(tempAgentsDir)) {
      fs.mkdirSync(tempAgentsDir, { recursive: true });
    }
  });

  after(() => {
    if (fs.existsSync(tempAgentsDir)) {
      fs.rmSync(tempAgentsDir, { recursive: true, force: true });
    }
  });

  await t.test("parseArgs should correctly parse arguments", () => {
    const opts1 = parseArgs(["-w"]);
    assert.strictEqual(opts1.watch, true);
    assert.strictEqual(opts1.agent, null);

    const opts2 = parseArgs(["--watch"]);
    assert.strictEqual(opts2.watch, true);
    assert.strictEqual(opts2.agent, null);

    const opts3 = parseArgs(["-a", "agent1"]);
    assert.strictEqual(opts3.watch, false);
    assert.strictEqual(opts3.agent, "agent1");

    const opts4 = parseArgs(["--agent", "agent2"]);
    assert.strictEqual(opts4.watch, false);
    assert.strictEqual(opts4.agent, "agent2");

    const opts5 = parseArgs(["--agent=agent3", "-w"]);
    assert.strictEqual(opts5.watch, true);
    assert.strictEqual(opts5.agent, "agent3");
  });

  await t.test("parseAgentState should determine correct status and heartbeat", () => {
    const agentName = "test_agent_1";
    const agentPath = path.join(tempAgentsDir, agentName);
    if (!fs.existsSync(agentPath)) fs.mkdirSync(agentPath, { recursive: true });

    const now = new Date("2026-06-28T12:00:00Z");

    // 1. Missing progress.md / BRIEFING.md
    let state = parseAgentState(agentName, agentPath, now);
    assert.strictEqual(state.status, "STALE");
    assert.strictEqual(state.heartbeat, "Never");
    assert.strictEqual(state.mission, "Unknown");

    // 2. Active agent (< 10 minutes)
    fs.writeFileSync(path.join(agentPath, "progress.md"), "Last visited: 2026-06-28T11:55:00Z\n");
    fs.writeFileSync(path.join(agentPath, "BRIEFING.md"), "## Mission\nBuild a cool CLI command\n");
    state = parseAgentState(agentName, agentPath, now);
    assert.strictEqual(state.status, "ACTIVE");
    assert.strictEqual(state.heartbeat, "5m ago");
    assert.strictEqual(state.mission, "Build a cool CLI command");

    // 3. Stale agent (> 10 minutes)
    fs.writeFileSync(path.join(agentPath, "progress.md"), "Last visited: 2026-06-28T11:45:00Z\n");
    state = parseAgentState(agentName, agentPath, now);
    assert.strictEqual(state.status, "STALE");
    assert.strictEqual(state.heartbeat, "15m ago");

    // 4. Completed agent (has handoff.md)
    fs.writeFileSync(path.join(agentPath, "handoff.md"), "Handoff details");
    state = parseAgentState(agentName, agentPath, now);
    assert.strictEqual(state.status, "COMPLETED");

    // Cleanup files in agent folder
    fs.rmSync(agentPath, { recursive: true, force: true });
  });

  await t.test("parseAgentState should fall back to Milestone/Focus in BRIEFING.md", () => {
    const agentName = "test_agent_2";
    const agentPath = path.join(tempAgentsDir, agentName);
    if (!fs.existsSync(agentPath)) fs.mkdirSync(agentPath, { recursive: true });

    // Try milestone
    fs.writeFileSync(
      path.join(agentPath, "BRIEFING.md"),
      "## Mission\n[placeholder]\n- Milestone: Milestone 4: Setup"
    );
    let state = parseAgentState(agentName, agentPath);
    assert.strictEqual(state.mission, "Milestone 4: Setup");

    // Try focus
    fs.writeFileSync(
      path.join(agentPath, "BRIEFING.md"),
      "## Mission\n[TBD]\n- Focus: Fixing CLI tests"
    );
    state = parseAgentState(agentName, agentPath);
    assert.strictEqual(state.mission, "Fixing CLI tests");

    fs.rmSync(agentPath, { recursive: true, force: true });
  });

  await t.test("scanAgents should discover and scan all valid agent folders", () => {
    const agent1 = "agent_active";
    const agent2 = "agent_completed";
    const agent1Path = path.join(tempAgentsDir, agent1);
    const agent2Path = path.join(tempAgentsDir, agent2);

    fs.mkdirSync(agent1Path, { recursive: true });
    fs.mkdirSync(agent2Path, { recursive: true });

    // agent 1 files
    fs.writeFileSync(path.join(agent1Path, "progress.md"), "Last visited: 2026-06-28T12:00:00Z\n");
    fs.writeFileSync(path.join(agent1Path, "BRIEFING.md"), "## Mission\nActive Mission\n");

    // agent 2 files
    fs.writeFileSync(path.join(agent2Path, "progress.md"), "Last visited: 2026-06-28T11:00:00Z\n");
    fs.writeFileSync(path.join(agent2Path, "BRIEFING.md"), "## Mission\nCompleted Mission\n");
    fs.writeFileSync(path.join(agent2Path, "handoff.md"), "Done\n");

    // Add a non-agent folder to verify it is ignored
    const nonAgentPath = path.join(tempAgentsDir, "random_folder");
    fs.mkdirSync(nonAgentPath, { recursive: true });

    const now = new Date("2026-06-28T12:05:00Z");
    const agents = scanAgents(tempAgentsDir, now);

    assert.strictEqual(agents.length, 2);
    const active = agents.find(a => a.name === agent1);
    const completed = agents.find(a => a.name === agent2);

    assert.ok(active);
    assert.strictEqual(active.status, "ACTIVE");
    assert.strictEqual(active.heartbeat, "5m ago");
    assert.strictEqual(active.mission, "Active Mission");

    assert.ok(completed);
    assert.strictEqual(completed.status, "COMPLETED");
    assert.strictEqual(completed.mission, "Completed Mission");

    // Clean up
    fs.rmSync(agent1Path, { recursive: true, force: true });
    fs.rmSync(agent2Path, { recursive: true, force: true });
    fs.rmSync(nonAgentPath, { recursive: true, force: true });
  });

  await t.test("printAgentDetails should print plan and handoff files if they exist", () => {
    const agentName = "agent_details_test";
    const agentPath = path.join(tempAgentsDir, agentName);
    fs.mkdirSync(agentPath, { recursive: true });

    fs.writeFileSync(path.join(agentPath, "plan.md"), "My Plan");
    fs.writeFileSync(path.join(agentPath, "handoff.md"), "My Handoff");

    // Mock console.log
    const logs = [];
    const originalLog = console.log;
    console.log = (...msg) => {
      logs.push(msg.join(" "));
    };

    try {
      const res = printAgentDetails(agentName, tempAgentsDir);
      assert.strictEqual(res, true);
      const combined = logs.join("\n");
      assert.ok(combined.includes("My Plan"));
      assert.ok(combined.includes("My Handoff"));
    } finally {
      console.log = originalLog;
    }

    fs.rmSync(agentPath, { recursive: true, force: true });
  });

  await t.test("watch loop should run once under testOnce option", async () => {
    const commandPluginModule = await import("../src/commands/teamwork-preview.js");
    const teamworkPreview = commandPluginModule.default;

    let tickCalled = false;
    const options = {
      watch: true,
      testOnce: true,
      onTick() {
        tickCalled = true;
      }
    };

    // Mock process.cwd to return tempAgentsDir
    const originalCwd = process.cwd;
    process.cwd = () => tempAgentsDir;

    const originalLog = console.log;
    console.log = () => {};

    try {
      await teamworkPreview.executeCLI([], options);
      assert.strictEqual(tickCalled, true);
    } finally {
      process.cwd = originalCwd;
      console.log = originalLog;
    }
  });
});
