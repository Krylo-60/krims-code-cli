// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Local Fallback Engine
// Math Solver + Krylo Companion Bot
// ═══════════════════════════════════════════════════════════

const KRYLO_REPLIES = [
  "Affirmative, commander. Systems are running at peak cybernetic capacity.",
  "Neon grids initialized. Matrix color modulates are at nominal density.",
  "Warning: Solar flare activity detected. Detuning audio synth harmonics by 18.4% to compensate.",
  "Neural nodes synchronized. Analyzing the portfolio's glassmorphic boundaries.",
  "I am Krylo, your holographic companion terminal. Ready to warp index nodes.",
  "Ecosystem diagnostics complete. 0 memory leaks, 100% premium responsive UI."
];

/**
 * Detects if a prompt is a pure mathematical expression.
 * Supports basic operators, parentheses, standard math functions, and constants.
 * @param {string} prompt - The user prompt
 * @returns {string|null} The cleaned expression or null
 */
export function detectMathExpression(prompt) {
  const clean = prompt.replace(/\s+/g, "").toLowerCase();
  
  // Check if it's a word-based status query
  if (clean === "status" || clean === "hud") return null;

  // Strip allowed function and constant words
  const structure = clean.replace(/sin|cos|tan|log|ln|sqrt|pi|e|abs/g, "");
  
  // Must be composed of valid math characters, AND contain either a math operator or an active function call
  if (/^[0-9+\-*/().%^]+$/.test(structure)) {
    const hasOperator = /[+\-*/%^]/.test(structure);
    const hasFunction = /(sin|cos|tan|log|ln|sqrt|abs)\(/.test(clean);
    if (hasOperator || hasFunction) {
      return clean;
    }
  }
  return null;
}

/**
 * Safely evaluates a mathematical expression locally.
 * Supports trig, square root, natural/base-10 logs, absolute values, pi, and e.
 * @param {string} expression - A sanitized math expression
 * @returns {{ text: string, type: string }|null}
 */
export function solveMath(expression) {
  if (!expression) return null;
  try {
    const clean = expression.replace(/\s+/g, "").toLowerCase();
    
    // Validate character structure
    const structure = clean.replace(/sin|cos|tan|log|ln|sqrt|pi|e|abs/g, "");
    if (!/^[0-9+\-*/().%^]+$/.test(structure)) return null;

    // Convert terms to JavaScript Math equivalents
    let jsExpr = clean
      .replace(/\^/g, "**")
      .replace(/sin\(/g, "Math.sin(")
      .replace(/cos\(/g, "Math.cos(")
      .replace(/tan\(/g, "Math.tan(")
      .replace(/log\(/g, "Math.log10(")
      .replace(/ln\(/g, "Math.log(")
      .replace(/sqrt\(/g, "Math.sqrt(")
      .replace(/abs\(/g, "Math.abs(")
      .replace(/\bpi\b/g, "Math.PI")
      .replace(/\be\b/g, "Math.E");

    const result = Function(`"use strict"; return (${jsExpr})`)();
    if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
      return {
        text: [
          "🤖 [LOCAL MATH SOLVER]",
          `   Expression: ${expression}`,
          `   Result: ${Number(result.toFixed(6))}`,
        ].join("\n"),
        type: "local-math",
      };
    }
  } catch {
    // Not a valid expression
  }
  return null;
}

/**
 * Starts a mainframe security bypass mini-game.
 * @returns {{ text: string, type: string }}
 */
export function runMainframeHack() {
  return {
    text: [
      "⚡ [LOCAL TERMINAL SECURITY BYPASS GAME]",
      "   MAINFRAME HACK PROTOCOL LOADED.",
      "   ────────────────────────────────────────",
      "   Objective: Bypass security by guessing the 4-digit PIN (digits 0-9).",
      "   For each guess, you will get feedback:",
      "     • 'Hit'   - correct digit in correct position.",
      "     • 'Close' - correct digit but in wrong position.",
      "   You have 6 attempts before security lock-out.",
      "   ",
      "   Type `/guess <number>` to input breach code (e.g. /guess 2941)",
      "   To abort, type `/abort`.",
      "   ────────────────────────────────────────",
    ].join("\n"),
    type: "mainframe-game",
  };
}

/**
 * Generates a local Krylo companion reply based on keywords.
 * @param {string} prompt - The user prompt
 * @returns {{ text: string, type: string }}
 */
export function generateKryloReply(prompt) {
  const clean = prompt.toLowerCase();

  if (clean.includes("help") || clean.includes("shortcut") || clean.includes("command")) {
    return {
      text: [
        "💡 [SYSTEM DECK CHEAT SHEET]",
        "   • Use `Ctrl + K` to open the Portal Search.",
        "   • Use `Ctrl + Shift + L` to open the Links Directory.",
        "   • Trigger Konami Code `↑↑↓↓←→←→BA` to launch Matrix mode!",
        "   • Type `/mode <name>` to switch reasoning modes.",
        "   • Type `/attach <file>` to inject file context.",
        "   • Type `/export` to save the conversation.",
      ].join("\n"),
      type: "krylo-local",
    };
  }

  if (clean.includes("status") || clean.includes("hud") || clean.includes("cpu") || clean.includes("ping") || clean.includes("diagnostics")) {
    return {
      text: [
        "📊 [LIVE DIAGNOSTIC READOUT]",
        "   • CPU Core Load: 15.4% (Optimized)",
        "   • Ping Latency: 12ms (Hyper-Fast)",
        "   • Memory Usage: 247MB / 8192MB",
        "   • Canvas Sparklines: Active and tracking vectors",
        "   • Failover Mesh: All 12 nodes standing by",
      ].join("\n"),
      type: "krylo-local",
    };
  }

  if (clean.includes("matrix") || clean.includes("rain") || clean.includes("color")) {
    return {
      text: [
        "⚡ [NEURAL GRIDS MODULATION]",
        "   • Five stream channels active:",
        "     Classic Green, Cyber Cyan, Neon Purple,",
        "     Overdrive Red, Golden Matrix.",
        "   • Detuned Web Audio frequency active.",
        "   • Matrix rain density: 94.2%",
      ].join("\n"),
      type: "krylo-local",
    };
  }

  if (clean.includes("who") || clean.includes("name") || clean.includes("creator")) {
    return {
      text: [
        "🤖 [HOLOGRAPHIC COMPANION PROTOCOL]",
        "   • Identification: Krylo (Nexus Companion)",
        "   • Purpose: Pair-programming assistant & Commander companion",
        "   • Creator: Krishiv PB — The Master Coder",
        "   • Version: Aether Core AI v110 — Fusion Build",
      ].join("\n"),
      type: "krylo-local",
    };
  }

  const index = Math.floor(Math.random() * KRYLO_REPLIES.length);
  return {
    text: `🤖 [KRYLO TERMINAL RESPONSE]\n   ${KRYLO_REPLIES[index]}`,
    type: "krylo-local",
  };
}
