import os from "node:os";
import { join } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import cp from "node:child_process";

// Redirect homedir before importing config.js to point to a temporary test folder
const tempHome = join(process.cwd(), "temp-test-home-github");
process.env.USERPROFILE = tempHome;
process.env.HOME = tempHome;

// Import github command after home redirection
import githubCommand from "../src/commands/github.js";

test("GitHub Command Suite", async (t) => {
  const originalFetch = globalThis.fetch;

  before(async () => {
    await mkdir(tempHome, { recursive: true });
  });

  after(async () => {
    try {
      await rm(tempHome, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test("github status subcommand displays all details correctly", async (t) => {
    // Mock cp.exec
    t.mock.method(cp, "exec", (command, callback) => {
      if (command.includes("remote.origin.url")) {
        callback(null, "https://github.com/test-owner/test-repo.git\n", "");
      } else if (command.includes("rev-parse --abbrev-ref HEAD")) {
        callback(null, "main\n", "");
      } else if (command.includes("status --porcelain")) {
        callback(null, " M file1.js\n?? file2.js\n", "");
      } else if (command.includes("rev-parse --abbrev-ref @{u}")) {
        callback(null, "origin/main\n", "");
      } else if (command.includes("rev-list --left-right --count")) {
        callback(null, "2\t1\n", "");
      } else {
        callback(new Error("Unknown git command"), "", "");
      }
    });

    // Mock global fetch
    let fetchUrls = [];
    globalThis.fetch = async (url, options) => {
      fetchUrls.push(url);
      if (url.includes("/repos/test-owner/test-repo/actions/runs")) {
        return {
          ok: true,
          json: async () => ({
            workflow_runs: [
              {
                name: "CI/CD Pipeline",
                head_branch: "main",
                event: "push",
                status: "completed",
                conclusion: "success",
              },
              {
                name: "Linter",
                head_branch: "feature-branch",
                event: "pull_request",
                status: "completed",
                conclusion: "failure",
              },
              {
                name: "Deploy",
                head_branch: "main",
                event: "push",
                status: "in_progress",
                conclusion: null,
              }
            ]
          })
        };
      } else if (url.includes("/repos/test-owner/test-repo")) {
        return {
          ok: true,
          json: async () => ({
            stargazers_count: 42,
            forks_count: 7,
            open_issues_count: 5,
          })
        };
      }
      return { ok: false, status: 404 };
    };

    // Capture console.log
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(" "));
    };

    try {
      await githubCommand.executeCLI(["status"], {});
      
      const output = logs.join("\n");
      assert.ok(output.includes("GITHUB WORKSPACE: test-owner/test-repo"));
      assert.ok(output.includes("Stars: ★ 42"));
      assert.ok(output.includes("Forks: ⑂ 7"));
      assert.ok(output.includes("Open Issues/PRs: 5"));
      assert.ok(output.includes("Branch: main"));
      assert.ok(output.includes("Modified Files: 2"));
      assert.ok(output.includes("Sync Status: Ahead by 2, Behind by 1 commits"));
      assert.ok(output.includes("CI/CD Pipeline"));
      assert.ok(output.includes("success"));
      assert.ok(output.includes("failed"));
    } finally {
      console.log = originalLog;
    }
  });

  await t.test("github issues subcommand lists issues correctly", async (t) => {
    t.mock.method(cp, "exec", (command, callback) => {
      if (command.includes("remote.origin.url")) {
        callback(null, "git@github.com:test-owner/test-repo.git\n", "");
      } else {
        callback(new Error("Unknown git command"), "", "");
      }
    });

    globalThis.fetch = async (url, options) => {
      if (url.includes("/repos/test-owner/test-repo/issues")) {
        assert.ok(url.includes("state=open"));
        return {
          ok: true,
          json: async () => [
            {
              number: 10,
              title: "Issue 10 title",
              state: "open",
              comments: 2,
              user: { login: "user1" },
              html_url: "https://github.com/test-owner/test-repo/issues/10"
            },
            {
              number: 11,
              title: "PR in issues list",
              state: "open",
              comments: 0,
              user: { login: "user2" },
              html_url: "https://github.com/test-owner/test-repo/pull/11",
              pull_request: {} // This should be filtered out
            }
          ]
        };
      }
      return { ok: false, status: 404 };
    };

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(" "));
    };

    try {
      await githubCommand.executeCLI(["issues"], { state: "open" });
      const output = logs.join("\n");
      assert.ok(output.includes("GITHUB ISSUES (State: OPEN)"));
      assert.ok(output.includes("#10"));
      assert.ok(output.includes("Issue 10 title"));
      assert.ok(output.includes("user1"));
      assert.ok(!output.includes("PR in issues list"));
    } finally {
      console.log = originalLog;
    }
  });

  await t.test("github prs subcommand lists pull requests correctly", async (t) => {
    t.mock.method(cp, "exec", (command, callback) => {
      if (command.includes("remote.origin.url")) {
        callback(null, "https://github.com/test-owner/test-repo\n", "");
      } else {
        callback(new Error("Unknown git command"), "", "");
      }
    });

    globalThis.fetch = async (url, options) => {
      if (url.includes("/repos/test-owner/test-repo/pulls")) {
        assert.ok(url.includes("state=open"));
        return {
          ok: true,
          json: async () => [
            {
              number: 12,
              title: "Implement dashboard component",
              head: { ref: "feature-dash" },
              base: { ref: "main" },
              user: { login: "dev1" },
              html_url: "https://github.com/test-owner/test-repo/pull/12"
            }
          ]
        };
      }
      return { ok: false, status: 404 };
    };

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(" "));
    };

    try {
      await githubCommand.executeChat(["prs"], {});
      const output = logs.join("\n");
      assert.ok(output.includes("GITHUB OPEN PULL REQUESTS"));
      assert.ok(output.includes("#12"));
      assert.ok(output.includes("Implement dashboard component"));
      assert.ok(output.includes("feature-dash"));
      assert.ok(output.includes("dev1"));
    } finally {
      console.log = originalLog;
    }
  });

  await t.test("github command warns when GITHUB_TOKEN is not configured", async (t) => {
    t.mock.method(cp, "exec", (command, callback) => {
      if (command.includes("remote.origin.url")) {
        callback(null, "https://github.com/test-owner/test-repo\n", "");
      } else {
        callback(new Error("Unknown git command"), "", "");
      }
    });

    globalThis.fetch = async (url, options) => {
      if (url.includes("/repos/test-owner/test-repo/pulls")) {
        return {
          ok: true,
          json: async () => []
        };
      }
      return { ok: false, status: 404 };
    };

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(" "));
    };

    // Temporarily clear environment tokens
    const originalToken = process.env.GITHUB_TOKEN;
    const originalPat = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

    try {
      await githubCommand.executeCLI(["prs"], {});
      const output = logs.join("\n");
      assert.ok(output.includes("Warning: GITHUB_TOKEN or GITHUB_API_KEY not configured"));
      assert.ok(output.includes("GITHUB OPEN PULL REQUESTS"));
    } finally {
      console.log = originalLog;
      if (originalToken) process.env.GITHUB_TOKEN = originalToken;
      if (originalPat) process.env.GITHUB_PERSONAL_ACCESS_TOKEN = originalPat;
    }
  });

  await t.test("github command throws error when no remote URL is configured", async (t) => {
    t.mock.method(cp, "exec", (command, callback) => {
      callback(new Error("git config failed"), "", "");
    });

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(" "));
    };

    try {
      await githubCommand.executeCLI(["status"], {});
      const output = logs.join("\n");
      assert.ok(output.includes("ERROR"));
      assert.ok(output.includes("Could not retrieve remote.origin.url"));
    } finally {
      console.log = originalLog;
    }
  });
});
