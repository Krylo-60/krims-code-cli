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
 * @param {string} prompt - The user prompt
 * @returns {string|null} The cleaned expression or null
 */
export function detectMathExpression(prompt) {
  const clean = prompt.replace(/\s+/g, "");
  if (/^[0-9+\-*/().%^]+$/.test(clean) && /[+\-*/%^]/.test(clean)) {
    return clean;
  }
  return null;
}

/**
 * Safely evaluates a mathematical expression.
 * @param {string} expression - A sanitized math expression
 * @returns {{ text: string, type: string }|null}
 */
export function solveMath(expression) {
  if (!expression) return null;
  try {
    if (!/^[0-9+\-*/().%^]+$/.test(expression)) return null;
    // Convert ^ to ** for exponentiation
    const jsExpr = expression.replace(/\^/g, "**");
    const result = Function(`"use strict"; return (${jsExpr})`)();
    if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
      return {
        text: [
          "🤖 [LOCAL MATH SOLVER]",
          `   Expression: ${expression}`,
          `   Result: ${result}`,
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
