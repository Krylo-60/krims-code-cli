// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Main CLI Logic & Command Routing
// Universal AI Gateway — Supports 13+ providers
// ═══════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

import {
  colors,
  label,
  separator,
  keyValue,
  bullet,
  clearStreamedText,
  StreamFilter,
  stripCodeFences,
  getActiveTheme,
  setTheme,
  getThemesList,
} from "./ui/theme.js";
import { createSpinner } from "./ui/spinner.js";
import { routePrompt } from "./ai/router.js";
import { PROVIDERS, getProvidersByTier, getActiveProviders } from "./ai/providers.js";
import { startChat } from "./chat.js";
import { parseFile, formatContext } from "./file-parser.js";
import { MODES, DEFAULT_MODE, getModeByName } from "./modes.js";
import {
  getAIConfig,
  setConfigValue,
  getConfigValue,
  listConfig,
  resetConfig,
  deleteConfigValue,
  getConfigPath,
  configExists,
  isValidConfigKey,
} from "./config.js";

// Configure marked dynamically for terminal output
const getMarked = () => new Marked(markedTerminal({
  reflowText: true,
  width: process.stdout.columns ? Math.max(20, process.stdout.columns - 4) : 80,
  showSectionPrefix: false,
  code: (c) => colors.orange(c),
  codespan: (c) => colors.accent3(c),
  heading: (h) => colors.accent.bold(h),
  strong: (s) => colors.magenta.bold(s),
  em: chalk.italic,
  hr: (h) => colors.dim(h),
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8"));
const VERSION = pkg.version;

/**
 * Sets up and runs the Aether CLI.
 * @param {string[]} argv - Process arguments
 */
export function createCLI(argv) {
  const program = new Command();

  program
    .name("aether")
    .description("Aether Core AI v110 — Universal AI Gateway CLI\n  Supports 13+ AI providers • Free & paid models • Local fallbacks")
    .version(VERSION, "-v, --version");

  // ── Chat Command ────────────────────────────────────────
  program
    .command("chat")
    .description("Start an interactive chat session")
    .option("-m, --mode <mode>", `Reasoning mode (${Object.keys(MODES).filter(m => m !== "claude-code").join(", ")})`, DEFAULT_MODE)
    .option("-p, --provider <provider>", "Preferred AI provider (openai, groq, google, etc.)")
    .action(async (opts) => {
      await startChat({ mode: opts.mode, preferredProvider: opts.provider });
    });

  // ── Ask Command ─────────────────────────────────────────
  program
    .command("ask <prompt...>")
    .description("Send a single prompt and get a response")
    .option("-m, --mode <mode>", "Reasoning mode", DEFAULT_MODE)
    .option("-f, --file <path>", "Attach a file for context")
    .option("-p, --provider <provider>", "Preferred AI provider")
    .option("--model <model>", "Override the AI model")
    .option("--raw", "Output raw text without formatting")
    .action(async (promptParts, opts) => {
      const prompt = promptParts.join(" ");
      await handleAsk(prompt, opts);
    });

  // ── Config Command ──────────────────────────────────────
  const configCmd = program
    .command("config")
    .description("Manage API keys and settings");

  configCmd
    .command("set <key> <value>")
    .description("Set a config value (e.g., GROQ_API_KEY, OPENAI_API_KEY)")
    .action(async (key, value) => {
      await handleConfigSet(key, value);
    });

  configCmd
    .command("get <key>")
    .description("Get a configuration value")
    .action(async (key) => {
      await handleConfigGet(key);
    });

  configCmd
    .command("list")
    .description("List all configuration (keys masked)")
    .action(async () => {
      await handleConfigList();
    });

  configCmd
    .command("delete <key>")
    .description("Delete a configuration key")
    .action(async (key) => {
      await handleConfigDelete(key);
    });

  configCmd
    .command("reset")
    .description("Delete all configuration")
    .action(async () => {
      await handleConfigReset();
    });

  configCmd
    .command("path")
    .description("Show config file location")
    .action(() => {
      console.log("\n" + label.config + " " + colors.text(getConfigPath()) + "\n");
    });

  // ── Providers Command ───────────────────────────────────
  program
    .command("providers")
    .description("List all supported AI providers and their status")
    .option("--free", "Show only free-tier providers")
    .action(async (opts) => {
      await handleProviders(opts);
    });

  // ── Models Command ──────────────────────────────────────
  program
    .command("models [provider]")
    .description("List available models for a provider")
    .action((provider) => {
      handleModels(provider);
    });

  // ── Modes Command ───────────────────────────────────────
  program
    .command("modes")
    .description("List all reasoning modes")
    .action(() => {
      handleModes();
    });
  // ── Theme Command ───────────────────────────────────────
  program
    .command("theme [name]")
    .description("Show active visual theme or switch to a new theme")
    .action(async (name) => {
      if (!name) {
        await handleThemeGet();
      } else {
        await handleThemeSet(name);
      }
    });

  // ── Themes Command ──────────────────────────────────────
  program
    .command("themes")
    .description("List all available color themes")
    .action(() => {
      handleThemesList();
    });
  // ── Status Command ──────────────────────────────────────
  program
    .command("status")
    .description("Show system status & configured providers")
    .action(async () => {
      await handleStatus();
    });

  // ── Setup Command ───────────────────────────────────────
  program
    .command("setup")
    .description("Interactive guided setup for API keys")
    .action(async () => {
      await handleSetup();
    });

  // ── Commit Command ──────────────────────────────────────
  program
    .command("commit")
    .description("Generate conventional commit message from git diff and commit changes")
    .action(async () => {
      await handleCommit();
    });

  // ── Default: Show help ──────────────────────────────────
  program.action(() => {
    showMiniBanner();
    program.help();
  });

  program.parse(argv);
}

// ═══════════════════════════════════════════════════════════
// COMMAND HANDLERS
// ═══════════════════════════════════════════════════════════

async function handleAsk(prompt, opts) {
  const mode = getModeByName(opts.mode) || MODES[DEFAULT_MODE];
  const aiConfig = await getAIConfig();

  // Set theme from configuration
  const theme = aiConfig.THEME || "cyberpunk";
  setTheme(theme);

  // Override model if specified
  if (opts.model) {
    // Set it for all providers
    for (const p of Object.values(PROVIDERS)) {
      aiConfig[`${p.key.replace("_API_KEY", "")}_MODEL`] = opts.model;
    }
  }

  // Attach file context if specified
  let fullPrompt = prompt;
  if (opts.file) {
    try {
      const fileData = await parseFile(opts.file);
      fullPrompt = formatContext(fileData) + "\n\n" + prompt;
      console.log(label.file + " " + colors.accent(`Attached: ${fileData.name}`) + colors.dim(` (${formatBytes(fileData.size)})`));
    } catch (err) {
      console.log(label.error + " " + colors.danger(err.message));
      process.exit(1);
    }
  }

  if (!opts.raw) {
    console.log(label.mode + " " + colors.muted(`${mode.label} • ${mode.layer}`));
  }

  const queryStartTime = Date.now();
  let firstTokenTime = 0;
  const spinner = createSpinner(colors.muted("Routing through failover mesh..."));
  spinner.start();

  let hasStartedStreaming = false;
  let streamedText = "";
  const filter = !opts.raw ? new StreamFilter(process.stdout.write.bind(process.stdout)) : null;
  const onToken = (token) => {
    if (!hasStartedStreaming) {
      hasStartedStreaming = true;
      firstTokenTime = Date.now();
      spinner.stop();
    }
    if (filter) {
      filter.write(token);
    } else {
      process.stdout.write(token);
    }
    streamedText += token;
  };

  try {
    const result = await routePrompt(fullPrompt, mode.systemPrompt, aiConfig, onToken);
    spinner.stop();
    if (filter) {
      filter.flush();
    }

    if (opts.raw) {
      if (!hasStartedStreaming) {
        console.log(result.text);
      } else {
        if (!result.text.endsWith("\n")) {
          console.log("");
        }
      }
    } else {
      if (hasStartedStreaming) {
        clearStreamedText(filter ? filter.filteredText : streamedText);
      }
      console.log("");
      console.log(label.aether + " " + colors.dim(`via ${result.provider}${result.model ? ` (${result.model})` : ""} • Node ${result.node}`));
      console.log(separator("─"));
      console.log("");

      if (result.provider === "local" || result.provider === "krylo-fallback") {
        console.log(colors.text("  " + result.text.split("\n").join("\n  ")));
      } else {
        let displayText = result.text;
        const cleanedText = displayText.replace(/\[WRITE_FILE:\s*([^\n\]]+)\][\s\S]*?\[END_WRITE\]/g, (match, p1) => {
          return `\n\n${colors.brand("⚡ [File creation request: " + p1 + "]")}\n\n`;
        });
        const rendered = getMarked().parse(cleanedText);
        console.log(rendered);
      }

      const elapsedSec = ((Date.now() - queryStartTime) / 1000).toFixed(1);
      let speedText = "";
      if (firstTokenTime > 0) {
        const streamElapsed = (Date.now() - firstTokenTime) / 1000;
        if (streamElapsed > 0.05) {
          const estimatedTokens = Math.max(1, Math.round(streamedText.length / 4));
          const tps = (estimatedTokens / streamElapsed).toFixed(1);
          speedText = ` • ${tps} tok/s`;
        }
      }

      console.log(separator("─"));
      console.log(
        "  " + colors.dim(`Node ${result.node} • ${result.provider}`) +
        (result.model ? colors.dim(` • ${result.model}`) : "") +
        colors.dim(` • ${elapsedSec}s${speedText}`)
      );
      console.log("");
      
      // Parse file write blocks
      const writeRegex = /\[WRITE_FILE:\s*([^\n\]]+)\]\n([\s\S]*?)\n\[END_WRITE\]/g;
      let match;
      const fileWrites = [];
      while ((match = writeRegex.exec(result.text)) !== null) {
        fileWrites.push({ path: match[1].trim(), content: stripCodeFences(match[2]) });
      }

      if (fileWrites.length > 0) {
        const { resolve, dirname } = await import("node:path");
        const { mkdir, writeFile } = await import("node:fs/promises");
        
        for (const fileWrite of fileWrites) {
          const finalPath = resolve(fileWrite.path);
          console.log("");
          console.log(label.system + " " + colors.warning(`Auto-Writing File: ${colors.accent(finalPath)} (${fileWrite.content.length} bytes)`));
          try {
            const dir = dirname(finalPath);
            await mkdir(dir, { recursive: true });
            await writeFile(finalPath, fileWrite.content, "utf-8");
            console.log("  " + colors.success(`✓ File created successfully!\n`));
          } catch (err) {
            console.log("  " + colors.danger(`✗ Write failed: ${err.message}\n`));
          }
        }
      }
    }
  } catch (err) {
    spinner.fail("Request failed");
    console.error(label.error + " " + colors.danger(err.message));
    process.exit(1);
  }
}

async function handleConfigSet(key, value) {
  const normalizedKey = key.toUpperCase();

  if (!isValidConfigKey(normalizedKey)) {
    console.log("\n" + label.config + " " + colors.warning(`Unknown key format: "${normalizedKey}"`));
    console.log("  " + colors.muted("Use format: PROVIDER_API_KEY or PROVIDER_MODEL"));
    console.log("  " + colors.muted("Example: GROQ_API_KEY, OPENAI_API_KEY, GOOGLE_MODEL\n"));
    return;
  }

  await setConfigValue(normalizedKey, value);
  const maskedValue = normalizedKey.includes("KEY") && value.length > 8
    ? value.slice(0, 6) + "•••" + value.slice(-3)
    : value;
  console.log("\n" + label.config + " " + colors.success(`✓ Set ${normalizedKey} = ${maskedValue}`));
  console.log("  " + colors.muted(`Saved to ${getConfigPath()}`) + "\n");
}

async function handleConfigGet(key) {
  const normalizedKey = key.toUpperCase();
  const value = await getConfigValue(normalizedKey);

  if (value === undefined) {
    console.log("\n" + label.config + " " + colors.muted(`"${normalizedKey}" is not set.\n`));
  } else {
    const masked = normalizedKey.includes("KEY") && typeof value === "string" && value.length > 8
      ? value.slice(0, 6) + "•••" + value.slice(-3)
      : value;
    console.log("\n" + label.config + " " + keyValue(normalizedKey, masked) + "\n");
  }
}

async function handleConfigList() {
  const exists = await configExists();
  if (!exists) {
    console.log("\n" + label.config + " " + colors.muted("No config file found."));
    console.log("  " + colors.muted("Run ") + colors.accent("aether setup") + colors.muted(" for guided setup.\n"));
    return;
  }

  const config = await listConfig();
  const keys = Object.keys(config);

  if (keys.length === 0) {
    console.log("\n" + label.config + " " + colors.muted("Config file is empty.\n"));
    return;
  }

  console.log("");
  console.log(colors.brand("  ◈ CONFIGURATION"));
  console.log(separator("─"));
  for (const [k, v] of Object.entries(config)) {
    console.log(keyValue("  " + k, v));
  }
  console.log("");
  console.log("  " + colors.dim(`Location: ${getConfigPath()}`) + "\n");
}

async function handleConfigDelete(key) {
  const normalizedKey = key.toUpperCase();
  await deleteConfigValue(normalizedKey);
  console.log("\n" + label.config + " " + colors.success(`✓ Deleted "${normalizedKey}"`) + "\n");
}

async function handleConfigReset() {
  await resetConfig();
  console.log("\n" + label.config + " " + colors.success("✓ All configuration cleared.") + "\n");
}

async function handleProviders(opts) {
  const aiConfig = await getAIConfig();
  const active = getActiveProviders(aiConfig);
  const activeIds = new Set(active.map((a) => a.id));

  console.log("");
  console.log(colors.brand("  ⚡ SUPPORTED AI PROVIDERS"));
  console.log(separator("─"));

  const tiers = getProvidersByTier();
  const sections = [
    { label: "🆓 FREE TIER", providers: tiers.free, color: "#67ffb0" },
    { label: "🔓 FREE + PAID", providers: tiers["free+paid"], color: "#ffb900" },
    { label: "💎 PAID", providers: tiers.paid, color: "#6ce8ff" },
  ];

  for (const section of sections) {
    if (opts.free && section.label === "💎 PAID") continue;

    console.log("");
    console.log("  " + chalk.hex(section.color).bold(section.label));
    console.log("");

    for (const p of section.providers) {
      const status = activeIds.has(p.id)
        ? colors.success(" ✓ ACTIVE")
        : colors.dim(" ○ Not configured");
      const name = chalk.hex(section.color).bold(p.name.padEnd(18));
      console.log(`  ${name} ${status}`);
      console.log(`  ${"".padEnd(18)} ${colors.muted(p.description)}`);
      console.log(`  ${"".padEnd(18)} ${colors.dim("Key: ")}${colors.accent(p.key)} ${colors.dim("Model: ")}${colors.text(p.defaultModel)}`);
      console.log("");
    }
  }

  console.log(separator("─"));
  console.log("  " + colors.muted("Configure: ") + colors.accent("aether config set <KEY_NAME> <your-key>"));
  console.log("  " + colors.muted("Quick setup: ") + colors.accent("aether setup"));
  console.log("");
}

function handleModels(providerName) {
  if (!providerName) {
    console.log("");
    console.log(colors.brand("  ◈ MODELS BY PROVIDER"));
    console.log(separator("─"));

    for (const [id, p] of Object.entries(PROVIDERS)) {
      console.log("");
      console.log("  " + colors.accent(p.name));
      for (const m of p.models) {
        const isDefault = m === p.defaultModel;
        console.log("  " + (isDefault ? colors.accent3("  ★ " + m) : colors.muted("    " + m)));
      }
    }
    console.log("");
    return;
  }

  const key = providerName.toLowerCase();
  const provider = PROVIDERS[key];

  if (!provider) {
    console.log("\n" + label.error + " " + colors.danger(`Unknown provider: "${providerName}"`));
    console.log("  " + colors.muted("Available: " + Object.keys(PROVIDERS).join(", ")) + "\n");
    return;
  }

  console.log("");
  console.log(colors.brand(`  ◈ ${provider.name} MODELS`));
  console.log(separator("─"));
  for (const m of provider.models) {
    const isDefault = m === provider.defaultModel;
    console.log("  " + (isDefault ? colors.accent3("★ " + m + " (default)") : colors.text("  " + m)));
  }
  console.log("");
  console.log("  " + colors.muted("Override: ") + colors.accent(`aether ask --model ${provider.models[0]} "prompt"`) + "\n");
}

function handleModes() {
  console.log("");
  console.log(colors.brand("  ◈ AETHER REASONING MODES"));
  console.log(separator("─"));
  console.log("");

  for (const mode of Object.values(MODES)) {
    const badge = chalk.hex("#6ce8ff").bold(`[${mode.label}]`);
    console.log(`  ${badge} ${colors.dim(mode.layer)}`);
    console.log("  " + colors.text(mode.description));

    const sig = mode.signal;
    const bar = (val) => {
      const filled = Math.round(val / 10);
      return chalk.hex("#6ce8ff")("█".repeat(filled)) + chalk.hex("#1a2a3a")("░".repeat(10 - filled)) + colors.dim(` ${val}%`);
    };
    console.log(
      "  " + colors.dim("RSN ") + bar(sig.reasoning) +
      "  " + colors.dim("CLR ") + bar(sig.clarity)
    );
    console.log(
      "  " + colors.dim("SIQ ") + bar(sig.systemIQ) +
      "  " + colors.dim("DLV ") + bar(sig.delivery)
    );
    console.log("");
  }
}

async function handleStatus() {
  const aiConfig = await getAIConfig();
  const exists = await configExists();
  const active = getActiveProviders(aiConfig);

  console.log("");
  console.log(colors.brand("  ⚡ AETHER SYSTEM STATUS"));
  console.log(separator("─"));
  console.log(keyValue("  Version", `v${VERSION}`));
  console.log(keyValue("  Config", exists ? colors.success("✓ Found") : colors.warning("✗ Not found")));
  console.log(keyValue("  Location", getConfigPath()));

  console.log("");
  console.log(colors.accent("  ◈ Active Providers:"));
  if (active.length === 0) {
    console.log("  " + colors.warning("  No providers configured. Run `aether setup` to get started."));
  } else {
    for (const { id, provider } of active) {
      console.log("  " + colors.success("  ✓ ") + colors.text(provider.name) + colors.dim(` (${provider.defaultModel})`));
    }
  }

  console.log("");
  console.log(colors.accent("  ◈ Local Fallbacks:"));
  console.log(keyValue("    Math Solver", colors.success("✓ Active")));
  console.log(keyValue("    Krylo Companion", colors.success("✓ Standing By")));

  console.log("");
  console.log(colors.accent("  ◈ Failover Mesh:"));
  const totalNodes = 1 + active.length; // +1 for Krylo
  console.log(keyValue("    Active Nodes", `${totalNodes}`));
  console.log(keyValue("    Mesh Status", active.length > 0 ? colors.success("✓ Online") : colors.warning("⚠ Local Only")));
  console.log("");
}

async function handleCommit() {
  const { getGitDiff, runGitCommit } = await import("./git.js");
  const { createInterface } = await import("node:readline/promises");

  try {
    const { diff, isStaged } = await getGitDiff();
    if (!diff) {
      console.log("\n" + label.system + " " + colors.warning("No staged or unstaged changes detected. Stage your files using 'git add' first.\n"));
      return;
    }

    if (!isStaged) {
      const rlInit = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const stageAnswer = await rlInit.question("\n" + label.system + " " + colors.warning("No staged changes found. Do you want to stage all changes automatically? [y/N]: "));
      rlInit.close();

      if (stageAnswer.toLowerCase().trim() === "y" || stageAnswer.toLowerCase().trim() === "yes") {
        const { exec } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execAsync = promisify(exec);
        await execAsync("git add .");
        console.log(label.system + " " + colors.success("Staged all changes successfully."));
      } else {
        console.log("\n" + label.system + " " + colors.muted("Aborted. Please stage files using 'git add' first.\n"));
        return;
      }
    }

    const aiConfig = await getAIConfig();
    const mode = MODES[DEFAULT_MODE];

    console.log("");
    console.log(label.system + " " + colors.brand("Reading git diff and generating conventional commit message..."));
    console.log("");

    const systemPrompt = "You are an expert developer assistant. Generate a concise, clear, and professional conventional commit message (e.g., 'feat: add login page', 'fix: resolve buffer overflow') based on the provided git diff. Output ONLY the commit message itself on a single line, with absolutely no backticks, markdown, explanations, prefix, or introductory text.";
    const userPrompt = `Here is the git diff:\n\n${diff}`;

    let firstToken = true;
    let commitMessage = "";
    const onToken = (token) => {
      if (firstToken) {
        firstToken = false;
        process.stdout.write(label.aether + " Suggested Commit Message: " + colors.success(token));
      } else {
        process.stdout.write(colors.success(token));
      }
      commitMessage += token;
    };

    const result = await routePrompt(userPrompt, mode.systemPrompt, aiConfig, onToken);
    console.log("\n");

    const cleanMessage = result.text.trim().replace(/^`+|`+$/g, ""); // strip quotes/backticks

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await rl.question(colors.muted("Commit with this message? [Y/n]: "));
    rl.close();

    if (answer.toLowerCase().trim() === "n" || answer.toLowerCase().trim() === "no") {
      console.log("\n" + label.system + " " + colors.muted("Commit aborted.\n"));
      return;
    }

    console.log("\n" + label.system + " " + colors.brand("Executing git commit..."));
    const output = await runGitCommit(cleanMessage);
    console.log("\n" + colors.success(output) + "\n");

  } catch (err) {
    console.log("\n" + label.error + " " + colors.danger(err.message) + "\n");
  }
}

async function handleSetup() {
  const { createInterface } = await import("node:readline");

  console.log("");
  console.log(colors.brand("  ⚡ AETHER SETUP WIZARD"));
  console.log(separator("─"));
  console.log("");
  console.log(colors.text("  Configure your AI providers. Press Enter to skip any provider."));
  console.log(colors.muted("  Keys are stored locally at: " + getConfigPath()));
  console.log("");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question) => new Promise((resolve) => {
    rl.question("  " + colors.accent("? ") + colors.text(question) + " ", (answer) => {
      resolve(answer.trim());
    });
  });

  // Recommended free providers first
  const setupOrder = [
    { id: "groq", hint: "Get free key at https://console.groq.com" },
    { id: "google", hint: "Get free key at https://aistudio.google.com/apikey" },
    { id: "openrouter", hint: "Free models at https://openrouter.ai/keys" },
    { id: "together", hint: "Free credits at https://api.together.xyz" },
    { id: "cerebras", hint: "Free tier at https://cloud.cerebras.ai" },
    { id: "cohere", hint: "Free dev key at https://dashboard.cohere.com" },
    { id: "openai", hint: "Paid — https://platform.openai.com/api-keys" },
    { id: "anthropic", hint: "Paid — https://console.anthropic.com" },
    { id: "xai", hint: "Paid — https://console.x.ai" },
    { id: "mistral", hint: "https://console.mistral.ai" },
    { id: "deepseek", hint: "https://platform.deepseek.com" },
    { id: "perplexity", hint: "https://www.perplexity.ai/settings/api" },
    { id: "fireworks", hint: "https://fireworks.ai/api-keys" },
  ];

  let configured = 0;

  for (const { id, hint } of setupOrder) {
    const provider = PROVIDERS[id];
    if (!provider) continue;

    const tierBadge = provider.tier === "free"
      ? chalk.hex("#67ffb0")("[FREE]")
      : provider.tier === "free+paid"
        ? chalk.hex("#ffb900")("[FREE+PAID]")
        : chalk.hex("#6ce8ff")("[PAID]");

    console.log(`  ${tierBadge} ${colors.text.bold(provider.name)} — ${colors.dim(provider.description)}`);
    console.log("  " + colors.dim(hint));

    const key = await ask(`${provider.key}:`);
    if (key) {
      await setConfigValue(provider.key, key);
      console.log("  " + colors.success("✓ Saved!") + "\n");
      configured++;
    } else {
      console.log("  " + colors.dim("Skipped") + "\n");
    }
  }

  rl.close();

  console.log(separator("─", 62));
  if (configured > 0) {
    console.log("\n  " + colors.success(`✓ Setup complete! ${configured} provider(s) configured.`));
    console.log("  " + colors.muted("Start chatting: ") + colors.accent("aether chat"));
    console.log("  " + colors.muted("Quick query: ") + colors.accent('aether ask "Hello!"'));
  } else {
    console.log("\n  " + colors.warning("No providers configured. Aether will use Krylo fallback mode."));
    console.log("  " + colors.muted("Run ") + colors.accent("aether setup") + colors.muted(" again anytime."));
  }
  console.log("");
}

function showMiniBanner() {
  console.log("");
  console.log(colors.brand("  ⚡ Aether Core AI v110") + colors.dim(" — Universal AI Gateway"));
  console.log(separator("─"));
  console.log("");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function handleThemeGet() {
  const aiConfig = await getAIConfig();
  const theme = aiConfig.THEME || "cyberpunk";
  console.log("\n" + label.config + " " + colors.muted("Active Theme: ") + colors.accent(theme.toUpperCase()) + "\n");
}

async function handleThemeSet(name) {
  const success = setTheme(name);
  if (success) {
    await setConfigValue("THEME", name.toLowerCase().trim());
    console.log("\n" + label.config + " " + colors.success(`✓ Switched theme to ${name.toUpperCase()}`) + "\n");
  } else {
    console.log("\n" + label.error + " " + colors.danger(`Unknown theme: "${name}".`) + colors.muted(` Available: ${getThemesList().join(", ")}\n`));
  }
}

function handleThemesList() {
  console.log("");
  console.log(colors.brand("  ◈ AVAILABLE COLOR THEMES"));
  console.log(separator("─"));
  const active = getActiveTheme();
  for (const t of getThemesList()) {
    const isAct = t === active ? colors.success("★ ACTIVE") : "";
    console.log(bullet(t.toUpperCase().padEnd(14) + isAct));
  }
  console.log("");
}
