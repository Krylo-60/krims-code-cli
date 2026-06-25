// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — ASCII Art Welcome Banner
// ═══════════════════════════════════════════════════════════

import chalk from "chalk";
import { colors, separator, bullet } from "./theme.js";

/**
 * Displays the cyberpunk-styled Aether ASCII art banner.
 * @param {string} [currentMode='titan'] - The currently active mode name
 */
export function showBanner(currentMode = "titan") {
  const c1 = chalk.hex("#6ce8ff");
  const c2 = chalk.hex("#2d7dff");
  const c3 = chalk.hex("#67ffb0");
  const dim = chalk.hex("#3a5a6f");

  const art = [
    "",
    c1("  ╔═══════════════════════════════════════════════════════════╗"),
    c1("  ║") + c2("     █████╗ ███████╗████████╗██╗  ██╗███████╗██████╗    ") + c1("║"),
    c1("  ║") + c2("    ██╔══██╗██╔════╝╚══██╔══╝██║  ██║██╔════╝██╔══██╗   ") + c1("║"),
    c1("  ║") + c1("    ███████║█████╗     ██║   ████████║█████╗  ██████╔╝   ") + c1("║"),
    c1("  ║") + c3("    ██╔══██║██╔══╝     ██║   ██╔══██║██╔══╝  ██╔══██╗   ") + c1("║"),
    c1("  ║") + c3("    ██║  ██║███████╗   ██║   ██║  ██║███████╗██║  ██║   ") + c1("║"),
    c1("  ║") + dim("    ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ") + c1("║"),
    c1("  ╚═══════════════════════════════════════════════════════════╝"),
    "",
    c1("  ⚡ ") + colors.text.bold("Aether Core AI v110") + colors.dim(" — Fusion Command Station"),
    c2("  ◈  ") + colors.muted(`Active Mode: `) + modeLabel(currentMode),
    "",
    separator("─", 62),
    "",
    bullet("Type your prompt and press " + colors.accent("Enter") + " to query."),
    bullet("Use " + colors.accent("/help") + " for all commands."),
    bullet("Use " + colors.accent("/mode <name>") + " to switch reasoning mode."),
    bullet("Use " + colors.accent("/attach <file>") + " to add file context."),
    bullet("Use " + colors.accent("/exit") + " or " + colors.accent("Ctrl+C") + " to quit."),
    "",
    separator("─", 62),
    "",
  ];

  console.log(art.join("\n"));
}

/**
 * Gets a styled label for the given mode.
 * @param {string} mode - Mode name
 * @returns {string} Styled mode label
 */
function modeLabel(mode) {
  const labels = {
    synthesis: chalk.hex("#67ffb0").bold("Synthesis v2.5"),
    research:  chalk.hex("#2d7dff").bold("Research v104"),
    architect: chalk.hex("#b06cff").bold("Architect v55"),
    titan:     chalk.hex("#6ce8ff").bold("Titan Fusion v110"),
  };
  return labels[mode?.toLowerCase()] || labels.titan;
}
