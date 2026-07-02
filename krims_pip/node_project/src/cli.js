// ═══════════════════════════════════════════════════════════
// Krims Code AI CLI — Main CLI Logic & Command Routing
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
  clearStreamedText,
  StreamFilter,
  stripCodeFences,
  setTheme,
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
import { registry } from "./commands/index.js";

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
 * Sets up and runs the Krims Code CLI.
 * @param {string[]} argv - Process arguments
 */
export async function createCLI(argv) {
  const program = new Command();

  program
    .name("krims-code")
    .description("Krims Code AI — Universal AI Gateway CLI\n  Supports 13+ AI providers • Free & paid models • Local fallbacks")
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

  // ── Setup Command ───────────────────────────────────────
  program
    .command("setup")
    .description("Interactive guided setup for API keys")
    .action(async () => {
      await handleSetup();
    });

  // Load registry commands and register them dynamically
  await registry.load();
  const commands = registry.getAll();
  for (const cmd of commands) {
    const signature = cmd.signature || cmd.name;
    let cmdObj = program.command(signature);
    
    if (cmd.description) {
      cmdObj.description(cmd.description);
    }
    
    if (cmd.aliases && Array.isArray(cmd.aliases)) {
      for (const alias of cmd.aliases) {
        cmdObj.alias(alias);
      }
    }
    
    if (cmd.options && Array.isArray(cmd.options)) {
      for (const opt of cmd.options) {
        if (opt.defaultValue !== undefined) {
          cmdObj.option(opt.flags, opt.description, opt.defaultValue);
        } else {
          cmdObj.option(opt.flags, opt.description);
        }
      }
    }
    
    cmdObj.action(async (...args) => {
      const opts = cmdObj.opts();
      const cliArgs = args.filter(a => typeof a === 'string' || Array.isArray(a));
      await cmd.executeCLI(cliArgs, opts);
    });
  }

  // ── Default: Show help ──────────────────────────────────
  program.action(() => {
    showMiniBanner();
    program.help();
  });

  await program.parseAsync(argv);
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
      console.log(label.krims + " " + colors.dim(`via ${result.provider}${result.model ? ` (${result.model})` : ""} • Node ${result.node}`));
      console.log(separator("─"));
      console.log("");

      if (result.provider === "local" || result.provider === "offline-fallback") {
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
    console.log("  " + colors.muted("Run ") + colors.accent("krims-code setup") + colors.muted(" for guided setup.\n"));
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
  console.log("  " + colors.muted("Configure: ") + colors.accent("krims-code config set <KEY_NAME> <your-key>"));
  console.log("  " + colors.muted("Quick setup: ") + colors.accent("krims-code setup"));
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
  console.log("  " + colors.muted("Override: ") + colors.accent(`krims-code ask --model ${provider.models[0]} "prompt"`) + "\n");
}

function handleModes() {
  console.log("");
  console.log(colors.brand("  ◈ KRIMS CODE REASONING MODES"));
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

async function handleSetup() {
  const { createInterface } = await import("node:readline");

  console.log("");
  console.log(colors.brand("  ⚡ KRIMS CODE SETUP WIZARD"));
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
    console.log("  " + colors.muted("Start chatting: ") + colors.accent("krims-code chat"));
    console.log("  " + colors.muted("Quick query: ") + colors.accent('krims-code ask "Hello!"'));
  } else {
    console.log("\n  " + colors.warning("No providers configured. Krims Code will use Krylo fallback mode."));
    console.log("  " + colors.muted("Run ") + colors.accent("krims-code setup") + colors.muted(" again anytime."));
  }
  console.log("");
}

function showMiniBanner() {
  console.log("");
  console.log(colors.brand("  ⚡ Krims Code AI v110") + colors.dim(" — Universal AI Gateway"));
  console.log(separator("─"));
  console.log("");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
