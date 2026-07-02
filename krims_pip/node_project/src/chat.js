// ═══════════════════════════════════════════════════════════
// Krims Code AI CLI — Interactive Chat Loop
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
  interactiveMenu,
  getIcon,
  highlightCode
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
import { getGitDiff } from "./git.js";
import { registry } from "./commands/index.js";



// Configure marked dynamically for terminal output
const getMarked = () => new Marked(markedTerminal({
  reflowText: true,
  width: process.stdout.columns ? Math.max(20, process.stdout.columns - 4) : 80,
  showSectionPrefix: false,
  code: (c, lang) => highlightCode(c, lang),
  codespan: (c) => colors.accent3(c),
  heading: (h) => colors.accent.bold(h),
  strong: (s) => colors.magenta.bold(s),
  em: chalk.italic,
  hr: (h) => colors.dim(h),
}));

/**
 * Starts the interactive krims-code chat session.
 * @param {{ mode?: string, preferredProvider?: string }} [options={}]
 */
export async function startChat(options = {}) {
  // Load AI config
  const aiConfig = await getAIConfig();
  
  // Load registry commands
  await registry.load();
  
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
      "  " + colors.muted("Run ") + colors.accent("krims-code setup") +
      colors.muted(" to configure providers (free options available!).\n")
    );
  } else {
    const providerNames = active.map((a) => a.provider.name);
    const unique = [...new Set(providerNames)];
    console.log(
      label.mesh + " " +
      colors.accent("Failover mesh online: ") +
      colors.text(unique.join(" → ")) +
      colors.muted(" → Offline fallback")
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
      "/providers", "/export", "/copy", "/exit", "/quit",
      "/history-clear", "/game", "/abort", "/cmd", "/write",
      "/run", "/history", "/autopilot", "/tokens", "/update",
      "/review", "/diagnose", "/goal", "/explain", "/refactor", "/bug", "/doc", "/translate",
      "/search", "/git", "/cd", "/mic"
    ];
    for (const registryCmd of registry.getAll()) {
      builtIn.push(`/${registryCmd.name}`);
      if (registryCmd.aliases) {
        for (const alias of registryCmd.aliases) {
          builtIn.push(`/${alias}`);
        }
      }
    }
    const customCmds = aiConfig.CUSTOM_COMMANDS || {};
    const commands = [...builtIn, ...Object.keys(customCmds)];

    // File path autocompletion on /attach or /cd
    if (line.startsWith("/attach ") || line.startsWith("/cd ")) {
      const isCd = line.startsWith("/cd ");
      const prefix = isCd ? "/cd " : "/attach ";
      const query = line.slice(prefix.length);
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
              if (isCd && !isDir) return null;
              return `${prefix}${fullPath}${isDir ? "/" : ""}`;
            })
            .filter(Boolean);
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
          console.log(colors.accent(`\n🤖 [Krims Code Autopilot Mode - Iteration ${loopCount + 1}/${MAX_LOOPS}]`));
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
        console.log(label.krims + " " + providerBadge(result));
        console.log(separator("─"));
        console.log("");

        if (result.provider === "local" || result.provider === "offline-fallback") {
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
              if (tr.results && tr.results.length > 0) {
                const resultsList = tr.results.map((r, i) => `${i+1}. [${r.title}](${r.url})\n   ${r.snippet}`).join("\n");
                formattedResults += `\n- SEARCH_WEB "${tr.arg}" succeeded. Results:\n${resultsList}`;
              } else {
                formattedResults += `\n- SEARCH_WEB "${tr.arg}" succeeded. No search results were found.`;
              }
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
        "/providers", "/export", "/copy", "/exit", "/quit",
        "/history-clear", "/game", "/abort", "/cmd",
        "/guess", "/write", "/run", "/history", "/autopilot", "/tokens",
        "/update", "/review", "/diagnose", "/goal", "/explain", "/refactor", "/bug", "/doc",
        "/translate", "/search", "/git", "/cd", "/mic"
      ];
      for (const registryCmd of registry.getAll()) {
        builtInList.push(`/${registryCmd.name}`);
        if (registryCmd.aliases) {
          for (const alias of registryCmd.aliases) {
            builtInList.push(`/${alias}`);
          }
        }
      }
      
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

  const slashName = cmd.startsWith("/") ? cmd.slice(1).toLowerCase() : cmd.toLowerCase();
  const registeredCmd = registry.get(slashName);
  if (registeredCmd) {
    const result = await registeredCmd.executeChat(args, ctx);
    if (result === "exit") {
      return "exit";
    }
    return;
  }

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

    case "/cd":
      await handleCd(args, ctx);
      break;

    case "/export":
      await handleExport(ctx.history);
      break;

    case "/status":
      // handled dynamically
      break;

    case "/providers":
      showActiveProviders(ctx.aiConfig);
      break;

    case "/update":
      console.log("\n" + label.system + " " + colors.muted("Checking registry for updates..."));
      await checkForUpdates(true);
      console.log("");
      break;

    case "/review":
      await handleReviewCommand(ctx);
      break;

    case "/diagnose":
      await handleDiagnoseCommand(args, ctx);
      break;

    case "/goal":
      await handleGoalCommand(args, ctx);
      break;

    case "/explain":
    case "/refactor":
    case "/bug":
    case "/doc":
    case "/translate":
      await handleFileAICommand(cmd, args, ctx);
      break;

    case "/search":
      await handleSearchCommand(args, ctx);
      break;

    case "/theme":
      // handled dynamically
      break;

    case "/themes":
      // handled dynamically
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
      // handled dynamically
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

    case "/git":
      await handleGitTUI(ctx);
      break;

    case "/dashboard":
      // handled dynamically
      break;

    case "/mic":
      await handleMicInput(ctx);
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
  console.log(colors.brand("  ⚡ KRIMS CODE CLI COMMANDS"));
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
  console.log(keyValue("/cd <path>", "Change current working directory of this session (supports Tab path autocomplete!)"));
  console.log(keyValue("/clear", "Clear terminal screen and reprint banner"));
  console.log(keyValue("/providers", "Show active AI providers"));
  console.log(keyValue("/export", "Export conversation to file"));
  console.log(keyValue("/history", "List, switch, and resume past interactive chat sessions"));
  console.log(keyValue("/history-clear", "Clear saved persistent chat history"));
  console.log(keyValue("/autopilot <mode|debug [cmd]>", "View/switch autopilot level (off, safe, workspace, machine) or run autonomous debug loop"));
  console.log(keyValue("/git", "Launch interactive Git branch tree, history, and file staging TUI"));
  console.log(keyValue("/dashboard", "Spawn web-based local cyberpunk telemetry dashboard companion"));
  console.log(keyValue("/mic", "Record audio voice input from microphone and transcribe to text"));
  console.log(keyValue("/tokens", "View detailed session token usage and exchanges telemetry"));
  console.log(keyValue("/update", "Force check for updates and update Krims Code CLI manually"));
  console.log(keyValue("/game", "Start the local mainframe hacking mini-game"));
  console.log(keyValue("/copy", "Copy the last assistant response to clipboard"));
  console.log(keyValue("/cmd <list|add|remove>", "Manage custom command shortcuts"));
  console.log(keyValue("/write <filename>", "Extract last code block and save to file"));
  console.log(keyValue("/commit", "Generate conventional commit message and commit changes"));
  console.log(keyValue("/run <command>", "Execute a shell command interactively"));
  console.log(keyValue("/review", "Run git diff and stream an AI code review"));
  console.log(keyValue("/diagnose [cmd]", "Run build/tests and AI-debug any errors"));
  console.log(keyValue("/goal <task>", "Run an autonomous feedback loop to achieve a specific goal"));
  console.log(keyValue("/explain <file>", "AI-explain the design and logic of a file"));
  console.log(keyValue("/refactor <file>", "AI-refactor the code of a target file"));
  console.log(keyValue("/bug <file>", "AI-audit a file to find potential logic bugs"));
  console.log(keyValue("/doc <file>", "AI-generate documentation/docstrings for a file"));
  console.log(keyValue("/translate <file> <lang>", "AI-translate code of a file to another language"));
  console.log(keyValue("/search <query>", "Find matches in code files (use --ai for semantic search)"));
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

async function handleCd(args, ctx) {
  const { homedir } = await import("node:os");
  if (args.length === 0) {
    try {
      const home = homedir();
      process.chdir(home);
      console.log("\n" + label.system + " " + colors.success(`Changed directory to: `) + colors.text(home) + "\n");
    } catch (err) {
      console.log("\n" + label.error + " " + colors.danger(`Failed to change directory: ${err.message}`) + "\n");
    }
    return;
  }

  const targetPath = args.join(" ").trim();
  const resolvedPath = resolve(targetPath);

  try {
    if (!existsSync(resolvedPath)) {
      console.log("\n" + label.error + " " + colors.danger(`Directory does not exist: ${targetPath}`) + "\n");
      return;
    }

    const stat = statSync(resolvedPath);
    if (!stat.isDirectory()) {
      console.log("\n" + label.error + " " + colors.danger(`Path is not a directory: ${targetPath}`) + "\n");
      return;
    }

    process.chdir(resolvedPath);
    console.log("\n" + label.system + " " + colors.success(`Changed directory to: `) + colors.text(resolvedPath) + "\n");
  } catch (err) {
    console.log("\n" + label.error + " " + colors.danger(`Failed to change directory: ${err.message}`) + "\n");
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
  const filename = `krims-chat-${timestamp}.md`;
  const filepath = resolve(filename);

  let content = `# Krims Code AI Chat Export\n*Exported at ${new Date().toLocaleString()}*\n\n---\n\n`;

  for (const entry of history) {
    if (entry.role === "user") {
      content += `## 👤 You\n${entry.content}\n\n`;
    } else {
      content += `## 🤖 Krims Code (${entry.provider || "unknown"})\n${entry.content}\n\n---\n\n`;
    }
  }

  try {
    await writeFile(filepath, content, "utf-8");
    console.log("\n" + label.system + " " + colors.success(`Exported to: ${filepath}\n`));
  } catch (err) {
    console.log("\n" + label.error + " " + colors.danger(`Export failed: ${err.message}\n`));
  }
}

function showStatus_unused(ctx) {
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
    console.log("  " + colors.warning("No providers. Run `krims-code setup` to configure.") + "\n");
    return;
  }

  for (const { provider } of active) {
    console.log("  " + colors.success("✓ ") + colors.text(provider.name) + colors.dim(` • ${provider.defaultModel}`));
  }
  console.log("  " + colors.success("✓ ") + colors.text("Offline Fallback") + colors.dim(" • Local fallback"));
  console.log("  " + colors.success("✓ ") + colors.text("Math Solver") + colors.dim(" • Local"));
  console.log("");
}

async function handleThemeSwitch_unused(args) {
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

function showThemesList_unused() {
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
  if (setting === "debug") {
    await handleAutopilotDebug(args.slice(1).join(" "), ctx);
    return;
  }
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
    "offline-fallback": chalk.bgHex("#0c1825").hex("#6ce8ff")(" Krylo "),
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
async function handleCommitInsideChat_unused(ctx) {
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
        process.stdout.write(label.krims + " Suggested Commit Message: " + colors.success(token));
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
  console.log(colors.accent.bold("  ★  KRIMS CODE SESSION TOKEN TELEMETRY  ★"));
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

/**
 * Streams an AI query prompt and prints telemetry details at the end.
 */
async function executeAISpecialCommand(prompt, specialLabel, ctx) {
  const systemPrompt = ctx.currentMode.systemPrompt + "\n" + AGENT_INSTRUCTIONS;
  let hasStarted = false;
  let responseText = "";
  const queryStartTime = Date.now();
  let firstTokenTime = 0;

  const onToken = (token) => {
    if (!hasStarted) {
      hasStarted = true;
      firstTokenTime = Date.now();
      process.stdout.write("\n" + label.krims + " " + colors.accent(specialLabel) + "\n" + separator("─") + "\n\n");
    }
    process.stdout.write(colors.success(token));
    responseText += token;
  };

  const result = await routePrompt(prompt, systemPrompt, ctx.aiConfig, onToken);
  console.log("\n");

  const elapsedSec = ((Date.now() - queryStartTime) / 1000).toFixed(1);
  let speedText = "";
  if (firstTokenTime > 0) {
    const streamElapsed = (Date.now() - firstTokenTime) / 1000;
    if (streamElapsed > 0.05) {
      const estimatedTokens = Math.max(1, Math.round(responseText.length / 4));
      const tps = (estimatedTokens / streamElapsed).toFixed(1);
      speedText = ` • ${tps} tok/s`;
    }
  }

  const showTokens = ctx.aiConfig.SHOW_TOKENS !== "false";
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
    colors.dim(tokensText)
  );
  console.log("");
}

/**
 * Handler for the /review command (git diff analysis).
 */
async function handleReviewCommand(ctx) {
  console.log("\n" + label.system + " " + colors.muted("Running git diff to fetch repository changes..."));
  try {
    const { diff, isStaged } = await getGitDiff();
    if (!diff) {
      console.log(label.system + " " + colors.success("✓ No changes detected in the repository to review.\n"));
      return;
    }

    const specialLabel = `Reviewing ${isStaged ? "staged" : "unstaged"} changes...`;
    const prompt = `Review the following git diff. Identify potential bugs, logical issues, security concerns, performance problems, and recommend optimization or code cleanup. Keep it concise, practical, and highly technical:\n\n\`\`\`diff\n${diff}\n\`\`\``;

    await executeAISpecialCommand(prompt, specialLabel, ctx);
  } catch (err) {
    console.log(label.system + " " + colors.danger(`Error: ${err.message}\n`));
  }
}

/**
 * Handler for the /diagnose command (build & test diagnostics execution).
 */
async function handleDiagnoseCommand(args, ctx) {
  const defaultCmd = ctx.aiConfig.DIAGNOSE_CMD || "npm test";
  const cmdToRun = args.join(" ").trim() || defaultCmd;

  console.log("\n" + label.system + " " + colors.muted(`Running diagnostics command: "${cmdToRun}"...`));
  
  const spinner = createSpinner("Executing diagnostics").start();
  try {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);
    await execAsync(cmdToRun);
    spinner.succeed("Diagnostics complete!");
    console.log("\n" + label.system + " " + colors.success("✓ Diagnostics clean! Build and tests passed successfully.\n"));
  } catch (err) {
    spinner.fail("Diagnostics failed!");
    
    const output = (err.stdout || "") + "\n" + (err.stderr || "");
    console.log("\n" + label.system + " " + colors.warning(`Diagnostics returned exit code ${err.code}.`));
    console.log(colors.muted("Analyzing compiler/test output logs...\n"));

    const prompt = `The diagnostics command "${cmdToRun}" failed with exit code ${err.code}. Analyze the following stdout and stderr logs to determine the root cause, identify the files/lines causing the failure, and provide a step-by-step resolution and debugging plan:\n\n\`\`\`\n${output.slice(0, 15000)}\n\`\`\``;

    await executeAISpecialCommand(prompt, "Analyzing diagnostics logs...", ctx);
  }
}

/**
 * Handler for file analysis commands: /explain, /refactor, /bug, /doc, /translate.
 */
async function handleFileAICommand(cmdName, args, ctx) {
  const filePath = args[0];
  if (!filePath) {
    console.log("\n" + label.system + " " + colors.warning(`Usage: ${cmdName} <file_path>\n`));
    return;
  }

  // Resolve path
  const resolvedPath = resolve(process.cwd(), filePath);
  
  // Verify path is inside the workspace
  const { isInsideWorkspace } = await import("./agent.js");
  if (!isInsideWorkspace(resolvedPath)) {
    console.log("\n" + label.system + " " + colors.danger("Error: Path is outside the current workspace sandbox.\n"));
    return;
  }

  if (!existsSync(resolvedPath)) {
    console.log("\n" + label.system + " " + colors.danger(`Error: File does not exist at "${filePath}"\n`));
    return;
  }

  const stat = statSync(resolvedPath);
  if (stat.isDirectory()) {
    console.log("\n" + label.system + " " + colors.danger(`Error: "${filePath}" is a directory. File path required.\n`));
    return;
  }

  if (stat.size > 150 * 1024) { // 150KB limit
    console.log("\n" + label.system + " " + colors.warning(`Warning: File "${filePath}" is too large (${Math.round(stat.size / 1024)}KB). Limits are 150KB to protect context limit.\n`));
    return;
  }

  // Read file content
  let content;
  try {
    const { parseFile } = await import("./file-parser.js");
    const parsed = await parseFile(resolvedPath);
    content = parsed.content;
  } catch (err) {
    console.log("\n" + label.system + " " + colors.danger(`Error parsing file: ${err.message}\n`));
    return;
  }

  let prompt = "";
  let labelText = "";

  switch (cmdName.toLowerCase()) {
    case "/explain":
      labelText = `Explaining ${filePath}...`;
      prompt = `Explain the architecture, design patterns, logic flow, and purpose of the following code. Be clear, technical, and structured:\n\n\`\`\`\n${content}\n\`\`\``;
      break;
    case "/refactor":
      labelText = `Refactoring ${filePath}...`;
      prompt = `Suggest refactoring improvements for the following code. Focus on clean code design principles, optimization, readability, reducing complexity, and fixing potential logic bugs. Return both the refactored code block and explanations:\n\n\`\`\`\n${content}\n\`\`\``;
      break;
    case "/bug":
      labelText = `Auditing bugs in ${filePath}...`;
      prompt = `Perform a thorough static analysis and code review of the following code. Identify potential logical bugs, race conditions, edge case failures, performance bottlenecks, and security hazards. Suggest fixes:\n\n\`\`\`\n${content}\n\`\`\``;
      break;
    case "/doc":
      labelText = `Generating documentation for ${filePath}...`;
      prompt = `Generate comprehensive API documentation, JSDoc/docstrings, and comments for the following code. Ensure code parameters, return values, and types are documented:\n\n\`\`\`\n${content}\n\`\`\``;
      break;
    case "/translate":
      const targetLang = args[1];
      if (!targetLang) {
        console.log("\n" + label.system + " " + colors.warning(`Usage: /translate <file_path> <target_language>\n`));
        return;
      }
      labelText = `Translating ${filePath} to ${targetLang}...`;
      prompt = `Translate the following code into ${targetLang}. Return a clean, syntactically correct, and beautifully structured code block of the translated code:\n\n\`\`\`\n${content}\n\`\`\``;
      break;
  }

  try {
    await executeAISpecialCommand(prompt, labelText, ctx);
  } catch (err) {
    console.log("\n" + label.system + " " + colors.danger(`Error: ${err.message}\n`));
  }
}

/**
 * Handler for the /search command (workspace file crawler and AI semantic finder).
 */
async function handleSearchCommand(args, ctx) {
  const isAi = args[0] === "--ai";
  const queryArgs = isAi ? args.slice(1) : args;
  const query = queryArgs.join(" ").trim();

  if (!query) {
    console.log("\n" + label.system + " " + colors.warning("Usage: /search [--ai] <query_string>\n"));
    return;
  }

  const { workspaceSearch, crawlDirectory } = await import("./search.js");

  if (isAi) {
    console.log("\n" + label.system + " " + colors.muted("Scanning workspace project tree for semantic search..."));
    const files = crawlDirectory(process.cwd());
    const { relative } = await import("node:path");
    const relativePaths = files.map((f) => relative(process.cwd(), f).replace(/\\/g, "/"));
    
    // Construct semantic prompt
    const prompt = `Here is the directory structure / file listing of the current workspace:\n\n${relativePaths.slice(0, 100).join("\n")}\n\nBased on this file listing, identify and explain where the following logic or system is implemented, listing the relevant files: ${query}`;
    
    await executeAISpecialCommand(prompt, `Semantic search: "${query}"`, ctx);
    return;
  }

  console.log("\n" + label.system + " " + colors.muted(`Searching workspace for "${query}"...`));
  const results = workspaceSearch(query);

  if (results.length === 0) {
    console.log("\n" + label.system + " " + colors.warning(`✓ No matches found for "${query}" in workspace.\n`));
    return;
  }

  console.log("\n" + separator("━"));
  console.log(colors.accent.bold(`  ★  WORKSPACE SEARCH RESULTS FOR "${query.toUpperCase()}"  ★`));
  console.log(separator("─"));

  // Print header
  console.log(
    colors.brand("  " + "File Path".padEnd(45) + "Line".padStart(6) + "   " + "Preview")
  );
  console.log(colors.dim("  " + "─".repeat(80)));

  // Display matches (limit to top 50 to prevent terminal overflow)
  const displayLimit = 50;
  const visibleResults = results.slice(0, displayLimit);

  for (const match of visibleResults) {
    const truncatedPath = match.relativePath.length > 43 ? "..." + match.relativePath.slice(-40) : match.relativePath;
    const truncatedLine = match.lineContent.length > 50 ? match.lineContent.slice(0, 47) + "..." : match.lineContent;
    console.log(
      "  " + colors.text(truncatedPath.padEnd(45)) +
      colors.brand(match.lineNumber.toString().padStart(6)) +
      "   " + colors.muted(truncatedLine)
    );
  }

  console.log(separator("─"));
  if (results.length > displayLimit) {
    console.log("  " + colors.warning(`⚠ Showing first ${displayLimit} of ${results.length} total matches.`));
  } else {
    console.log("  " + colors.success(`✓ Found ${results.length} matches across the workspace.`));
  }
  console.log(separator("━") + "\n");
}

/**
 * Handler for the /goal command (autonomous goal execution loop).
 */
export async function handleGoalCommand(args, ctx) {
  const goal = args.join(" ").trim();
  if (!goal) {
    console.log("\n" + label.system + " " + colors.warning("Usage: /goal <high-level goal statement>\n"));
    console.log("  " + colors.muted("Example: ") + colors.accent("/goal implement user login page") + "\n");
    return;
  }

  console.log("\n" + label.system + " " + colors.brand("🤖 STARTING AUTONOMOUS GOAL SOLVER"));
  console.log(separator("─"));
  console.log(keyValue("  Target Goal", goal));
  console.log("");

  let iteration = 1;
  const maxIterations = 5;
  
  let currentPrompt = `
The user has set the following goal for you to achieve in the workspace:
"${goal}"

Please analyze this goal, inspect the workspace files as needed, planning and executing step-by-step changes.
Once you have fully completed and verified the goal, end your final response with the exact marker [GOAL_ACHIEVED] to stop the loop.
If you hit an unrecoverable roadblock and cannot achieve the goal, output [GOAL_FAILED].
`;

  const goalSystemPrompt = `
You are Krims Code Autopilot in Autonomous Goal Solver Mode.
The user has set the following goal: "${goal}"

Your task is to take any actions necessary to achieve this goal. You have full access to workspace tools:
- Read files: [READ_FILE: path/to/file]
- Write files:
  [WRITE_FILE: path/to/file]
  <new file content>
  [END_WRITE]
- Search the web: [SEARCH_WEB: query]
- Run commands: [RUN_COMMAND: command]

Rules:
- Plan carefully and execute actions incrementally.
- After each action, the environment will run the tool and return the results to you.
- Once you believe the goal has been fully achieved and verified (e.g., via running tests or inspecting files), output the exact text [GOAL_ACHIEVED] at the end of your response to signal completion.
- If you cannot complete the goal or run into an unrecoverable error, output [GOAL_FAILED] with a summary of what went wrong.
`;

  while (iteration <= maxIterations) {
    console.log(colors.accent(`\n🤖 [Autopilot Goal Solver - Iteration ${iteration}/${maxIterations}]`));

    const spinner = createSpinner(colors.muted(`Krims Code planning & executing next steps...`));
    spinner.start();

    let streamedText = "";
    let hasStartedStreaming = false;
    const filter = new StreamFilter(process.stdout.write.bind(process.stdout));
    const onToken = (token) => {
      if (!hasStartedStreaming) {
        hasStartedStreaming = true;
        spinner.stop();
      }
      filter.write(token);
      streamedText += token;
    };

    let result;
    try {
      result = await routePrompt(currentPrompt, goalSystemPrompt, ctx.aiConfig, onToken, ctx.history);
      spinner.stop();
      filter.flush();
    } catch (routeErr) {
      spinner.stop();
      console.log("\n" + label.error + " " + colors.danger(`AI Routing Failed: ${routeErr.message}`));
      break;
    }

    if (hasStartedStreaming) {
      clearStreamedText(filter.filteredText);
    }

    console.log("");
    console.log(label.krims + " " + providerBadge(result));
    console.log(separator("─"));
    console.log("");

    const rendered = getMarked().parse(result.text);
    console.log(rendered);
    console.log(separator("─"));

    ctx.history.push({ role: "user", content: currentPrompt, timestamp: new Date() });
    ctx.history.push({
      role: "assistant",
      content: result.text,
      provider: result.provider,
      model: result.model,
      node: result.node,
      timestamp: new Date(),
    });
    await saveHistory(ctx.history, ctx.currentMode.name);

    if (result.text.includes("[GOAL_ACHIEVED]")) {
      console.log("\n" + label.system + " " + colors.success(`✓ Goal successfully achieved and verified!\n`));
      break;
    }

    if (result.text.includes("[GOAL_FAILED]")) {
      console.log("\n" + label.system + " " + colors.danger(`❌ Autopilot reported goal failure.\n`));
      break;
    }

    const { processAgentBlocks } = await import("./agent.js");
    const toolResults = await processAgentBlocks(result.text, ctx.aiConfig, ctx.rl);

    let toolOutputs = "### Agent Tool Outputs:\n";
    if (toolResults.length === 0) {
      toolOutputs += "\n(No tool actions were executed in the last iteration. Please execute a tool or finish the task.)";
    } else {
      for (const tr of toolResults) {
        if (tr.success) {
          if (tr.tool === "READ_FILE") {
            toolOutputs += `\n- READ_FILE "${tr.arg}" succeeded. Content:\n\`\`\`\n${tr.content}\n\`\`\`;`;
          } else if (tr.tool === "WRITE_FILE") {
            toolOutputs += `\n- WRITE_FILE "${tr.arg}" succeeded.`;
          } else if (tr.tool === "RUN_COMMAND") {
            toolOutputs += `\n- RUN_COMMAND "${tr.arg}" succeeded. Output:\n\`\`\`\nSTDOUT:\n${tr.stdout}\nSTDERR:\n${tr.stderr}\n\`\`\`;`;
          } else if (tr.tool === "SEARCH_WEB") {
            if (tr.results && tr.results.length > 0) {
              const list = tr.results.map((r, i) => `${i+1}. [${r.title}](${r.url})\n   ${r.snippet}`).join("\n");
              toolOutputs += `\n- SEARCH_WEB "${tr.arg}" succeeded. Results:\n${list}`;
            } else {
              toolOutputs += `\n- SEARCH_WEB "${tr.arg}" succeeded. No search results were found.`;
            }
          }
        } else {
          toolOutputs += `\n- ${tr.tool} "${tr.arg}" failed: ${tr.error}`;
        }
      }
    }

    currentPrompt = `
${toolOutputs}

Please analyze the results of your actions and proceed with the next step to achieve the goal: "${goal}".
Once you believe the goal has been fully achieved and verified, end your final response with [GOAL_ACHIEVED] to stop the loop.
If you cannot achieve the goal, output [GOAL_FAILED].
`;
    iteration++;
  }

  if (iteration > maxIterations) {
    console.log("\n" + label.system + " " + colors.warning(`⚠️ Max autonomous goal solver iterations (${maxIterations}) reached.\n`));
  }
}

/**
 * Runs an autonomous, self-correcting debug/test feedback loop.
 */
export async function handleAutopilotDebug(cmdArg, ctx) {
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execAsync = promisify(exec);

  const testCmd = cmdArg.trim() || ctx.aiConfig.DIAGNOSE_CMD || "npm test";

  console.log("\n" + label.system + " " + colors.brand("🤖 AUTOPILOT AUTONOMOUS DEBUG LOOP"));
  console.log(separator("─"));
  console.log(keyValue("  Diagnostic Command", testCmd));
  console.log("");

  console.log(colors.cyan(`⚡ Running initial diagnostics: ${testCmd}`));
  
  let stdout = "";
  let stderr = "";
  let passed = false;
  let runErr = null;

  try {
    const res = await execAsync(testCmd);
    stdout = res.stdout;
    stderr = res.stderr;
    passed = true;
  } catch (err) {
    stdout = err.stdout || "";
    stderr = err.stderr || "";
    runErr = err;
    passed = false;
  }

  if (passed) {
    console.log("\n" + label.system + " " + colors.success(`✓ Diagnostics passed successfully on the first run!\n`));
    return;
  }

  console.log("\n" + label.system + " " + colors.danger(`❌ Initial run failed. Starting self-correcting debug loop...\n`));

  let iteration = 1;
  const maxIterations = 3;
  let currentPrompt = `
The test/build command "${testCmd}" failed.
Here is the execution output:
--- STDOUT ---
${stdout}
--- STDERR ---
${stderr}
--- ERROR ---
${runErr ? runErr.message : ""}

Please inspect the logs. If you need to read any files first to locate the bug, use the [READ_FILE: path] tool. If you know how to fix it, write the corrected files using [WRITE_FILE: path]...[END_WRITE].
After you output your edits or read operations, we will apply them and re-run the command.
`;

  const debugSystemPrompt = `
You are Krims Code Autopilot in Autonomous Debug Mode.
A terminal command failed. Your goal is to analyze the error logs, read relevant source files to find the bug, write fixes to those files, and make sure the diagnostics pass.
You can read files using: [READ_FILE: path/to/file]
You can write files using:
[WRITE_FILE: path/to/file]
<new file content>
[END_WRITE]

Rules:
- You must identify the root cause of the error.
- First, read the relevant file(s) that might have caused the error.
- Then, output the corrected file content.
- Do not run any command blocks yourself. The environment will automatically re-run the test command for you after you output your modifications.
- Keep your changes minimal and target only the bug.
`;

  while (iteration <= maxIterations) {
    console.log(colors.accent(`\n🤖 [Autopilot Debug - Iteration ${iteration}/${maxIterations}]`));

    const spinner = createSpinner(colors.muted(`Krims Code analyzing diagnostics & planning fixes...`));
    spinner.start();

    let streamedText = "";
    let hasStartedStreaming = false;
    const filter = new StreamFilter(process.stdout.write.bind(process.stdout));
    const onToken = (token) => {
      if (!hasStartedStreaming) {
        hasStartedStreaming = true;
        spinner.stop();
      }
      filter.write(token);
      streamedText += token;
    };

    let result;
    try {
      result = await routePrompt(currentPrompt, debugSystemPrompt, ctx.aiConfig, onToken, ctx.history);
      spinner.stop();
      filter.flush();
    } catch (routeErr) {
      spinner.stop();
      console.log("\n" + label.error + " " + colors.danger(`AI Routing Failed: ${routeErr.message}`));
      break;
    }

    if (hasStartedStreaming) {
      clearStreamedText(filter.filteredText);
    }

    console.log("");
    console.log(label.krims + " " + providerBadge(result));
    console.log(separator("─"));
    console.log("");

    const rendered = getMarked().parse(result.text);
    console.log(rendered);
    console.log(separator("─"));

    ctx.history.push({ role: "user", content: currentPrompt, timestamp: new Date() });
    ctx.history.push({
      role: "assistant",
      content: result.text,
      provider: result.provider,
      model: result.model,
      node: result.node,
      timestamp: new Date(),
    });
    await saveHistory(ctx.history, ctx.currentMode.name);

    const { processAgentBlocks } = await import("./agent.js");
    const toolResults = await processAgentBlocks(result.text, ctx.aiConfig, ctx.rl);

    console.log(colors.cyan(`\n⚡ Re-running diagnostic command (Attempt ${iteration}/${maxIterations}): ${testCmd}`));

    let testStdout = "";
    let testStderr = "";
    let testPassed = false;
    let testRunErr = null;

    try {
      const res = await execAsync(testCmd);
      testStdout = res.stdout;
      testStderr = res.stderr;
      testPassed = true;
    } catch (err) {
      testStdout = err.stdout || "";
      testStderr = err.stderr || "";
      testRunErr = err;
      testPassed = false;
    }

    if (testPassed) {
      console.log("\n" + label.system + " " + colors.success(`✓ Diagnostics passed successfully after autopilot debug corrections!\n`));
      break;
    } else {
      console.log("\n" + label.system + " " + colors.danger(`❌ Diagnostic check still failing (Attempt ${iteration}/${maxIterations}).`));

      let toolOutputs = "### Agent Tool Outputs:\n";
      for (const tr of toolResults) {
        if (tr.success) {
          if (tr.tool === "READ_FILE") {
            toolOutputs += `\n- READ_FILE "${tr.arg}" succeeded. Content:\n\`\`\`\n${tr.content}\n\`\`\`;`;
          } else if (tr.tool === "WRITE_FILE") {
            toolOutputs += `\n- WRITE_FILE "${tr.arg}" succeeded.`;
          } else if (tr.tool === "SEARCH_WEB") {
            const list = tr.results.map((r, i) => `${i+1}. [${r.title}](${r.url})\n   ${r.snippet}`).join("\n");
            toolOutputs += `\n- SEARCH_WEB "${tr.arg}" succeeded. Results:\n${list}`;
          }
        } else {
          toolOutputs += `\n- ${tr.tool} "${tr.arg}" failed: ${tr.error}`;
        }
      }

      currentPrompt = `
${toolOutputs}

The test/build command "${testCmd}" is still failing.
Here is the new execution output:
--- STDOUT ---
${testStdout}
--- STDERR ---
${testStderr}
--- ERROR ---
${testRunErr ? testRunErr.message : ""}

Please analyze the remaining issues, read any other files you need, and apply further fixes.
`;
      iteration++;
    }
  }

  if (iteration > maxIterations) {
    console.log("\n" + label.system + " " + colors.warning(`⚠️ Max autopilot debug iterations reached. Review the diagnostics manually.\n`));
  }
}

/**
 * Renders the custom interactive Git TUI file stager and branch tree.
 */
export async function handleGitTUI(ctx) {
  const { execSync } = await import("node:child_process");

  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
  } catch (e) {
    console.log("\n" + label.error + " " + colors.danger("Not a git repository (or git is not installed).\n"));
    return;
  }

  const stdin = process.stdin;
  const stdout = process.stdout;
  const wasRaw = stdin.isRaw;

  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  stdout.write("\x1b[?25l"); // Hide cursor

  let files = getGitStatusFiles();
  let activeIndex = 0;
  let renderedLines = 0;

  function getGitStatusFiles() {
    try {
      const out = execSync("git status --porcelain", { encoding: "utf8" }).trim();
      if (!out) return [];
      return out.split("\n").map(line => {
        const status = line.slice(0, 2);
        const file = line.slice(3).trim();
        const isStaged = status[0] !== " " && status[0] !== "?";
        const isUnstaged = status[1] !== " " || status[0] === "?";
        return {
          path: file,
          status,
          staged: isStaged,
          unstaged: isUnstaged
        };
      });
    } catch (e) {
      return [];
    }
  }

  function render() {
    if (renderedLines > 0) {
      stdout.write(`\x1b[${renderedLines}A\x1b[J`);
    }

    let lines = [];
    lines.push(colors.brand("🌿 KRIMS CODE INTERACTIVE GIT TUI"));
    lines.push(separator("─"));

    let branchGraph = "";
    try {
      branchGraph = execSync("git log --graph --oneline --decorate -n 6", { encoding: "utf8" }).trim();
    } catch (e) {
      branchGraph = "  No git history found.";
    }

    lines.push(colors.accent("Commit Graph & History:"));
    if (branchGraph) {
      lines.push(branchGraph.split("\n").map(l => "  " + colors.muted(l)).join("\n"));
    }
    lines.push(separator("─"));

    lines.push(colors.accent("Modified Files:"));

    if (files.length === 0) {
      lines.push(colors.success("  Clean working directory. Nothing to stage/commit."));
    } else {
      files.forEach((file, index) => {
        const isActive = index === activeIndex;
        const pointer = isActive ? colors.accent("❯ ") : "  ";
        const checkbox = file.staged ? colors.success("[⬢] ") : colors.muted("[⬡] ");

        let statusColor = colors.text;
        if (file.status[0] === "?" || file.status[1] === "?") {
          statusColor = colors.warning;
        } else if (file.staged && !file.unstaged) {
          statusColor = colors.success;
        } else if (file.unstaged) {
          statusColor = colors.danger;
        }

        const pathText = isActive ? colors.brand(file.path) : statusColor(file.path);
        const statusText = colors.dim(`(${file.status})`);
        lines.push(pointer + checkbox + pathText + " " + statusText);
      });
    }

    lines.push(separator("─"));
    lines.push(colors.muted("Hotkeys: [Space] Stage/Unstage | [D] Discard | [C] Commit | [P] Push | [Q/Esc] Quit"));

    const outputStr = lines.join("\n") + "\n";
    stdout.write(outputStr);
    renderedLines = lines.length;
  }

  render();

  return new Promise((resolve) => {
    async function handleKey(key) {
      console.log("TUI_KEY:", JSON.stringify(key));
      if (key === "\u0003" || key === "q" || key === "Q" || key === "\u001b") {
        cleanup();
        resolve();
        return;
      }

      if (key === "\u001b[A") { // Up Arrow
        if (files.length > 0) {
          activeIndex = (activeIndex - 1 + files.length) % files.length;
          render();
        }
        return;
      }
      if (key === "\u001b[B") { // Down Arrow
        if (files.length > 0) {
          activeIndex = (activeIndex + 1) % files.length;
          render();
        }
        return;
      }

      if (key === " ") { // Stage/Unstage
        if (files.length > 0) {
          const file = files[activeIndex];
          try {
            if (file.staged) {
              execSync(`git restore --staged "${file.path}"`);
            } else {
              execSync(`git add "${file.path}"`);
            }
          } catch (err) {
            // Ignore
          }
          files = getGitStatusFiles();
          if (activeIndex >= files.length) {
            activeIndex = Math.max(0, files.length - 1);
          }
          render();
        }
        return;
      }

      if (key === "d" || key === "D") { // Discard
        if (files.length > 0) {
          const file = files[activeIndex];
          try {
            if (file.status[0] === "?" || file.status[1] === "?") {
              const fs = await import("node:fs");
              fs.rmSync(file.path, { force: true });
            } else {
              execSync(`git restore "${file.path}"`);
            }
          } catch (err) {
            // Ignore
          }
          files = getGitStatusFiles();
          if (activeIndex >= files.length) {
            activeIndex = Math.max(0, files.length - 1);
          }
          render();
        }
        return;
      }

      if (key === "c" || key === "C") { // Commit
        cleanup();

        const hasStaged = files.some(f => f.staged);
        if (!hasStaged) {
          console.log("\n" + label.warning + " " + colors.warning("No staged changes to commit. Stage some files first!\n"));
          await new Promise(r => setTimeout(r, 1500));
          
          stdin.setRawMode(true);
          stdin.resume();
          stdout.write("\x1b[?25l");
          renderedLines = 0;
          files = getGitStatusFiles();
          render();
          return;
        }

        ctx.rl.pause();
        const commitMsg = await new Promise((resMsg) => {
          ctx.rl.question(
            colors.accent("\n💬 Enter commit message: "),
            resMsg
          );
        });
        ctx.rl.resume();

        if (commitMsg.trim()) {
          try {
            execSync(`git commit -m "${commitMsg.trim()}"`);
            console.log("\n" + label.system + " " + colors.success("✓ Changes committed successfully!\n"));
          } catch (err) {
            console.log("\n" + label.error + " " + colors.danger("Failed to commit changes: " + err.message + "\n"));
          }
        } else {
          console.log("\n" + label.warning + " " + colors.muted("Commit aborted (empty message).\n"));
        }

        await new Promise(r => setTimeout(r, 1500));

        stdin.setRawMode(true);
        stdin.resume();
        stdout.write("\x1b[?25l");
        renderedLines = 0;
        files = getGitStatusFiles();
        activeIndex = 0;
        render();
        return;
      }

      if (key === "p" || key === "P") { // Push
        cleanup();
        console.log("\n" + label.system + " " + colors.brand("🚀 Pushing changes to remote branch..."));
        try {
          const out = execSync("git push", { encoding: "utf8" });
          console.log(colors.muted(out));
          console.log("\n" + label.system + " " + colors.success("✓ Push completed successfully!\n"));
        } catch (err) {
          console.log("\n" + label.error + " " + colors.danger("Failed to push changes: " + err.message + "\n"));
        }

        await new Promise(r => setTimeout(r, 2000));

        stdin.setRawMode(true);
        stdin.resume();
        stdout.write("\x1b[?25l");
        renderedLines = 0;
        files = getGitStatusFiles();
        render();
        return;
      }
    }

    function cleanup() {
      stdin.removeListener("data", handleKey);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stdout.write("\x1b[?25h"); // Show cursor
    }

    stdin.on("data", handleKey);
  });
}

/**
 * Handles spawning and launching the local telemetry dashboard.
 */
export async function handleDashboardCommand_unused(ctx) {
  const { startDashboardServer } = await import("./dashboard.js");
  const { exec } = await import("node:child_process");
  
  try {
    const { port } = await startDashboardServer();
    console.log("\n" + label.system + " " + colors.brand("📊 KRIMS CODE WEB TELEMETRY DASHBOARD"));
    console.log(separator("─"));
    console.log(keyValue("  Status", colors.success("ONLINE")));
    console.log(keyValue("  Local URL", `http://localhost:${port}`));
    console.log("");
    console.log("  " + colors.muted("Launching browser companion automatically..."));
    
    let startCmd = `start http://localhost:${port}`;
    if (process.platform === "darwin") {
      startCmd = `open http://localhost:${port}`;
    } else if (process.platform === "linux") {
      startCmd = `xdg-open http://localhost:${port}`;
    }
    exec(startCmd);
    console.log("\n" + label.system + " " + colors.success("✓ Dashboard launched. Press Ctrl+C in this session to stop dashboard at exit.\n"));
  } catch (err) {
    console.log("\n" + label.error + " " + colors.danger("Failed to start dashboard server: " + err.message + "\n"));
  }
}

/**
 * Handles recording audio voice from microphone and transcribing to text input.
 */
export async function handleMicInput(ctx) {
  const { startRecording, transcribeAudioFile } = await import("./mic.js");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const fs = await import("node:fs");

  const apiKeyExists = ctx.aiConfig.GOOGLE_API_KEY || ctx.aiConfig.GROQ_API_KEY || ctx.aiConfig.OPENAI_API_KEY;
  if (!apiKeyExists) {
    console.log("\n" + label.error + " " + colors.danger("No API keys found for speech-to-text. Please configure GOOGLE_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY.\n"));
    return;
  }

  const wavPath = join(tmpdir(), `krims_mic_${Date.now()}.wav`);
  let handle;

  try {
    handle = await startRecording(wavPath);
  } catch (err) {
    console.log("\n" + label.error + " " + colors.danger(`Failed to start recording: ${err.message}\n`));
    return;
  }

  console.log("\n" + label.system + " " + colors.brand(getIcon("mic", ctx.aiConfig) + "AUDIO VOICE INPUT"));
  console.log(separator("─"));
  console.log(colors.accent("  Recording started..."));
  console.log("  " + colors.muted("Speak into your microphone."));
  console.log("  " + colors.brand("Press [Enter] to STOP and transcribe..."));
  console.log(separator("─"));

  ctx.rl.pause();

  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;
  const isTTY = typeof stdin.setRawMode === "function";

  if (isTTY) {
    stdin.setRawMode(true);
  }
  stdin.resume();
  stdin.setEncoding("utf8");

  let aborted = false;
  await new Promise((resolve) => {
    function onData(chunk) {
      if (!isTTY) {
        if (chunk.includes("\n") || chunk.includes("\r")) {
          stdin.removeListener("data", onData);
          resolve();
        }
        return;
      }
      if (chunk === "\u0003") {
        aborted = true;
        stdin.removeListener("data", onData);
        resolve();
        return;
      }
      if (chunk === "\r" || chunk === "\n" || chunk === "\r\n") {
        stdin.removeListener("data", onData);
        resolve();
      }
    }
    stdin.on("data", onData);
  });

  if (isTTY) {
    stdin.setRawMode(wasRaw);
  }
  ctx.rl.resume();

  if (aborted) {
    console.log("\n" + label.system + " " + colors.warning("Recording aborted by user.\n"));
    try {
      await handle.stop();
      if (fs.existsSync(wavPath)) { fs.unlinkSync(wavPath); }
    } catch (e) {}
    return;
  }

  console.log("");
  const spinner = createSpinner("transcribe");
  spinner.start("Stopping recording and transcribing...");

  try {
    await handle.stop();
    const text = await transcribeAudioFile(wavPath, ctx.aiConfig);
    spinner.stop();

    if (fs.existsSync(wavPath)) {
      try { fs.unlinkSync(wavPath); } catch (e) {}
    }

    if (!text.trim()) {
      console.log("\n" + label.system + " " + colors.warning("No speech detected or transcription was empty.\n"));
      return;
    }

    console.log("\n" + label.system + " " + colors.success("✓ Transcribed text:"));
    console.log("  " + colors.text(`"${text}"`));
    console.log("");

    ctx.rl.write(text);
  } catch (err) {
    spinner.stop();
    if (fs.existsSync(wavPath)) {
      try { fs.unlinkSync(wavPath); } catch (e) {}
    }
    console.log("\n" + label.error + " " + colors.danger(`Transcription failed: ${err.message}\n`));
  }
}

