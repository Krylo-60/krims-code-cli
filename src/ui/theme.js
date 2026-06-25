// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Color Theme & Formatting Utilities
// ═══════════════════════════════════════════════════════════

import chalk from "chalk";

// ── Core Palette ──────────────────────────────────────────
export const colors = {
  accent:    chalk.hex("#6ce8ff"),       // Cyan neon
  accent2:   chalk.hex("#2d7dff"),       // Deep blue
  accent3:   chalk.hex("#67ffb0"),       // Mint green
  danger:    chalk.hex("#ff6b8d"),       // Coral red
  warning:   chalk.hex("#ffb900"),       // Amber
  muted:     chalk.hex("#9db5c8"),       // Slate blue
  text:      chalk.hex("#eff8ff"),       // Near-white
  dim:       chalk.hex("#5a7a8f"),       // Faded slate
  brand:     chalk.hex("#6ce8ff").bold,  // Aether brand
  success:   chalk.hex("#67ffb0").bold,  // Success green
  error:     chalk.hex("#ff6b8d").bold,  // Error red
};

// ── Labels ────────────────────────────────────────────────
export const label = {
  system:    chalk.bgHex("#0c1825").hex("#6ce8ff").bold(" SYSTEM "),
  user:      chalk.bgHex("#0c1825").hex("#67ffb0").bold("   YOU  "),
  aether:    chalk.bgHex("#0c1825").hex("#6ce8ff").bold(" AETHER "),
  error:     chalk.bgHex("#2a0a14").hex("#ff6b8d").bold("  ERROR "),
  info:      chalk.bgHex("#0c1825").hex("#2d7dff").bold("   INFO "),
  config:    chalk.bgHex("#0c1825").hex("#ffb900").bold(" CONFIG "),
  math:      chalk.bgHex("#0c1825").hex("#67ffb0").bold("   MATH "),
  krylo:     chalk.bgHex("#0c1825").hex("#6ce8ff").bold("  KRYLO "),
  mode:      chalk.bgHex("#0c1825").hex("#2d7dff").bold("   MODE "),
  mesh:      chalk.bgHex("#0c1825").hex("#6ce8ff").bold("   MESH "),
  file:      chalk.bgHex("#0c1825").hex("#ffb900").bold("   FILE "),
};

// ── Formatting Helpers ───────────────────────────────────
export function separator(char = "─", length = 60) {
  return colors.dim(char.repeat(length));
}

export function heading(text) {
  return colors.brand(`\n  ${text}\n`) + separator();
}

export function keyValue(key, value) {
  return `  ${colors.muted(key + ":")} ${colors.text(value)}`;
}

export function bullet(text) {
  return `  ${colors.accent("›")} ${colors.text(text)}`;
}

export function modeBadge(mode) {
  const badges = {
    synthesis: chalk.bgHex("#1a3a2a").hex("#67ffb0").bold(" SYNTHESIS "),
    research:  chalk.bgHex("#1a2a3a").hex("#2d7dff").bold(" RESEARCH "),
    architect: chalk.bgHex("#2a1a3a").hex("#b06cff").bold(" ARCHITECT "),
    titan:     chalk.bgHex("#1a2a3a").hex("#6ce8ff").bold(" TITAN FUSION "),
  };
  return badges[mode?.toLowerCase()] || badges.titan;
}
