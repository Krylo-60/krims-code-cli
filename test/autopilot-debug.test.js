import { test, before, after } from "node:test";
import assert from "node:assert";
import { join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const tempHome = join(process.cwd(), "temp-test-home-autopilot");
process.env.USERPROFILE = tempHome;
process.env.HOME = tempHome;
process.env.NODE_ENV = "test";

const originalFetch = globalThis.fetch;
const { handleAutopilotDebug, handleGoalCommand } = await import("../src/chat.js");

test("Autopilot Self-Correcting Debug Suite", async (t) => {
  before(() => {
    mkdirSync(tempHome, { recursive: true });
  });

  after(() => {
    rmSync(tempHome, { recursive: true, force: true });
    globalThis.fetch = originalFetch;
  });

  await t.test("handleAutopilotDebug stops immediately if test command passes", async () => {
    const ctx = {
      aiConfig: { DIAGNOSE_CMD: "node -e \"process.exit(0)\"" },
      rl: { pause: () => {}, resume: () => {} },
      history: [],
      currentMode: { name: "titan" }
    };
    
    let logged = [];
    const origLog = console.log;
    console.log = (m) => logged.push(m);
    
    try {
      await handleAutopilotDebug("node -e \"process.exit(0)\"", ctx);
      
      const hasSuccess = logged.some(l => l && l.includes("passed successfully"));
      assert.ok(hasSuccess);
    } finally {
      console.log = origLog;
    }
  });

  await t.test("handleAutopilotDebug enters loop, applies write fix, and passes", async () => {
    // We will run a command that checks for the existence of a file we write.
    // If the file exists, it passes; if not, it fails.
    const checkFile = join(tempHome, "fix.txt");
    const testCmd = `node -e "const fs = require('fs'); if (fs.existsSync('${checkFile.replace(/\\/g, '\\\\')}')) { process.exit(0); } else { process.exit(1); }"`;

    // Mock fetch to simulate AI response writing the file
    globalThis.fetch = async (url, options) => {
      // Simulate writing fix.txt using write block
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `Let me fix this by writing the missing file.\n[WRITE_FILE: ${checkFile}]\nfixed content\n[END_WRITE]`
            }
          }]
        })
      };
    };

    const ctx = {
      aiConfig: {
        GROQ_API_KEY: "mock-key",
        AUTOPILOT: "machine"
      },
      rl: { pause: () => {}, resume: () => {} },
      history: [],
      currentMode: { name: "titan" }
    };

    let logged = [];
    const origLog = console.log;
    console.log = (m) => logged.push(m);

    try {
      await handleAutopilotDebug(testCmd, ctx);
      
      // The test command should succeed on the second attempt
      const hasCorrectedSuccess = logged.some(l => l && l.includes("Diagnostics passed successfully"));
      assert.ok(hasCorrectedSuccess);
    } finally {
      console.log = origLog;
    }
  });

  await t.test("handleGoalCommand runs iterations, executes tools, and stops when [GOAL_ACHIEVED] is matched", async () => {
    const goalFile = join(tempHome, "goal.txt");
    
    let fetchCallCount = 0;
    globalThis.fetch = async (url, options) => {
      fetchCallCount++;
      if (fetchCallCount === 1) {
        // Write the file
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: `I will solve this goal by writing to ${goalFile}.\n[WRITE_FILE: ${goalFile}]\ngoal completed!\n[END_WRITE]`
              }
            }]
          })
        };
      } else {
        // Report achieved
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: `Everything is done.\n[GOAL_ACHIEVED]`
              }
            }]
          })
        };
      }
    };

    const ctx = {
      aiConfig: {
        GROQ_API_KEY: "mock-key",
        AUTOPILOT: "machine"
      },
      rl: { pause: () => {}, resume: () => {} },
      history: [],
      currentMode: { name: "titan" }
    };

    let logged = [];
    const origLog = console.log;
    console.log = (m) => logged.push(m);

    try {
      await handleGoalCommand(["create a file named goal.txt"], ctx);
      
      const hasSuccess = logged.some(l => l && l.includes("Goal successfully achieved and verified"));
      assert.ok(hasSuccess);
    } finally {
      console.log = origLog;
    }
  });
});
