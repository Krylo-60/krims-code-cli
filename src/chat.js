// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Interactive Chat Loop
// Universal AI Gateway & Cyberpunk Command Center
// ═══════════════════════════════════════════════════════════

import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { exec } from "node:child_process";
import chalk from "chalk";
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

import {
  colors,
  label,
  separator,
  keyValue,
  bullet,
  modeBadge,
  clearStreamedText,
  getActiveTheme,
  setTheme,
  getThemesList
} from "./ui/theme.js";
import { createSpinner } from "./ui/spinner.js";
import { showBanner } from "./ui/banner.js";
import { routePrompt } from "./ai/router.js";
import { getActiveProviders } from "./ai/providers.js";
import {
  getAIConfig,
  loadHistory,
  saveHistory,
  clearHistory,
  setConfigValue
} from "./config.js";
import { MODES, DEFAULT_MODE, getModeByName } from "./modes.js";
import { parseFile, formatContext } from "./file-parser.js";
import { runMainframeHack } from "./ai/fallback.js";

// Configure marked dynamically for terminal output
const getMarked = () => new Marked(markedTerminal({
  reflowText: true,
  width: process.stdout.columns ? Math.max(20, process.stdout.columns - 4) : 80,
  showSectionPrefix: false,
  code: chalk.hex(colors.orange ? "#ffb900" : "#ffb900"),
  codespan: chalk.hex("#50fa7b"),
  heading: chalk.hex("#00f0ff").bold,
  strong: chalk.hex("#ff79c6").bold,
  em: chalk.italic,
  hr: chalk.hex("#44475a"),
}));

/**
 * Starts the interactive Aether chat session.
 * @param {{ mode?: string, preferredProvider?: string }} [options={}]
 */
export async function startChat(options = {}) {
  // Load AI config
  const aiConfig = await getAIConfig();
  
  // Set theme from configuration
  const theme = aiConfig.THEME || "cyberpunk";
  setTheme(theme);

  let currentMode = getModeByName(options.mode) || getModeByName(aiConfig.DEFAULT_MODE) || MODES[DEFAULT_MODE];
  let attachedFiles = [];
  
  // Persistent history loader
  const history = await loadHistory();

  // Mini-game state
  const game = {
    active: false,
    code: "",
    attempts: 0,
    maxAttempts: 6,
  };

  // Show banner
  showBanner(currentMode.name);

  // Active providers diagnostic check
  const active = getActiveProviders(aiConfig);
  if (active.length === 0) {
    console.log(
      "\n" + label.system + " " +
      colors.warning("No API keys configured. Using local fallback solvers.") + "\n" +
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

  // Display loaded history message if any
  if (history.length > 0) {
    console.log(
      "  " + label.info + " " +
      colors.muted(`Restored ${Math.floor(history.length / 2)} message exchanges from persistent logs.`) + "\n"
    );
  }

  // Create readline interface with slash-commands autocomplete
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colors.accent("  ❯ "),
    terminal: true,
    completer: (line) => {
      const completions = [
        "/help", "/mode", "/modes", "/attach", "/files", "/clear",
        "/providers", "/export", "/status", "/copy", "/exit", "/quit",
        "/theme", "/themes", "/history-clear", "/game", "/abort"
      ];
      const hits = completions.filter((c) => c.startsWith(line));
      return [hits.length ? hits : [], line];
    }
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // ── Handle Game Input ──────────────────────────────────
    if (game.active && !input.startsWith("/")) {
      handleGuess(input, game);
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
        game,
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

    let hasStartedStreaming = false;
    let streamedText = "";
    const onToken = (token) => {
      if (!hasStartedStreaming) {
        hasStartedStreaming = true;
        spinner.stop();
      }
      process.stdout.write(token);
      streamedText += token;
    };

    try {
      const result = await routePrompt(fullPrompt, currentMode.systemPrompt, aiConfig, onToken);
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

      // Save to persistent file
      await saveHistory(history);

      if (hasStartedStreaming) {
        clearStreamedText(streamedText);
      }

      // Display response
      console.log("");
      console.log(label.aether + " " + providerBadge(result));
      console.log(separator("─"));
      console.log("");

      if (result.provider === "local" || result.provider === "krylo-fallback") {
        console.log(colors.text("  " + result.text.split("\n").join("\n  ")));
      } else {
        const rendered = getMarked().parse(result.text);
        console.log(rendered);
      }

      console.log(separator("─"));
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
      // Actual screen clear & scrollback reset
      process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
      showBanner(ctx.currentMode.name);
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

    case "/theme":
      await handleThemeSwitch(args);
      break;

    case "/themes":
      showThemesList();
      break;

    case "/history-clear":
      await handleHistoryClear(ctx.history);
      break;

    case "/game":
      handleGameStart(ctx.game);
      break;

    case "/abort":
      handleGameAbort(ctx.game);
      break;

    case "/guess":
      if (ctx.game.active) {
        handleGuess(args[0] || "", ctx.game);
      } else {
        console.log("\n" + label.system + " " + colors.warning("Game is not active. Type /game to start.\n"));
      }
      break;

    case "/copy":
      await handleCopy(ctx.history);
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
  console.log(separator("─"));
  console.log("");
  console.log(keyValue("/help", "Show this help menu"));
  console.log(keyValue("/mode <name>", "Switch mode (synthesis, research, architect, titan)"));
  console.log(keyValue("/modes", "List all modes with signal metrics"));
  console.log(keyValue("/theme <name>", "Switch visual theme (cyberpunk, matrix, synthwave, crimson)"));
  console.log(keyValue("/themes", "List available visual themes"));
  console.log(keyValue("/attach <path>", "Attach a file for context"));
  console.log(keyValue("/files", "List attached files"));
  console.log(keyValue("/clear", "Clear terminal screen and reprint banner"));
  console.log(keyValue("/providers", "Show active AI providers"));
  console.log(keyValue("/export", "Export conversation to file"));
  console.log(keyValue("/history-clear", "Clear saved persistent chat history"));
  console.log(keyValue("/game", "Start the local mainframe hacking mini-game"));
  console.log(keyValue("/copy", "Copy the last assistant response to clipboard"));
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
  console.log(separator("─"));
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
  console.log(separator("─"));
  console.log(keyValue("  Theme", getActiveTheme().toUpperCase()));
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
  console.log(separator("─"));

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

async function handleThemeSwitch(args) {
  const themeName = args[0];
  if (!themeName) {
    console.log("\n" + label.system + " " + colors.warning("Usage: /theme <theme-name>. Type /themes to list themes.\n"));
    return;
  }

  const success = setTheme(themeName);
  if (success) {
    await setConfigValue("THEME", themeName.toLowerCase().trim());
    console.log("\n" + label.system + " " + colors.success(`✓ Theme switched to ${themeName.toUpperCase()}`));
    console.log("  " + colors.muted("Visual grid modulates synchronized.\n"));
  } else {
    console.log("\n" + label.system + " " + colors.danger(`Unknown theme: "${themeName}".`) + " " + colors.muted(`Available: ${getThemesList().join(", ")}\n`));
  }
}

function showThemesList() {
  console.log("");
  console.log(colors.brand("  ◈ AVAILABLE COLOR THEMES"));
  console.log(separator("─"));
  for (const t of getThemesList()) {
    const activeText = t === getActiveTheme() ? colors.success("★ ACTIVE") : "";
    console.log(bullet(t.toUpperCase().padEnd(14) + activeText));
  }
  console.log("");
}

async function handleHistoryClear(history) {
  await clearHistory();
  history.length = 0;
  console.log("\n" + label.system + " " + colors.success("✓ Persistent chat history cleared successfully.\n"));
}

function handleGameStart(game) {
  if (game.active) {
    console.log("\n" + label.system + " " + colors.warning("Mainframe breach is already in progress. Type /abort to cancel.\n"));
    return;
  }

  // Set up game
  game.active = true;
  game.attempts = 0;
  
  // Generate random 4-digit code
  const code = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join("");
  game.code = code;

  const rules = runMainframeHack();
  console.log("\n" + rules.text + "\n");
}

function handleGameAbort(game) {
  if (!game.active) {
    console.log("\n" + label.system + " " + colors.warning("No security breach in progress.\n"));
    return;
  }
  game.active = false;
  console.log("\n" + label.system + " " + colors.warning("Breach protocol aborted. Connection terminated.\n"));
}

function handleGuess(input, game) {
  const guess = input.trim();
  if (!/^\d{4}$/.test(guess)) {
    console.log("\n" + label.error + " " + colors.danger("BREACH ERROR: Code must be exactly 4 digits (0-9).") + "\n");
    return;
  }

  game.attempts++;
  
  const codeArr = game.code.split("");
  const guessArr = guess.split("");
  
  let hits = 0;
  let closes = 0;
  
  const codeUsed = [false, false, false, false];
  const guessUsed = [false, false, false, false];

  // First pass: Hits
  for (let i = 0; i < 4; i++) {
    if (guessArr[i] === codeArr[i]) {
      hits++;
      codeUsed[i] = true;
      guessUsed[i] = true;
    }
  }

  // Second pass: Closes
  for (let i = 0; i < 4; i++) {
    if (guessUsed[i]) continue;
    for (let j = 0; j < 4; j++) {
      if (codeUsed[j]) continue;
      if (guessArr[i] === codeArr[j]) {
        closes++;
        codeUsed[j] = true;
        break;
      }
    }
  }

  console.log("");
  console.log(colors.magenta(`   [BREACH ATTEMPT #${game.attempts} / ${game.maxAttempts}]`));
  console.log(colors.text(`   BREACH INPUT:  ${guess.split("").join(" ")}`));
  console.log(colors.success(`   HITS (Pos):    ${"█ ".repeat(hits)}${"░ ".repeat(4 - hits)} (${hits})`));
  console.log(colors.warning(`   CLOSE (Val):   ${"█ ".repeat(closes)}${"░ ".repeat(4 - closes)} (${closes})`));
  console.log("");

  if (hits === 4) {
    console.log(label.system + " " + colors.success("MAINFRAME BYPASSED! Access granted. Decryption complete. 🔓\n"));
    game.active = false;
  } else if (game.attempts >= game.maxAttempts) {
    console.log(label.error + " " + colors.danger("SECURITY SHUTDOWN! Mainframe locked out. Intrusion logged. 🔒"));
    console.log("   Intrusion PIN was: " + colors.accent(game.code) + "\n");
    game.active = false;
  } else {
    console.log(colors.muted("   Recalibrating security bypass codes...") + "\n");
  }
}

async function handleCopy(history) {
  const lastResponse = [...history].reverse().find((h) => h.role === "assistant");
  if (!lastResponse) {
    console.log("\n" + label.system + " " + colors.muted("No response to copy yet.\n"));
    return;
  }

  try {
    await copyToClipboard(lastResponse.content);
    console.log("\n" + label.system + " " + colors.success("✓ Last response copied to OS Clipboard successfully!\n"));
  } catch (err) {
    console.log("\n" + label.system + " " + colors.muted("Unable to copy automatically. Displaying content below:"));
    console.log(colors.text(lastResponse.content.slice(0, 800)));
    if (lastResponse.content.length > 800) {
      console.log(colors.dim("  [... truncated, use /export to save full conversation]"));
    }
    console.log("");
  }
}

function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    let command;
    if (process.platform === "win32") {
      command = "clip";
    } else if (process.platform === "darwin") {
      command = "pbcopy";
    } else {
      command = "xclip -selection clipboard || xsel -ib";
    }

    try {
      const child = exec(command, (err) => {
        if (err) reject(err);
        else resolve();
      });
      child.stdin.write(text);
      child.stdin.end();
    } catch (e) {
      reject(e);
    }
  });
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
  const bar = colors.accent("█".repeat(filled)) + colors.dim("░".repeat(empty));
  return `${colors.muted(name.padEnd(10))} ${bar} ${colors.muted(value + "%")}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
