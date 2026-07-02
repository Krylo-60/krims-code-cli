import cp from "node:child_process";
import { getAIConfig } from "../config.js";
import { colors, separator, keyValue, label } from "../ui/theme.js";

// Helper to execute git CLI commands using child_process.exec dynamically so it's mockable in tests
function execGit(args) {
  return new Promise((resolve, reject) => {
    cp.exec(`git ${args}`, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// Parses GitHub owner and repo from remote git URL
function parseGithubUrl(url) {
  if (!url) return null;
  const cleanUrl = url.trim();

  // SSH format: git@github.com:owner/repo.git or git@github.com:owner/repo
  const sshRegex = /git@github\.com:([^/]+)\/([^.]+)(?:\.git)?$/;
  const sshMatch = cleanUrl.match(sshRegex);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // HTTPS format: https://github.com/owner/repo.git or https://github.com/owner/repo
  const httpsRegex = /https?:\/\/github\.com\/([^/]+)\/([^.]+)(?:\.git)?$/;
  const httpsMatch = cleanUrl.match(httpsRegex);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // Fallback pattern if URL is slightly different but still valid github URL
  const fallbackRegex = /github\.com[\/:][^\/]+\/[^\/]+/;
  if (fallbackRegex.test(cleanUrl)) {
    const parts = cleanUrl.split(/github\.com[\/:]/)[1].split('/');
    if (parts.length >= 2) {
      const owner = parts[0];
      const repo = parts[1].replace(/\.git$/, '');
      return { owner, repo };
    }
  }

  // Simple fallback parsing for other cases (e.g. "owner/repo")
  const parts = cleanUrl.split('/');
  if (parts.length === 2) {
    return { owner: parts[0], repo: parts[1] };
  }

  return null;
}

// Dynamically extracts owner/repo name from git remote configuration
async function getGithubRepoInfo() {
  let url = "";
  try {
    url = await execGit("config --get remote.origin.url");
  } catch {
    try {
      const output = await execGit("remote -v");
      const lines = output.split('\n');
      const originLine = lines.find(l => l.includes("origin") && l.includes("github.com"));
      if (originLine) {
        const match = originLine.match(/origin\s+(.*?)\s+\((?:fetch|push)\)/);
        if (match) {
          url = match[1].trim();
        }
      }
    } catch {
      // Ignored
    }
  }

  if (!url) {
    throw new Error("Could not retrieve remote.origin.url. Ensure you are in a git repository with a GitHub remote configured.");
  }

  const info = parseGithubUrl(url);
  if (!info) {
    throw new Error(`Could not parse GitHub owner and repository from remote URL: ${url}`);
  }
  return info;
}

// Retrieves GITHUB token from krims-code config or env variables
async function getGithubToken() {
  const aiConfig = await getAIConfig();
  const token = aiConfig.GITHUB_API_KEY || 
                aiConfig.GITHUB_PERSONAL_ACCESS_TOKEN || 
                process.env.GITHUB_TOKEN || 
                process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  return token || null;
}

// Runs standard github API fetch with appropriate auth headers
async function githubFetch(endpoint, token) {
  const headers = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "krims-code-cli"
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const url = `https://api.github.com${endpoint}`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error(`GitHub API returned ${res.status} (${res.statusText}). If this is a private repository or you are hit by rate limits, please check your token.`);
      }
      throw new Error(`GitHub API returned ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    throw new Error(`Failed to fetch from GitHub: ${err.message}`);
  }
}

// Formats and retrieves local git information
async function getLocalGitStatus() {
  try {
    const branch = await execGit("rev-parse --abbrev-ref HEAD");

    let modifiedCount = 0;
    try {
      const statusOutput = await execGit("status --porcelain");
      modifiedCount = statusOutput.split('\n').map(l => l.trim()).filter(Boolean).length;
    } catch {
      // status porcelain might fail if not in git repo, but getGithubRepoInfo would have already thrown
    }

    let syncStatus = "No upstream branch configured";
    let tracking = null;

    try {
      tracking = await execGit("rev-parse --abbrev-ref @{u}");
      const countOutput = await execGit(`rev-list --left-right --count HEAD...${tracking}`);
      const [ahead, behind] = countOutput.trim().split(/\s+/).map(Number);
      if (ahead > 0 && behind > 0) {
        syncStatus = `Ahead by ${ahead}, Behind by ${behind} commits`;
      } else if (ahead > 0) {
        syncStatus = `Ahead by ${ahead} commit${ahead > 1 ? "s" : ""}`;
      } else if (behind > 0) {
        syncStatus = `Behind by ${behind} commit${behind > 1 ? "s" : ""}`;
      } else {
        syncStatus = "Up to date with remote";
      }
    } catch {
      // No upstream tracking branch
    }

    return { branch, modifiedCount, tracking, syncStatus };
  } catch (err) {
    throw new Error(`Git CLI error: ${err.message}`);
  }
}

// Display help menu
function showGithubHelp() {
  console.log("");
  console.log(colors.brand("  ⚡ GITHUB COMMAND USAGE"));
  console.log(separator("─"));
  console.log(keyValue("  Usage", "Krims Code github <subcommand> [options]"));
  console.log(keyValue("  Chat Usage", "/github <subcommand> [options]"));
  console.log("");
  console.log(colors.accent("  ◈ Subcommands:"));
  console.log(`    ${colors.success("status")} : Show remote repository metadata, local git info, and recent CI runs`);
  console.log(`    ${colors.success("issues")} : List issues (use --state=open|closed to filter, default: open)`);
  console.log(`    ${colors.success("prs")}    : List open pull requests`);
  console.log("");
  console.log(colors.accent("  ◈ Options:"));
  console.log(`    ${colors.success("--state=<state>")} : Filter issues by state (open, closed, all)`);
  console.log("");
}

// Main runner for github command operations
async function runGithubCommand(subcommand, options = {}) {
  if (!subcommand || subcommand === "help") {
    showGithubHelp();
    return;
  }

  // Retrieve Git repo details
  const { owner, repo } = await getGithubRepoInfo();
  
  // Retrieve token
  const token = await getGithubToken();
  if (!token) {
    console.log(colors.warning("  ⚠ Warning: GITHUB_TOKEN or GITHUB_API_KEY not configured. Proceeding anonymously (rate limits apply)."));
  }

  if (subcommand === "status") {
    console.log("\n" + label.system + " " + colors.brand("Fetching remote metadata and local status..."));
    
    // Fetch remote metadata and runs concurrently/sequentially
    const repoData = await githubFetch(`/repos/${owner}/${repo}`, token);
    let runsData = { workflow_runs: [] };
    try {
      runsData = await githubFetch(`/repos/${owner}/${repo}/actions/runs?per_page=5`, token);
    } catch {
      // Actions runs might fail if actions are disabled or not accessible
    }

    const localStatus = await getLocalGitStatus();

    console.log("");
    console.log(colors.brand(`  ⚡ GITHUB WORKSPACE: ${owner}/${repo}`));
    console.log(separator("─"));
    console.log(keyValue("  Stars", `★ ${repoData.stargazers_count || 0}`));
    console.log(keyValue("  Forks", `⑂ ${repoData.forks_count || 0}`));
    console.log(keyValue("  Open Issues/PRs", `${repoData.open_issues_count || 0}`));
    console.log("");

    console.log(colors.accent("  ◈ Local Git Status:"));
    console.log(keyValue("    Branch", localStatus.branch));
    console.log(keyValue("    Modified Files", String(localStatus.modifiedCount)));
    console.log(keyValue("    Sync Status", localStatus.syncStatus));
    console.log("");

    console.log(colors.accent("  ◈ Recent Workflow Runs:"));
    const runs = runsData.workflow_runs || [];
    if (runs.length === 0) {
      console.log("    No recent workflow runs found.");
    } else {
      for (const run of runs.slice(0, 5)) {
        let statusSymbol = colors.muted("○");
        let statusStr = run.status;
        if (run.status === "completed") {
          if (run.conclusion === "success") {
            statusSymbol = colors.success("✓");
            statusStr = colors.success("success");
          } else if (run.conclusion === "failure") {
            statusSymbol = colors.danger("✗");
            statusStr = colors.danger("failed");
          } else {
            statusSymbol = colors.warning("⚠");
            statusStr = colors.warning(run.conclusion || "unknown");
          }
        } else {
          statusSymbol = colors.accent("◈");
          statusStr = colors.accent(run.status);
        }
        console.log(`    ${statusSymbol} ${colors.text(run.name)} (${colors.muted(run.head_branch)}) - ${statusStr} [${run.event}]`);
      }
    }
    console.log("");

  } else if (subcommand === "issues") {
    const state = options.state || "open";
    console.log("\n" + label.system + " " + colors.brand(`Fetching remote issues (state: ${state})...`));

    const rawIssues = await githubFetch(`/repos/${owner}/${repo}/issues?state=${state}&per_page=15`, token);
    const issues = rawIssues.filter(item => !item.pull_request);

    console.log("");
    console.log(colors.brand(`  ⚡ GITHUB ISSUES (State: ${state.toUpperCase()})`));
    console.log(separator("─"));
    if (issues.length === 0) {
      console.log(`  No ${state} issues found.`);
    } else {
      for (const issue of issues.slice(0, 10)) {
        const numberStr = colors.accent(`#${issue.number}`);
        const titleStr = colors.text(issue.title);
        const stateColor = issue.state === "open" ? colors.success : colors.muted;
        console.log(`  ${numberStr}  ${titleStr}`);
        console.log(`       ${colors.muted("State:")} ${stateColor(issue.state)} | ${colors.muted("Author:")} ${issue.user?.login || "unknown"} | ${colors.muted("Comments:")} ${issue.comments}`);
        console.log(`       ${colors.dim(issue.html_url)}`);
        console.log("");
      }
    }

  } else if (subcommand === "prs") {
    console.log("\n" + label.system + " " + colors.brand("Fetching remote open pull requests..."));

    const prs = await githubFetch(`/repos/${owner}/${repo}/pulls?state=open&per_page=15`, token);

    console.log("");
    console.log(colors.brand("  ⚡ GITHUB OPEN PULL REQUESTS"));
    console.log(separator("─"));
    if (prs.length === 0) {
      console.log("  No open pull requests found.");
    } else {
      for (const pr of prs.slice(0, 10)) {
        const numberStr = colors.accent(`#${pr.number}`);
        const titleStr = colors.text(pr.title);
        console.log(`  ${numberStr}  ${titleStr}`);
        console.log(`       ${colors.muted("Branch:")} ${colors.accent2(pr.head?.ref || "unknown")} ➔ ${colors.muted(pr.base?.ref || "unknown")} | ${colors.muted("Author:")} ${pr.user?.login || "unknown"}`);
        console.log(`       ${colors.dim(pr.html_url)}`);
        console.log("");
      }
    }
  } else {
    throw new Error(`Unknown subcommand: ${subcommand}. Support status, issues, prs.`);
  }
}

// Parses slash chat command args manually
function parseArgs(args) {
  const parsed = {
    subcommand: "",
    options: { state: "open" }
  };
  for (const arg of args) {
    if (arg.startsWith("--")) {
      const parts = arg.slice(2).split("=");
      const key = parts[0].toLowerCase();
      parsed.options[key] = parts[1] || true;
    } else if (arg.startsWith("-")) {
      // Short flag support if needed
    } else if (!parsed.subcommand) {
      parsed.subcommand = arg.toLowerCase();
    }
  }
  return parsed;
}

export default {
  name: "github",
  description: "Orchestrate Git & GitHub workspace status, issues, and pull requests",
  aliases: ["gh"],
  signature: "github [subcommand]",
  options: [
    {
      flags: "--state <state>",
      description: "State of the issues to filter (open, closed, all)",
      defaultValue: "open"
    }
  ],
  async executeCLI(args, options) {
    try {
      const subcommand = args[0] || "";
      await runGithubCommand(subcommand, options);
    } catch (err) {
      console.log("\n" + label.error + " " + colors.danger(err.message) + "\n");
    }
  },
  async executeChat(args, ctx) {
    try {
      const parsed = parseArgs(args);
      await runGithubCommand(parsed.subcommand, parsed.options);
    } catch (err) {
      console.log("\n" + label.error + " " + colors.danger(err.message) + "\n");
    }
  }
};
