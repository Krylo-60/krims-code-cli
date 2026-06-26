// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Interactive Chat Loop
// Universal AI Gateway & Cyberpunk Command Center
// ═══════════════════════════════════════════════════════════

import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import { readdirSync, existsSync, statSync } from "node:fs";
import { resolve, join, sep } from "node:path";
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
  StreamFilter,
  stripCodeFences,
  getActiveTheme,
  setTheme,
  getThemesList,
  interactiveMenu
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
  setConfigValue,
  listSessions,
  switchSession,
  startNewSession
} from "./config.js";
import { MODES, DEFAULT_MODE, getModeByName } from "./modes.js";
import { parseFile, formatContext } from "./file-parser.js";
import { runMainframeHack } from "./ai/fallback.js";
import { AGENT_INSTRUCTIONS } from "./agent.js";
import { checkForUpdates } from "./updater.js";
import { getSessionTokenStats, getBreakdownByModel, resetSessionTokenStats } from "./ai/tokens.js";



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

/**
 * Starts the interactive Aether chat session.
 * @param {{ mode?: string, preferredProvider?: string }} [options={}]
 */
export async function startChat(options = {}) {
  // Load AI config
  const aiConfig = await getAIConfig();
  
  // Run update check
  await checkForUpdates();

  // Reset token stats for the new session
  resetSessionTokenStats();

  
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

  // Completer: handles commands & dynamic local file path autocomplete
  const completer = (line) => {
    const builtIn = [
      "/help", "/mode", "/modes", "/attach", "/files", "/clear",
      "/providers", "/export", "/status", "/copy", "/exit", "/quit",
      "/theme", "/themes", "/history-clear", "/game", "/abort", "/cmd", "/write",
      "/commit", "/run", "/history", "/autopilot", "/tokens"
    ];
    const customCmds = aiConfig.CUSTOM_COMMANDS || {};
    const commands = [...builtIn, ...Object.keys(customCmds)];

    // File path autocompletion on /attach
    if (line.startsWith("/attach ")) {
      const query = line.slice(8);
      const lastSlash = Math.max(query.lastIndexOf("/"), query.lastIndexOf("\\"));
      let searchDir = ".";
      let searchPrefix = query;

      if (lastSlash !== -1) {
        searchDir = query.slice(0, lastSlash);
        if (searchDir === "") {
          searchDir = sep;
        }
        searchPrefix = query.slice(lastSlash + 1);
      }

      try {
        const resolved = resolve(searchDir);
        if (existsSync(resolved) && statSync(resolved).isDirectory()) {
          const files = readdirSync(resolved);
          const hits = files
            .filter((f) => f.toLowerCase().startsWith(searchPrefix.toLowerCase()) && !f.startsWith("."))
            .map((f) => {
              const fullPath = searchDir === "." || searchDir === sep ? f : join(searchDir, f);
              const fullResolved = resolve(fullPath);
              const isDir = statSync(fullResolved).isDirectory();
              return `/attach ${fullPath}${isDir ? "/" : ""}`;
            });
          return [hits.length ? hits : [], line];
        }
      } catch (e) {
        // Fallback silently on fs errors
      }
      return [[], line];
    }

    // Sub-arguments autocomplete on /mode
    if (line.startsWith("/mode ")) {
      const query = line.slice(6).toLowerCase();
      const modesList = Object.keys(MODES);
      const hits = modesList
        .filter((m) => m.startsWith(query))
        .map((m) => `/mode ${m}`);
      return [hits.length ? hits : [], line];
    }

    // Sub-arguments autocomplete on /theme
    if (line.startsWith("/theme ")) {
      const query = line.slice(7).toLowerCase();
      const themesList = getThemesList();
      const hits = themesList
        .filter((t) => t.startsWith(query))
        .map((t) => `/theme ${t}`);
      return [hits.length ? hits : [], line];
    }

    // Sub-arguments autocomplete on /cmd
    if (line.startsWith("/cmd ")) {
      const query = line.slice(5).toLowerCase();
      const subcmds = ["list", "add", "remove"];
      const hits = subcmds
        .filter((s) => s.startsWith(query))
        .map((s) => `/cmd ${s}`);
      return [hits.length ? hits : [], line];
    }

    const hits = commands.filter((c) => c.startsWith(line));
    return [hits.length ? hits : [], line];
  };

  // Create readline interface
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colors.accent("  ❯ "),
    terminal: true,
    completer
  });

  // Load persistent history entries directly into the shell up/down array
  if (history.length > 0) {
    const userQueries = history
      .filter((h) => h.role === "user")
      .map((h) => h.content);
    // Readline history is structured newest first (index 0)
    rl.history = [...new Set(userQueries)].reverse();
  }

  // ── AI Execution Helper ──────────────────────────────────
  async function executeAIQuery(promptText, originalInput = promptText) {
    // ── Build Prompt with Context ─────────────────────────
    let fullPrompt = promptText;
    if (attachedFiles.length > 0) {
      const contexts = attachedFiles.map((f) => formatContext(f)).join("\n\n");
      fullPrompt = `${contexts}\n\n${promptText}`;
    }

    // Append AGENT_INSTRUCTIONS to mode systemPrompt
    const systemPrompt = currentMode.systemPrompt + "\n" + AGENT_INSTRUCTIONS;

    let loopCount = 0;
    const MAX_LOOPS = 5;
    let currentQueryPrompt = fullPrompt;
    let aiResponseText = "";
    let lastResult = null;

    try {
      while (loopCount < MAX_LOOPS) {
        const queryStartTime = Date.now();
        let firstTokenTime = 0;

        if (loopCount > 0) {
          console.log(colors.accent(`\n🤖 [Aether Autopilot Mode - Iteration ${loopCount + 1}/${MAX_LOOPS}]`));
        }

        const spinner = createSpinner(
          colors.muted(loopCount === 0 ? `Routing through mesh ${currentMode.label}...` : `Agent executing tasks...`)
        );
        spinner.start();

        let hasStartedStreaming = false;
        let streamedText = "";
        const filter = new StreamFilter(process.stdout.write.bind(process.stdout));
        const onToken = (token) => {
          if (!hasStartedStreaming) {
            hasStartedStreaming = true;
            firstTokenTime = Date.now();
            spinner.stop();
          }
          filter.write(token);
          streamedText += token;
        };

        const result = await routePrompt(currentQueryPrompt, systemPrompt, aiConfig, onToken, history);
        spinner.stop();
        filter.flush();

        aiResponseText = result.text;
        lastResult = result;

        if (hasStartedStreaming) {
          clearStreamedText(filter.filteredText);
        }

        // Display response
        console.log("");
        console.log(label.aether + " " + providerBadge(result));
        console.log(separator("─"));
        console.log("");

        if (result.provider === "local" || result.provider === "krylo-fallback") {
          console.log(colors.text("  " + result.text.split("\n").join("\n  ")));
        } else {
          let displayText = result.text;
          const rendered = getMarked().parse(displayText);
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

        const showTokens = aiConfig.SHOW_TOKENS !== "false";
        let tokensText = "";
        if (showTokens && result.usage) {
          const { promptTokens, completionTokens } = result.usage;
          tokensText = ` • ${promptTokens.toLocaleString()} in / ${completionTokens.toLocaleString()} out tokens`;
        }

        console.log(separator("─"));
        console.log(
          "  " + colors.dim(`Node ${result.node} • ${result.provider}`) +
          (result.model ? colors.dim(` • ${result.model}`) : "") +
          colors.dim(` • ${elapsedSec}s${speedText}`) +
          colors.dim(tokensText) +
          colors.dim(` • ${Math.floor(history.length / 2)} exchanges`)
        );
        console.log("");

        // Process any agent tools output by the AI
        const { processAgentBlocks } = await import("./agent.js");
        const toolResults = await processAgentBlocks(aiResponseText, aiConfig, rl);

        if (toolResults.length === 0) {
          // No tools executed, end loop
          break;
        }

        // Store this turn in history so AI knows what happened
        history.push({ role: "user", content: currentQueryPrompt, timestamp: new Date() });
        history.push({
          role: "assistant",
          content: aiResponseText,
          provider: result.provider,
          model: result.model,
          node: result.node,
          timestamp: new Date(),
        });
        await saveHistory(history, currentMode.name);

        // Format tool outputs as next prompt
        let formattedResults = "### Agent Tool Outputs:\n";
        for (const tr of toolResults) {
          if (tr.success) {
            if (tr.tool === "RUN_COMMAND") {
              formattedResults += `\n- RUN_COMMAND "${tr.arg}" succeeded. Output:\n\`\`\`\n${tr.stdout || ""}${tr.stderr || ""}\n\`\`\`;`;
            } else if (tr.tool === "READ_FILE") {
              formattedResults += `\n- READ_FILE "${tr.arg}" succeeded. File Content:\n\`\`\`\n${tr.content}\n\`\`\`;`;
            } else if (tr.tool === "WRITE_FILE") {
              formattedResults += `\n- WRITE_FILE "${tr.arg}" succeeded.`;
            } else if (tr.tool === "SEARCH_WEB") {
              const resultsList = tr.results.map((r, i) => `${i+1}. [${r.title}](${r.url})\n   ${r.snippet}`).join("\n");
              formattedResults += `\n- SEARCH_WEB "${tr.arg}" succeeded. Results:\n${resultsList}`;
            }
          } else {
            formattedResults += `\n- ${tr.tool} "${tr.arg}" failed: ${tr.error}`;
          }
        }
        formattedResults += "\n\nPlease continue and finalize your task or perform next steps.";

        currentQueryPrompt = formattedResults;
        loopCount++;
      }

      // Store final state in history
      if (loopCount > 0) {
        // Just save to disk to persist
        await saveHistory(history, currentMode.name);
      } else {
        // Standard single-turn save
        history.push({ role: "user", content: originalInput, timestamp: new Date() });
        history.push({
          role: "assistant",
          content: aiResponseText,
          provider: lastResult.provider,
          model: lastResult.model,
          node: lastResult.node,
          timestamp: new Date(),
        });
        await saveHistory(history, currentMode.name);
      }

    } catch (err) {
      console.log("\n" + label.error + " " + colors.danger(err.message) + "\n");
    }

    // Sync shell's recall history list
    const userQueries = history
      .filter((h) => h.role === "user")
      .map((h) => h.content);
    rl.history = [...new Set(userQueries)].reverse();
  }

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
      const [cmd, ...args] = input.split(/\s+/);
      const builtInList = [
        "/", "/help", "/mode", "/modes", "/attach", "/files", "/clear",
        "/providers", "/export", "/status", "/copy", "/exit", "/quit",
        "/theme", "/themes", "/history-clear", "/game", "/abort", "/cmd",
        "/guess", "/write", "/commit", "/run", "/history", "/autopilot", "/tokens"
      ];
      
      const customCmds = aiConfig.CUSTOM_COMMANDS || {};
      
      if (!builtInList.includes(cmd.toLowerCase()) && customCmds[cmd]) {
        const template = customCmds[cmd];
        const userArg = args.join(" ");
        const rewrittenPrompt = template + (userArg ? " " + userArg : "");
        
        console.log("\n" + label.system + " " + colors.accent(`Executing custom command: `) + colors.text(cmd));
        console.log("  " + colors.muted("Prompt: ") + colors.text(rewrittenPrompt) + "\n");
        
        await executeAIQuery(rewrittenPrompt, input);
        rl.prompt();
        return;
      }

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

    await executeAIQuery(input);
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
    case "/":
    case "/help":
      showHelp(ctx.aiConfig);
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
      await handleHistoryClear(ctx.history, ctx.rl);
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

    case "/cmd":
      await handleCustomCommands(args, ctx);
      break;

    case "/write":
      await handleWriteFile(args, ctx);
      break;

    case "/commit":
      await handleCommitInsideChat(ctx);
      break;

    case "/run":
      await handleRunCommand(args, ctx);
      break;

    case "/history":
      await handleHistorySwitch(ctx);
      break;

    case "/autopilot":
      await handleAutopilotSwitch(args, ctx);
      break;

    case "/tokens":
      await handleTokensDisplay(ctx);
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

function showHelp(aiConfig) {
  console.log("");
  console.log(colors.brand("  ⚡ AETHER CLI COMMANDS"));
  console.log(separator("─"));
  console.log("");
  console.log(keyValue("/", "Show this help menu"));
  console.log(keyValue("/help", "Show this help menu"));
  console.log(keyValue("/mode <name>", "Switch mode (" + Object.keys(MODES).join(", ") + ")"));
  console.log(keyValue("/modes", "List all modes with signal metrics"));
  console.log(keyValue("/theme <name>", "Switch visual theme (cyberpunk, matrix, synthwave, crimson)"));
  console.log(keyValue("/themes", "List available visual themes"));
  console.log(keyValue("/attach <path>", "Attach a file for context (supports Tab path autocomplete!)"));
  console.log(keyValue("/files", "List attached files"));
  console.log(keyValue("/clear", "Clear terminal screen and reprint banner"));
  console.log(keyValue("/providers", "Show active AI providers"));
  console.log(keyValue("/export", "Export conversation to file"));
  console.log(keyValue("/history", "List, switch, and resume past interactive chat sessions"));
  console.log(keyValue("/history-clear", "Clear saved persistent chat history"));
  console.log(keyValue("/autopilot <mode>", "View or switch agent autopilot level (off, safe, workspace, machine)"));
  console.log(keyValue("/tokens", "View detailed session token usage and exchanges telemetry"));
  console.log(keyValue("/game", "Start the local mainframe hacking mini-game"));
  console.log(keyValue("/copy", "Copy the last assistant response to clipboard"));
  console.log(keyValue("/cmd <list|add|remove>", "Manage custom command shortcuts"));
  console.log(keyValue("/write <filename>", "Extract last code block and save to file"));
  console.log(keyValue("/commit", "Generate conventional commit message and commit changes"));
  console.log(keyValue("/run <command>", "Execute a shell command interactively"));
  console.log(keyValue("/exit", "End session"));

  if (aiConfig && aiConfig.CUSTOM_COMMANDS) {
    const custom = aiConfig.CUSTOM_COMMANDS;
    const entries = Object.entries(custom);
    if (entries.length > 0) {
      console.log("");
      console.log(colors.brand("  ⚡ CUSTOM SHORTCUTS"));
      console.log(separator("─"));
      for (const [cmd, template] of entries) {
        console.log(keyValue(cmd, `Shortcut for: "${template}"`));
      }
    }
  }
  console.log("");
}

function handleModeSwitch(args, ctx) {
  const modeName = args[0];
  if (!modeName) {
    console.log("\n" + label.mode + " " + colors.warning("Usage: /mode <" + Object.keys(MODES).join("|") + ">\n"));
    return;
  }

  const newMode = getModeByName(modeName);
  if (!newMode) {
    console.log("\n" + label.mode + " " + colors.danger(`Unknown mode: "${modeName}".`) + " " + colors.muted("Available: " + Object.keys(MODES).join(", ") + "\n"));
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
  const filePath = args.join(" ").trim();
  if (!filePath) {
    const { scanWorkspaceFiles } = await import("./file-parser.js");
    const { interactiveCheckbox } = await import("./ui/theme.js");

    const workspaceFiles = scanWorkspaceFiles(process.cwd());
    if (workspaceFiles.length === 0) {
      console.log("\n" + label.file + " " + colors.muted("No supported files found in this workspace.\n"));
      return;
    }

    ctx.rl.pause();
    const selected = await interactiveCheckbox(
      "Attach files (Arrow Keys to navigate, Space to toggle, Enter to confirm, Esc/q to cancel):\n",
      workspaceFiles,
      ctx.attachedFiles.map(f => f.relativePath || f.name)
    );
    ctx.rl.resume();

    if (selected === null) {
      console.log("\n" + label.file + " " + colors.muted("Selection canceled.\n"));
      return;
    }

    ctx.clearFiles();
    if (selected.length === 0) {
      console.log("\n" + label.file + " " + colors.success("Cleared all attachments.\n"));
      return;
    }

    let successCount = 0;
    for (const file of selected) {
      try {
        const fileData = await parseFile(file);
        fileData.relativePath = file;
        ctx.addFile(fileData);
        successCount++;
      } catch (err) {
        console.log(label.error + " " + colors.danger(`Failed to attach ${file}: ${err.message}`));
      }
    }
    console.log("\n" + label.file + " " + colors.success(`Successfully attached ${successCount} file(s).\n`));
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
  const active = getActiveTheme();
  for (const t of getThemesList()) {
    const activeText = t === active ? colors.success("★ ACTIVE") : "";
    console.log(bullet(t.toUpperCase().padEnd(14) + activeText));
  }
  console.log("");
}

async function handleHistoryClear(history, rl) {
  await clearHistory();
  history.length = 0;
  if (rl) rl.history = [];
  console.log("\n" + label.system + " " + colors.success("✓ Persistent chat history and prompt history cleared.\n"));
}

async function handleAutopilotSwitch(args, ctx) {
  const setting = args[0]?.toLowerCase().trim();
  if (!setting) {
    const current = (ctx.aiConfig.AUTOPILOT || "off").toUpperCase();
    console.log("\n" + label.system + " " + colors.brand("🤖 AUTOPILOT AGENT CONFIGURATION"));
    console.log(separator("─"));
    console.log(keyValue("  Current Setting", current));
    console.log("");
    console.log("  " + colors.muted("Available Modes:"));
    console.log("    • " + colors.accent("off") + colors.text("       - Always ask user for confirmation before executing any actions."));
    console.log("    • " + colors.accent("safe") + colors.text("      - Run read-only/safe terminal commands and searches automatically."));
    console.log("    • " + colors.accent("workspace") + colors.text(" - Run any actions automatically if they stay inside the workspace."));
    console.log("    • " + colors.accent("machine") + colors.text("   - Complete autopilot. Run any action automatically (Full access)."));
    console.log("");
    console.log("  " + colors.muted("To change setting: ") + colors.accent("/autopilot <mode>") + "\n");
    return;
  }

  const valid = ["off", "safe", "workspace", "machine"];
  if (!valid.includes(setting)) {
    console.log("\n" + label.system + " " + colors.danger(`ERROR: Unknown autopilot mode "${setting}".`) + " " + colors.muted("Choose from: off, safe, workspace, machine.\n"));
    return;
  }

  await setConfigValue("AUTOPILOT", setting);
  ctx.aiConfig.AUTOPILOT = setting;
  console.log("\n" + label.system + " " + colors.success(`✓ Autopilot setting updated to ${setting.toUpperCase()} successfully.\n`));
}

async function handleHistorySwitch(ctx) {
  const sessions = listSessions();
  if (sessions.length === 0) {
    console.log("\n" + label.system + " " + colors.muted("No past chat sessions found.\n"));
    return;
  }

  const items = sessions.map((s) => {
    const dateStr = new Date(s.timestamp).toLocaleString();
    const count = s.messages.length;
    const exchanges = Math.floor(count / 2);
    // Find first user query preview
    const firstQuery = s.messages.find((m) => m.role === "user")?.content || "Empty conversation";
    const preview = firstQuery.length > 50 ? firstQuery.slice(0, 47) + "..." : firstQuery;
    const modeBadgeText = `[${s.mode}]`;
    return `${colors.dim(dateStr)} ${colors.brand(modeBadgeText.padEnd(12))} ${colors.muted(exchanges + " exch")} • ${colors.text(preview)}`;
  });

  // Add an option to start a new session
  items.push(colors.accent("➕ Start a new chat session"));

  ctx.rl.pause();
  const selectedIndex = await interactiveMenu(
    "Select a past chat session to resume (Arrow Keys to navigate, Enter to select, Esc/q to cancel):\n",
    items
  );
  ctx.rl.resume();

  if (selectedIndex === null) {
    console.log("\n" + label.system + " " + colors.muted("Selection canceled.\n"));
    return;
  }

  // Clear screen and load the selected session
  process.stdout.write("\x1b[2J\x1b[3J\x1b[H");

  if (selectedIndex === sessions.length) {
    // Start new session
    const newSessionFile = startNewSession();
    ctx.history.length = 0;
    showBanner(ctx.currentMode.name);
    console.log("\n" + label.system + " " + colors.success("Started a new chat session.\n"));
  } else {
    const selectedSession = sessions[selectedIndex];
    switchSession(selectedSession.file);
    
    // Load history
    const loadedHistory = await loadHistory();
    ctx.history.length = 0;
    for (const msg of loadedHistory) {
      ctx.history.push(msg);
    }
    
    showBanner(ctx.currentMode.name);
    console.log("\n" + label.system + " " + colors.success(`✓ Switched to chat session from ${new Date(selectedSession.timestamp).toLocaleString()}`));
    console.log("  " + colors.muted(`Restored ${Math.floor(ctx.history.length / 2)} message exchanges.\n`));
  }

  // Sync shell's recall history list
  const userQueries = ctx.history
    .filter((h) => h.role === "user")
    .map((h) => h.content);
  ctx.rl.history = [...new Set(userQueries)].reverse();
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

// ── Box / Badges / Theme helpers ─────────────────────────────

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

/**
 * Handles the management of custom slash command shortcuts.
 */
async function handleCustomCommands(args, ctx) {
  const sub = args[0]?.toLowerCase();
  
  if (sub === "list") {
    const custom = ctx.aiConfig.CUSTOM_COMMANDS || {};
    const entries = Object.entries(custom);
    
    console.log("");
    console.log(colors.brand("  ⚡ CUSTOM SHORTCUT COMMANDS"));
    console.log(separator("─"));
    
    if (entries.length === 0) {
      console.log("  " + colors.muted("No custom commands registered."));
      console.log("  " + colors.muted("Create one: ") + colors.accent("/cmd add /explain \"Explain this code:\"") + "\n");
      return;
    }
    
    for (const [cmd, template] of entries) {
      console.log(`  ${colors.accent(cmd.padEnd(16))} ${colors.text(template)}`);
    }
    console.log("");
    return;
  }
  
  if (sub === "add") {
    const name = args[1];
    const template = args.slice(2).join(" ");
    
    if (!name || !template) {
      console.log("\n" + label.system + " " + colors.warning("Usage: /cmd add <name> <template>"));
      console.log("  " + colors.muted("Example: /cmd add /explain \"Explain this code in detail:\"") + "\n");
      return;
    }
    
    if (!name.startsWith("/")) {
      console.log("\n" + label.system + " " + colors.danger("ERROR: Command name must start with a slash '/' (e.g. /explain)") + "\n");
      return;
    }
    
    const builtIn = [
      "/help", "/mode", "/modes", "/attach", "/files", "/clear",
      "/providers", "/export", "/status", "/copy", "/exit", "/quit",
      "/theme", "/themes", "/history-clear", "/game", "/abort", "/cmd", "/guess", "/tokens"
    ];
    
    if (builtIn.includes(name.toLowerCase())) {
      console.log("\n" + label.system + " " + colors.danger(`ERROR: Cannot override system command "${name}"`) + "\n");
      return;
    }
    
    const custom = ctx.aiConfig.CUSTOM_COMMANDS || {};
    custom[name] = template;
    
    await setConfigValue("CUSTOM_COMMANDS", custom);
    ctx.aiConfig.CUSTOM_COMMANDS = custom; // sync context
    
    console.log("\n" + label.system + " " + colors.success(`✓ Command registered successfully!`));
    console.log(`  ${colors.accent(name)} ➔ "${template}"\n`);
    return;
  }
  
  if (sub === "remove") {
    const name = args[1];
    if (!name) {
      console.log("\n" + label.system + " " + colors.warning("Usage: /cmd remove <name>") + "\n");
      return;
    }
    
    const custom = ctx.aiConfig.CUSTOM_COMMANDS || {};
    if (!custom[name]) {
      console.log("\n" + label.system + " " + colors.warning(`No custom command named "${name}" exists.`) + "\n");
      return;
    }
    
    delete custom[name];
    await setConfigValue("CUSTOM_COMMANDS", custom);
    ctx.aiConfig.CUSTOM_COMMANDS = custom; // sync context
    
    console.log("\n" + label.system + " " + colors.success(`✓ Removed custom command: "${name}"\n`));
    return;
  }
  
  console.log("\n" + label.system + " " + colors.warning("Usage: /cmd <list|add|remove> [args]"));
  console.log("  " + colors.muted("Type /help for help or /cmd list to see existing shortcuts.\n"));
}

/**
 * Extracts all code blocks from a markdown string.
 */
function extractCodeBlocks(markdown) {
  const regex = /```[\w-]*\n([\s\S]*?)\n```/g;
  const blocks = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

/**
 * Manual file writing command. Extracts the last code block of the previous
 * assistant response and writes it to a file.
 */
async function handleWriteFile(args, ctx) {
  const filename = args.join(" ");
  if (!filename) {
    console.log("\n" + label.system + " " + colors.warning("Usage: /write <filename>") + "\n");
    return;
  }

  const lastResponse = [...ctx.history].reverse().find((h) => h.role === "assistant");
  if (!lastResponse) {
    console.log("\n" + label.system + " " + colors.muted("No assistant response available to write.\n"));
    return;
  }

  const codeBlocks = extractCodeBlocks(lastResponse.content);
  if (codeBlocks.length === 0) {
    console.log("\n" + label.system + " " + colors.warning("No code blocks found in the last response.\n"));
    return;
  }

  const blockContent = codeBlocks[codeBlocks.length - 1];
  const filepath = resolve(filename);

  try {
    const { dirname } = await import("node:path");
    const { mkdir } = await import("node:fs/promises");
    const dir = dirname(filepath);
    await mkdir(dir, { recursive: true });
    await writeFile(filepath, blockContent, "utf-8");
    console.log("\n" + label.system + " " + colors.success(`✓ Code block successfully written to: ${filepath}\n`));
  } catch (err) {
    console.log("\n" + label.error + " " + colors.danger(`Write failed: ${err.message}\n`));
  }
}

/**
 * Interactive git commit command inside chat loop.
 */
async function handleCommitInsideChat(ctx) {
  const { getGitDiff, runGitCommit } = await import("./git.js");
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execAsync = promisify(exec);

  try {
    const { diff, isStaged } = await getGitDiff();
    if (!diff) {
      console.log("\n" + label.system + " " + colors.warning("No staged or unstaged changes detected. Stage your files using 'git add' first.\n"));
      return;
    }

    if (!isStaged) {
      ctx.rl.pause();
      const stageAnswer = await new Promise((resolve) => {
        ctx.rl.question(colors.warning("\nNo staged changes found. Do you want to stage all changes automatically? [y/N]: "), resolve);
      });
      ctx.rl.resume();

      if (stageAnswer.toLowerCase().trim() === "y" || stageAnswer.toLowerCase().trim() === "yes") {
        await execAsync("git add .");
        console.log(label.system + " " + colors.success("Staged all changes successfully."));
      } else {
        console.log("\n" + label.system + " " + colors.muted("Aborted. Please stage files using 'git add' first.\n"));
        return;
      }
    }

    console.log("\n" + label.system + " " + colors.brand("Reading git diff and generating conventional commit message..."));
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

    const result = await routePrompt(userPrompt, systemPrompt, ctx.aiConfig, onToken);
    console.log("\n");

    const cleanMessage = result.text.trim().replace(/^`+|`+$/g, ""); // strip quotes/backticks

    ctx.rl.pause();
    const answer = await new Promise((resolve) => {
      ctx.rl.question(colors.muted("Commit with this message? [Y/n]: "), resolve);
    });
    ctx.rl.resume();

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

/**
 * Sandboxed interactive shell command execution.
 */
async function handleRunCommand(args, ctx) {
  const command = args.join(" ").trim();
  if (!command) {
    console.log("\n" + label.system + " " + colors.warning("Usage: /run <command>\n"));
    return;
  }

  const { spawn } = await import("node:child_process");

  console.log("\n" + label.system + " " + colors.brand(`Running command: ${command}`));
  console.log(separator("─") + "\n");

  ctx.rl.pause();

  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const shell = isWindows ? "cmd.exe" : "/bin/sh";
    const shellArgs = isWindows ? ["/c", command] : ["-c", command];

    const child = spawn(shell, shellArgs, { stdio: "inherit" });

    child.on("close", (code) => {
      ctx.rl.resume();
      console.log("\n" + separator("─"));
      if (code === 0) {
        console.log(label.system + " " + colors.success(`✓ Command exited successfully (code 0).\n`));
      } else {
        console.log(label.system + " " + colors.danger(`✗ Command failed with exit status ${code}.\n`));
      }
      resolve();
    });

    child.on("error", (err) => {
      ctx.rl.resume();
      console.log("\n" + label.error + " " + colors.danger(`Failed to start command: ${err.message}\n`));
      resolve();
    });
  });
}

/**
 * Interactive display of session token usage statistics.
 */
async function handleTokensDisplay(ctx) {
  const stats = getSessionTokenStats();
  const breakdown = getBreakdownByModel();

  console.log("\n" + separator("━"));
  console.log(colors.accent.bold("  ★  AETHER SESSION TOKEN TELEMETRY  ★"));
  console.log(separator("─"));

  const models = Object.keys(breakdown);
  if (models.length === 0) {
    console.log(colors.muted("  No queries executed in this session yet."));
  } else {
    // Print header
    console.log(
      colors.brand("  " + "Model".padEnd(35) + "Prompt".padStart(10) + "Completion".padStart(12) + "Total".padStart(10))
    );
    console.log(colors.dim("  " + "─".repeat(67)));
    for (const [model, data] of Object.entries(breakdown)) {
      const truncatedModel = model.length > 33 ? model.slice(0, 30) + "..." : model;
      console.log(
        "  " + colors.text(truncatedModel.padEnd(35)) +
        colors.brand(data.prompt.toLocaleString().padStart(10)) +
        colors.brand(data.completion.toLocaleString().padStart(12)) +
        colors.accent.bold(data.total.toLocaleString().padStart(10))
      );
    }
  }

  console.log(separator("─"));
  console.log("  " + colors.accent("Total Exchanges:") + colors.text(` ${stats.exchanges}`));
  console.log("  " + colors.accent("Total Tokens:") + colors.text(`    Prompt: ${stats.prompt.toLocaleString()} | Completion: ${stats.completion.toLocaleString()} | Sum: `) + colors.brand.bold(stats.total.toLocaleString()));
  console.log(separator("━") + "\n");
}
