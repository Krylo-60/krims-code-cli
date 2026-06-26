import { test } from "node:test";
import assert from "node:assert";
import { resolve, join } from "node:path";
import {
  isSafeCommand,
  isInsideWorkspace,
  processAgentBlocks
} from "../src/agent.js";

test("Agent Autopilot Engine Suite", async (t) => {
  await t.test("isSafeCommand classifies inspection commands as safe", () => {
    assert.strictEqual(isSafeCommand("git status"), true);
    assert.strictEqual(isSafeCommand("git diff"), true);
    assert.strictEqual(isSafeCommand("ls"), true);
    assert.strictEqual(isSafeCommand("dir -a"), true);
    assert.strictEqual(isSafeCommand("npm test"), true);
    assert.strictEqual(isSafeCommand("node -v"), true);
  });

  await t.test("isSafeCommand classifies destructive/unsafe commands as unsafe", () => {
    assert.strictEqual(isSafeCommand("rm -rf src"), false);
    assert.strictEqual(isSafeCommand("del /f /q *"), false);
    assert.strictEqual(isSafeCommand("format c:"), false);
    assert.strictEqual(isSafeCommand("npm run dev"), false);
  });

  await t.test("isInsideWorkspace verifies if path is inside current workspace", () => {
    const ws = resolve(process.cwd());
    assert.strictEqual(isInsideWorkspace("src/config.js"), true);
    assert.strictEqual(isInsideWorkspace(join(ws, "package.json")), true);
    assert.strictEqual(isInsideWorkspace("../../somefile.txt"), false);
  });

  await t.test("processAgentBlocks extracts and processes tools sequentially", async () => {
    const aiOutput = `
I will read a file and run a command.
[READ_FILE: src/git.js]
And also run:
[RUN_COMMAND: node -v]
    `;

    const aiConfig = { AUTOPILOT: "safe" };
    // Mock readline interface
    const rl = {
      pause: () => {},
      resume: () => {},
      question: (query, cb) => cb("y")
    };

    const results = await processAgentBlocks(aiOutput, aiConfig, rl);
    assert.strictEqual(results.length, 2);
    
    // First tool result should be READ_FILE
    assert.strictEqual(results[0].tool, "READ_FILE");
    assert.strictEqual(results[0].arg, "src/git.js");
    
    // Second tool result should be RUN_COMMAND
    assert.strictEqual(results[1].tool, "RUN_COMMAND");
    assert.strictEqual(results[1].arg, "node -v");
    assert.strictEqual(results[1].success, true);
  });
});
