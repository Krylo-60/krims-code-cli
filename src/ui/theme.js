// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Dynamic Theme-Aware Formatting Utilities
// ═══════════════════════════════════════════════════════════

import chalk from "chalk";

// ── Theme Definitions ─────────────────────────────────────
export const THEMES = {
  cyberpunk: {
    accent:    "#00f0ff", // Neon cyan
    accent2:   "#bd93f9", // Neon purple/magenta
    accent3:   "#50fa7b", // Neon green
    danger:    "#ff5555", // Neon red
    warning:   "#ffb86c", // Neon orange
    muted:     "#6272a4", // Comment gray
    text:      "#f8f8f2", // Crisp white-yellow
    dim:       "#44475a", // Border gray
    brand:     "#00f0ff", // Neon cyan
    success:   "#50fa7b", // Neon green
    error:     "#ff5555",
    magenta:   "#ff79c6",
    orange:    "#ffb86c",
  },
  matrix: {
    accent:    "#50fa7b", // Lime green
    accent2:   "#00ff00", // Matrix green
    accent3:   "#8efb50", // Light lime
    danger:    "#ff5555",
    warning:   "#ffb86c",
    muted:     "#1f5f1f", // Dark forest green
    text:      "#aaffaa", // Soft green text
    dim:       "#103f10", // Dark green border
    brand:     "#50fa7b",
    success:   "#50fa7b",
    error:     "#ff5555",
    magenta:   "#50fa7b",
    orange:    "#8efb50",
  },
  synthwave: {
    accent:    "#ff79c6", // Neon pink
    accent2:   "#ffb86c", // Neon orange
    accent3:   "#bd93f9", // Neon purple
    danger:    "#ff5555",
    warning:   "#ffb86c",
    muted:     "#6f2a8a", // Dark purple
    text:      "#ffe8f5", // Soft pinkish white
    dim:       "#3e104f", // Deep purple border
    brand:     "#ff79c6",
    success:   "#bd93f9",
    error:     "#ff5555",
    magenta:   "#ff79c6",
    orange:    "#ffb86c",
  },
  crimson: {
    accent:    "#ff5555", // Neon red
    accent2:   "#ffb86c", // Gold/orange
    accent3:   "#f1fa8c", // Neon yellow
    danger:    "#ff5555",
    warning:   "#ffb86c",
    muted:     "#662222", // Muted red-gray
    text:      "#ffffff", // White text
    dim:       "#331111", // Dark red border
    brand:     "#ff5555",
    success:   "#f1fa8c",
    error:     "#ff5555",
    magenta:   "#ff5555",
    orange:    "#ffb86c",
  }
};

let activeThemeName = "cyberpunk";

// ── Dynamic Colors Resolver ───────────────────────────────
export const colors = new Proxy({}, {
  get(target, prop) {
    const theme = THEMES[activeThemeName] || THEMES.cyberpunk;
    const colorHex = theme[prop] || "#ffffff";
    const isBold = prop === "brand" || prop === "success" || prop === "error";
    
    let fn = chalk.hex(colorHex);
    if (isBold) {
      fn = fn.bold;
    }
    return fn;
  }
});

// ── Labels ────────────────────────────────────────────────
export const label = {
  get system() { return chalk.bgHex(activeThemeName === "cyberpunk" ? "#0c1825" : THEMES[activeThemeName].dim).hex(THEMES[activeThemeName].accent).bold(" SYSTEM "); },
  get user()   { return chalk.bgHex(activeThemeName === "cyberpunk" ? "#0c1825" : THEMES[activeThemeName].dim).hex(THEMES[activeThemeName].accent3).bold("   YOU  "); },
  get aether() { return chalk.bgHex(activeThemeName === "cyberpunk" ? "#0c1825" : THEMES[activeThemeName].dim).hex(THEMES[activeThemeName].accent).bold(" AETHER "); },
  get error()  { return chalk.bgHex(activeThemeName === "cyberpunk" ? "#2a0a14" : THEMES[activeThemeName].dim).hex(THEMES[activeThemeName].danger).bold("  ERROR "); },
  get info()   { return chalk.bgHex(activeThemeName === "cyberpunk" ? "#0c1825" : THEMES[activeThemeName].dim).hex(THEMES[activeThemeName].accent2).bold("   INFO "); },
  get config() { return chalk.bgHex(activeThemeName === "cyberpunk" ? "#0c1825" : THEMES[activeThemeName].dim).hex(THEMES[activeThemeName].warning).bold(" CONFIG "); },
  get math()   { return chalk.bgHex(activeThemeName === "cyberpunk" ? "#0c1825" : THEMES[activeThemeName].dim).hex(THEMES[activeThemeName].accent3).bold("   MATH "); },
  get krylo()  { return chalk.bgHex(activeThemeName === "cyberpunk" ? "#0c1825" : THEMES[activeThemeName].dim).hex(THEMES[activeThemeName].accent).bold("  KRYLO "); },
  get mode()   { return chalk.bgHex(activeThemeName === "cyberpunk" ? "#0c1825" : THEMES[activeThemeName].dim).hex(THEMES[activeThemeName].accent2).bold("   MODE "); },
  get mesh()   { return chalk.bgHex(activeThemeName === "cyberpunk" ? "#0c1825" : THEMES[activeThemeName].dim).hex(THEMES[activeThemeName].accent).bold("   MESH "); },
  get file()   { return chalk.bgHex(activeThemeName === "cyberpunk" ? "#0c1825" : THEMES[activeThemeName].dim).hex(THEMES[activeThemeName].warning).bold("   FILE "); },
};

// ── Formatting Helpers ───────────────────────────────────
export function separator(char = "─", length) {
  const width = process.stdout.columns || 80;
  const targetLength = length !== undefined ? length : Math.max(10, width - 4);
  return colors.dim(char.repeat(targetLength));
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
  const theme = THEMES[activeThemeName] || THEMES.cyberpunk;
  const badges = {
    synthesis: chalk.bgHex(activeThemeName === "cyberpunk" ? "#1a3a2a" : theme.dim).hex(theme.accent3).bold(" SYNTHESIS "),
    research:  chalk.bgHex(activeThemeName === "cyberpunk" ? "#1a2a3a" : theme.dim).hex(theme.accent2).bold(" RESEARCH "),
    architect: chalk.bgHex(activeThemeName === "cyberpunk" ? "#2a1a3a" : theme.dim).hex(theme.magenta).bold(" ARCHITECT "),
    titan:     chalk.bgHex(activeThemeName === "cyberpunk" ? "#1a2a3a" : theme.dim).hex(theme.accent).bold(" TITAN FUSION "),
  };
  return badges[mode?.toLowerCase()] || badges.titan;
}

/**
 * Backs up the cursor and clears terminal lines printed during real-time streaming
 * so they can be replaced by the final formatted response.
 * @param {string} text - The raw streamed text that was printed
 */
export function clearStreamedText(text) {
  if (!process.stdout.isTTY) return;
  const width = process.stdout.columns || 80;
  const lines = text.split("\n");
  let lineCount = 0;
  for (const line of lines) {
    lineCount += Math.max(1, Math.ceil(line.length / width));
  }
  if (lineCount > 0) {
    process.stdout.write(`\x1b[${lineCount}A\x1b[J`);
  }
}

// ── Theme State Management ────────────────────────────────

export function getActiveTheme() {
  return activeThemeName;
}

export function setTheme(themeName) {
  if (!themeName) return false;
  const name = themeName.toLowerCase().trim();
  if (THEMES[name]) {
    activeThemeName = name;
    return true;
  }
  return false;
}

export function getThemesList() {
  return Object.keys(THEMES);
}
