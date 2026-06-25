// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Interactive Chat Loop
// Universal AI Gateway Edition
// ═══════════════════════════════════════════════════════════

import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import chalk from "chalk";
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

import { colors, label, separator, keyValue, bullet, modeBadge } from "./ui/theme.js";
import { createSpinner } from "./ui/spinner.js";
import { showBanner } from "./ui/banner.js";
import { routePrompt } from "./ai/router.js";
import { getActiveProviders } from "./ai/providers.js";
import { getAIConfig } from "./config.js";
import { MODES, DEFAULT_MODE, getModeByName } from "./modes.js";
import { parseFile, formatContext } from "./file-parser.js";

// Configure marked for terminal output
const marked = new Marked(markedTerminal({
  reflowText: true,
  width: 80,
  showSectionPrefix: false,
}));

/**
 * Starts the interactive Aether chat session.
 * @param {{ mode?: string, preferredProvider?: string }} [options={}]
 */
export async function startChat(options = {}) {
  let currentMode = getModeByName(options.mode) || MODES[DEFAULT_MODE];
  let attachedFiles = [];
  const history = [];

  // Show banner
  showBanner(currentMode.name);

  // Load AI config
  const aiConfig = await getAIConfig();
  const active = getActiveProviders(aiConfig);

  if (active.length === 0) {
    console.log(
      "\n" + label.system + " " +
      colors.warning("No API keys configured. Using local Krylo fallback.") + "\n" +
      "  " + colors.muted("Run ") + colors.accent("aether setup") +
      colors.muted(" to configure providers (free options available!).\n")
    );
  } else {
    const providerNames = active.map((a) => a.provider.name);
    const unique = [...new Set(providerNames)];
    console.log(
      label.mesh + " " +
      colors.accent("Failover mesh online: ") +
      colors.text(unique.join(" → ")) +
      colors.muted(" → Krylo fallback")
    );
    console.log(
      "  " + colors.dim(`${active.length} node(s) active across ${unique.length} provider(s)`) + "\n"
    );
  }

  // Create readline interface
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colors.accent3("  ❯ "),
    terminal: true,
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // ── Handle Slash Commands ──────────────────────────────
    if (input.startsWith("/")) {
      const handled = await handleCommand(input, {
        currentMode,
        attachedFiles,
        history,
        aiConfig,
        setMode: (mode) => { currentMode = mode; },
        addFile: (file) => { attachedFiles.push(file); },
        clearFiles: () => { attachedFiles = []; },
        rl,
      });
      if (handled !== "exit") {
        rl.prompt();
      }
      return;
    }

    // ── Build Prompt with Context ─────────────────────────
    let fullPrompt = input;
    if (attachedFiles.length > 0) {
      const contexts = attachedFiles.map((f) => formatContext(f)).join("\n\n");
      fullPrompt = `${contexts}\n\n${input}`;
    }

    // ── Query AI ──────────────────────────────────────────
    const spinner = createSpinner(
      colors.muted(`Routing through mesh ${currentMode.label}...`)
    );
    spinner.start();

    try {
      const result = await routePrompt(fullPrompt, currentMode.systemPrompt, aiConfig);
      spinner.stop();

      // Store in history
      history.push({ role: "user", content: input, timestamp: new Date() });
      history.push({
        role: "assistant",
        content: result.text,
        provider: result.provider,
        model: result.model,
        node: result.node,
        timestamp: new Date(),
      });

      // Display response
      console.log("");
      console.log(label.aether + " " + providerBadge(result));
      console.log(separator("─", 62));
      console.log("");

      if (result.provider === "local" || result.provider === "krylo-fallback") {
        console.log(colors.text("  " + result.text.split("\n").join("\n  ")));
      } else {
        const rendered = marked.parse(result.text);
        console.log(rendered);
      }

      console.log(separator("─", 62));
      console.log(
        "  " + colors.dim(`Node ${result.node} • ${result.provider}`) +
        (result.model ? colors.dim(` • ${result.model}`) : "") +
        colors.dim(` • ${Math.floor(history.length / 2)} exchanges`)
      );
      console.log("");
    } catch (err) {
      spinner.fail("Request failed");
      console.log("\n" + label.error + " " + colors.danger(err.message) + "\n");
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\n" + label.system + " " + colors.muted("Session terminated. Stay cyberpunk. ⚡\n"));
    process.exit(0);
  });
}

/**
 * Handles slash commands in the chat.
 */
async function handleCommand(input, ctx) {
  const [cmd, ...args] = input.split(/\s+/);

  switch (cmd.toLowerCase()) {
    case "/help":
      showHelp();
      break;

    case "/mode":
      handleModeSwitch(args, ctx);
      break;

    case "/modes":
      showModes();
      break;

    case "/attach":
      await handleAttach(args, ctx);
      break;

    case "/files":
      showAttachedFiles(ctx.attachedFiles);
      break;

    case "/clear":
      ctx.clearFiles();
      console.log("\n" + label.file + " " + colors.accent("Attached files cleared.\n"));
      break;

    case "/export":
      await handleExport(ctx.history);
      break;

    case "/status":
      showStatus(ctx);
      break;

    case "/providers":
      showActiveProviders(ctx.aiConfig);
      break;

    case "/copy":
      handleCopy(ctx.history);
      break;

    case "/exit":
    case "/quit":
      ctx.rl.close();
      return "exit";

    default:
      console.log("\n" + label.system + " " + colors.warning(`Unknown command: ${cmd}. Type /help for available commands.\n`));
  }
}

// ── Command Handlers ────────────────────────────────────────

function showHelp() {
  console.log("");
  console.log(colors.brand("  ⚡ AETHER CLI COMMANDS"));
  console.log(separator("─", 62));
  console.log("");
  console.log(keyValue("/help", "Show this help menu"));
  console.log(keyValue("/mode <name>", "Switch mode (synthesis, research, architect, titan)"));
  console.log(keyValue("/modes", "List all modes with signal metrics"));
  console.log(keyValue("/attach <path>", "Attach a file for context"));
  console.log(keyValue("/files", "List attached files"));
  console.log(keyValue("/clear", "Remove all attached files"));
  console.log(keyValue("/providers", "Show active AI providers"));
  console.log(keyValue("/export", "Export conversation to file"));
  console.log(keyValue("/status", "Session status"));
  console.log(keyValue("/copy", "Show last AI response"));
  console.log(keyValue("/exit", "End session"));
  console.log("");
}

function handleModeSwitch(args, ctx) {
  const modeName = args[0];
  if (!modeName) {
    console.log("\n" + label.mode + " " + colors.warning("Usage: /mode <synthesis|research|architect|titan>\n"));
    return;
  }

  const newMode = getModeByName(modeName);
  if (!newMode) {
    console.log("\n" + label.mode + " " + colors.danger(`Unknown mode: "${modeName}".`) + " " + colors.muted("Available: synthesis, research, architect, titan\n"));
    return;
  }

  ctx.setMode(newMode);
  console.log("\n" + label.mode + " " + colors.accent("Switched to ") + modeBadge(newMode.name));
  console.log("  " + colors.muted(newMode.description) + "\n");

  const sig = newMode.signal;
  console.log("  " + signalBar("Reasoning", sig.reasoning));
  console.log("  " + signalBar("Clarity", sig.clarity));
  console.log("  " + signalBar("System IQ", sig.systemIQ));
  console.log("  " + signalBar("Delivery", sig.delivery));
  console.log("");
}

function showModes() {
  console.log("");
  console.log(colors.brand("  ◈ AVAILABLE REASONING MODES"));
  console.log(separator("─", 62));
  console.log("");

  for (const mode of Object.values(MODES)) {
    console.log("  " + modeBadge(mode.name) + " " + colors.muted(`(${mode.layer})`));
    console.log("  " + colors.text(mode.description));
    const sig = mode.signal;
    console.log("  " + signalBar("RSN", sig.reasoning) + "  " + signalBar("CLR", sig.clarity) + "  " + signalBar("SIQ", sig.systemIQ) + "  " + signalBar("DLV", sig.delivery));
    console.log("");
  }
}

async function handleAttach(args, ctx) {
  const filePath = args.join(" ");
  if (!filePath) {
    console.log("\n" + label.file + " " + colors.warning("Usage: /attach <path-to-file>\n"));
    return;
  }

  try {
    const fileData = await parseFile(filePath);
    ctx.addFile(fileData);
    console.log("\n" + label.file + " " + colors.success(`Attached: ${fileData.name}`));
    console.log("  " + colors.muted(`${formatBytes(fileData.size)} • ${fileData.extension} • ${ctx.attachedFiles.length} file(s) loaded\n`));
  } catch (err) {
    console.log("\n" + label.error + " " + colors.danger(err.message) + "\n");
  }
}

function showAttachedFiles(files) {
  if (files.length === 0) {
    console.log("\n" + label.file + " " + colors.muted("No files attached. Use /attach <path> to add context.\n"));
    return;
  }

  console.log("");
  console.log(label.file + " " + colors.accent(`${files.length} file(s) attached:`));
  for (const f of files) {
    console.log(bullet(`${f.name} (${formatBytes(f.size)}, ${f.extension})`));
  }
  console.log("");
}

async function handleExport(history) {
  if (history.length === 0) {
    console.log("\n" + label.system + " " + colors.muted("No conversation to export.\n"));
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `aether-chat-${timestamp}.md`;
  const filepath = resolve(filename);

  let content = `# Aether AI Chat Export\n*Exported at ${new Date().toLocaleString()}*\n\n---\n\n`;

  for (const entry of history) {
    if (entry.role === "user") {
      content += `## 👤 You\n${entry.content}\n\n`;
    } else {
      content += `## 🤖 Aether (${entry.provider || "unknown"})\n${entry.content}\n\n---\n\n`;
    }
  }

  try {
    await writeFile(filepath, content, "utf-8");
    console.log("\n" + label.system + " " + colors.success(`Exported to: ${filepath}\n`));
  } catch (err) {
    console.log("\n" + label.error + " " + colors.danger(`Export failed: ${err.message}\n`));
  }
}

function showStatus(ctx) {
  const active = getActiveProviders(ctx.aiConfig);

  console.log("");
  console.log(colors.brand("  ◈ SESSION STATUS"));
  console.log(separator("─", 62));
  console.log(keyValue("  Mode", ctx.currentMode.label));
  console.log(keyValue("  Layer", ctx.currentMode.layer));
  console.log(keyValue("  Exchanges", String(Math.floor(ctx.history.length / 2))));
  console.log(keyValue("  Files", String(ctx.attachedFiles.length)));
  console.log(keyValue("  Providers", String(active.length)));
  console.log("");
}

function showActiveProviders(aiConfig) {
  const active = getActiveProviders(aiConfig);

  console.log("");
  console.log(colors.brand("  ◈ ACTIVE PROVIDERS"));
  console.log(separator("─", 62));

  if (active.length === 0) {
    console.log("  " + colors.warning("No providers. Run `aether setup` to configure.") + "\n");
    return;
  }

  for (const { provider } of active) {
    console.log("  " + colors.success("✓ ") + colors.text(provider.name) + colors.dim(` • ${provider.defaultModel}`));
  }
  console.log("  " + colors.success("✓ ") + colors.text("Krylo Companion") + colors.dim(" • Local fallback"));
  console.log("  " + colors.success("✓ ") + colors.text("Math Solver") + colors.dim(" • Local"));
  console.log("");
}

function handleCopy(history) {
  const lastResponse = [...history].reverse().find((h) => h.role === "assistant");
  if (!lastResponse) {
    console.log("\n" + label.system + " " + colors.muted("No response to copy yet.\n"));
    return;
  }

  console.log("\n" + label.system + " " + colors.muted("Last response:"));
  console.log(colors.text(lastResponse.content.slice(0, 500)));
  if (lastResponse.content.length > 500) {
    console.log(colors.dim("  [... truncated, use /export for full text]"));
  }
  console.log("");
}

// ── Utilities ───────────────────────────────────────────────

function providerBadge(result) {
  const badges = {
    "groq":           chalk.bgHex("#1a2a1a").hex("#67ffb0")(" Groq "),
    "together ai":    chalk.bgHex("#1a2a1a").hex("#67ffb0")(" Together "),
    "cerebras":       chalk.bgHex("#1a2a1a").hex("#67ffb0")(" Cerebras "),
    "openai":         chalk.bgHex("#1a2a1a").hex("#67ffb0")(" OpenAI "),
    "google":         chalk.bgHex("#1a1a2a").hex("#2d7dff")(" Gemini "),
    "anthropic":      chalk.bgHex("#2a1a2a").hex("#b06cff")(" Claude "),
    "xai":            chalk.bgHex("#1a2a1a").hex("#67ffb0")(" Grok "),
    "mistral ai":     chalk.bgHex("#1a1a2a").hex("#ffb900")(" Mistral "),
    "openrouter":     chalk.bgHex("#1a1a2a").hex("#6ce8ff")(" OpenRouter "),
    "cohere":         chalk.bgHex("#1a2a2a").hex("#6ce8ff")(" Cohere "),
    "deepseek":       chalk.bgHex("#1a1a2a").hex("#2d7dff")(" DeepSeek "),
    "perplexity":     chalk.bgHex("#1a2a2a").hex("#6ce8ff")(" Perplexity "),
    "fireworks ai":   chalk.bgHex("#2a1a1a").hex("#ff6b8d")(" Fireworks "),
    "local":          chalk.bgHex("#1a2a1a").hex("#67ffb0")(" Math Solver "),
    "krylo-fallback": chalk.bgHex("#0c1825").hex("#6ce8ff")(" Krylo "),
  };

  const badge = badges[result.provider] || colors.muted(` ${result.provider} `);
  return badge + colors.dim(` Node ${result.node}`);
}

function signalBar(name, value) {
  const filled = Math.round(value / 10);
  const empty = 10 - filled;
  const bar = chalk.hex("#6ce8ff")("█".repeat(filled)) + chalk.hex("#1a2a3a")("░".repeat(empty));
  return `${colors.dim(name.padEnd(10))} ${bar} ${colors.muted(value + "%")}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
