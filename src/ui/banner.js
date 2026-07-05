// ═══════════════════════════════════════════════════════════
// Krims Code AI CLI — ASCII Art Welcome Banner
// ═══════════════════════════════════════════════════════════

import os from "node:os";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import chalk from "chalk";
import { colors, separator, modeBadge, getIcon } from "./theme.js";
import { getActiveProviders } from "../ai/providers.js";
import { MODES } from "../modes.js";
import { getConfigPath } from "../config.js";

// ANSI escape code strip regex
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

function getVisibleLength(str) {
  return str.replace(ANSI_REGEX, "").length;
}

function loadConfigSync() {
  try {
    const configPath = getConfigPath();
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    // Ignore
  }
  return {};
}

/**
 * Displays the cyberpunk-styled Krims Code ASCII art banner and OpenCode-style system info.
 * @param {string} [currentMode='titan'] - The currently active mode name
 */
export function showBanner(currentMode = "titan") {
  const c1 = chalk.hex('#FF3E3E'); // Red-Orange
  const c2 = chalk.hex('#FF8500'); // Orange
  const c3 = chalk.hex('#FFD000'); // Yellow
  const c4 = chalk.hex('#00F2FF'); // Cyan
  const c5 = chalk.hex('#0085FF'); // Blue
  const c6 = chalk.hex('#7000FF'); // Violet
  const c7 = chalk.hex('#B000FF'); // Purple
  const dim = colors.dim;

  // 1. Fetch User & System Context
  let username = "Explorer";
  try {
    username = os.userInfo().username;
  } catch (e) {
    username = process.env.USER || process.env.USERNAME || "Explorer";
  }

  const cwd = process.cwd();
  const home = homedir();
  let displayCwd = cwd;
  if (cwd.startsWith(home)) {
    displayCwd = "~" + cwd.slice(home.length);
  }

  const config = loadConfigSync();
  const active = getActiveProviders(config);

  const activeNames = active.length > 0
    ? [...new Set(active.map(a => a.provider.name))].join(", ")
    : "Local math & offline logic only";

  const meshStatusText = active.length > 0
    ? colors.success(`● Online (${active.length} active node${active.length === 1 ? "" : "s"})`)
    : colors.warning(`○ Offline (Local fallbacks active)`);

  const modeDetails = MODES[currentMode.toLowerCase()] || MODES.titan;
  const modeText = modeBadge(currentMode) || colors.accent.bold(modeDetails.label);

  const shortDescriptions = {
    synthesis: "Balanced reasoning with clean structure.",
    research:  "Deep analysis with evidence-based reasoning.",
    architect: "Systems thinking with build plans.",
    titan:     "Ultimate reasoning fusion of Codex & Claude Code.",
  };
  const desc = shortDescriptions[currentMode.toLowerCase()] || shortDescriptions.titan;

  let version = "1.3.8";
  try {
    const pkgUrl = new URL("../../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgUrl, "utf-8"));
    version = pkg.version || "1.3.8";
  } catch (e) {
    // Fallback
  }

  // 2. Render side-by-side logo and system info
  const columns = process.stdout.columns || 80;
  const boxWidth = Math.max(76, Math.min(90, columns - 4));
  const maxValueWidth = boxWidth - 30;

  // Truncate values to fit the screen cleanly
  let workspaceValue = displayCwd;
  if (workspaceValue.length > maxValueWidth) {
    workspaceValue = "..." + workspaceValue.slice(-(maxValueWidth - 3));
  }

  let engineValue = activeNames;
  if (engineValue.length > maxValueWidth) {
    engineValue = engineValue.slice(0, maxValueWidth - 3) + "...";
  }

  const modeBadgeText = getVisibleLength(modeText);
  const maxDescWidth = maxValueWidth - modeBadgeText - 3;
  let descValue = desc;
  if (descValue.length > maxDescWidth) {
    descValue = descValue.slice(0, Math.max(10, maxDescWidth - 3)) + "...";
  }
  const modeRowValue = `${modeText} ${colors.dim(`— ${descValue}`)}`;

  const packagerText = process.env.KRIMS_PACKAGER === "pip"
    ? "pip (krims-code-cli)"
    : "npm (@krishivpb60/krims-code-cli)";

  const logo = [
    c1("  █▄     ▄█"),
    c2("  ██    ██ "),
    c3("  ██ ▄█    "),
    c4("  ███▀     "),
    c5("  ██ ▀█    "),
    c6("  ██    ██ "),
    c7("  █▀     ▀█")
  ];

  const info = [
    `   ⚡ ${colors.brand("KRIMS CODE COMMAND STATION v" + version)} • Welcome back, ${colors.accent(username)}`,
    dim(`   ${"─".repeat(Math.max(40, boxWidth - 18))}`),
    `     ${colors.muted(getIcon("workspace", config) + "Workspace")} : ${colors.text(workspaceValue)}`,
    `     ${colors.muted(getIcon("mode", config) + "Mode")}      : ${modeRowValue}`,
    `     ${colors.muted(getIcon("network", config) + "Network")}   : ${meshStatusText}`,
    `     ${colors.muted(getIcon("engine", config) + "Engine")}    : ${colors.text(engineValue)}`,
    `     ${colors.muted(getIcon("package", config) + "Packager")}  : ${colors.text(packagerText)}`
  ];

  console.log("");
  for (let i = 0; i < 7; i++) {
    console.log(logo[i] + info[i]);
  }
  console.log("");

  // 4. Quick Starter Cards (two columns)
  const starters = [
    { cmd: "/explain", desc: "Analyze files in workspace" },
    { cmd: "/review",  desc: "Review git changes (diffs)" },
    { cmd: "/diagnose",desc: "Auto-heal failing tests" },
    { cmd: "/dashboard",desc: "Launch visual telemetry HUD" },
    { cmd: "/autopilot",desc: "Start autonomous debug loop" },
    { cmd: "/game",    desc: "Play mainframe hacking game" },
  ];

  console.log(`\n  ⚡ ${colors.brand("QUICK COMMAND STARTERS")}`);
  if (boxWidth >= 80) {
    // Print 2 columns
    for (let i = 0; i < starters.length; i += 2) {
      const s1 = starters[i];
      const s2 = starters[i + 1];

      const col1 = `   ${colors.accent(s1.cmd.padEnd(11))} ${colors.text(s1.desc.padEnd(28))}`;
      const col2 = s2 ? `   ${colors.accent(s2.cmd.padEnd(11))} ${colors.text(s2.desc)}` : "";

      console.log(col1 + col2);
    }
  } else {
    // Print 1 column
    for (const s of starters) {
      console.log(`   ${colors.accent(s.cmd.padEnd(11))} ${colors.text(s.desc)}`);
    }
  }

  // 5. Help / Footer info
  console.log("\n" + separator("─"));
  const footer = [
    colors.dim("  Press "),
    colors.accent("Tab"),
    colors.dim(" to autocomplete file paths • Type "),
    colors.accent("/help"),
    colors.dim(" for all commands • "),
    colors.accent("Ctrl+C"),
    colors.dim(" to exit session")
  ].join("");
  console.log(footer);
  console.log(separator("─") + "\n");
}
