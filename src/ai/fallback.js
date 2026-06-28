// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Local Fallback Engine
// Math Solver & Offline Fallback
// ═══════════════════════════════════════════════════════════

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
 * Generates a local offline/error reply when no AI keys are configured or fail.
 * @param {string} prompt - The user prompt
 * @param {string[]} [errors] - Optional error messages from failed provider nodes
 * @returns {{ text: string, type: string }}
 */
export function generateOfflineReply(prompt, errors = []) {
  if (errors && errors.length > 0) {
    const isRateLimited = errors.some((e) => {
      const lower = e.toLowerCase();
      return (
        lower.includes("quota") ||
        lower.includes("rate limit") ||
        lower.includes("rate-limit") ||
        lower.includes("429") ||
        lower.includes("resource_exhausted") ||
        lower.includes("limit exceeded")
      );
    });

    const lines = ["⚠️  All configured AI provider nodes failed to respond."];
    if (isRateLimited) {
      lines.push("    💡 [Rate Limit / Quota Exceeded]: One or more provider nodes hit their API usage limits.");
    }
    lines.push(
      "    Errors encountered:",
      ...errors.map((e) => `    • ${e}`),
      "",
      "    Please check your API keys, network connection, or rate limits."
    );

    return {
      text: lines.join("\n"),
      type: "offline-error"
    };
  }
  return {
    text: [
      "⚠️  No active API keys configured. Please set GOOGLE_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY in your config to start chatting.",
      "    Example: aether config set GOOGLE_API_KEY <your-key>"
    ].join("\n"),
    type: "offline-error"
  };
}
