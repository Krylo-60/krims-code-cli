// ═══════════════════════════════════════════════════════════
// Krims Code AI CLI — Local Fallback Engine
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
 * Implements the Krylo companion bot fallback speaking clean English.
 * @param {string} prompt - The user prompt
 * @param {string[]} [errors] - Optional error messages from failed provider nodes
 * @returns {{ text: string, type: string }}
 */
export function generateOfflineReply(prompt, errors = []) {
  const clean = (prompt || "").trim().toLowerCase();
  let header = "🤖 [KRYLO COMPANION - OFFLINE MODE]";

  // Default Error/Quota Fallback
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

    const lines = [
      header,
      "⚠️ All configured AI provider nodes failed to respond.",
      ""
    ];
    if (isRateLimited) {
      lines.push("💡 [Rate Limit / Quota Exceeded]: One or more provider nodes hit their API usage limits.");
    }
    lines.push(
      "Errors encountered:",
      ...errors.map((e) => `• ${e}`),
      "",
      "Please check your API keys, network connection, or rate limits."
    );

    return {
      text: lines.join("\n"),
      type: "offline-error"
    };
  }

  let warning = "\n💡 Note: Running locally to conserve your API quota.";

  // Greetings
  if (/^(hello|hi|hey|greetings|yo|sup)\b/.test(clean)) {
    return {
      text: [
        header,
        warning,
        "",
        "Hello! I am Krylo, your offline companion for Krims Code CLI.",
        "I can help you with local math calculations (e.g. 2 + 2), status checks, or run simple hacking games.",
        "To converse with an advanced LLM, please configure an API key using:",
        "  krims-code config set GOOGLE_API_KEY <your_key_here>"
      ].join("\n"),
      type: "krylo-local"
    };
  }

  // Help / Commands
  if (clean.includes("help") || clean.includes("command") || clean.includes("shortcut")) {
    return {
      text: [
        header,
        warning,
        "",
        "💡 [Krims Code CLI QUICK CHEAT SHEET]",
        "   • /mode <name>      - Switch reasoning modes (synthesis, research, architect, titan)",
        "   • /attach <file>    - Attach a file for context (supports autocomplete)",
        "   • /git              - Launch interactive Git TUI & file stager checkbox menu",
        "   • /dashboard        - Launch local web telemetry dashboard HUD",
        "   • /autopilot debug  - Run autonomous debug loop to fix test failures",
        "   • /copy             - Copy the last response to clipboard",
        "   • /export           - Export conversation history to Markdown"
      ].join("\n"),
      type: "krylo-local"
    };
  }

  // Diagnostics / Status
  if (clean.includes("status") || clean.includes("hud") || clean.includes("cpu") || clean.includes("ping") || clean.includes("diagnostics")) {
    return {
      text: [
        header,
        warning,
        "",
        "📊 [SYSTEM DIAGNOSTIC READOUT]",
        "   • CPU Core Load: Nominal / Optimized",
        "   • Memory Usage: Active & stable",
        "   • Network Link: Standby / Offline local mesh active",
        "   • Failover Mesh: Ready to route prompts"
      ].join("\n"),
      type: "krylo-local"
    };
  }

  // Code / Programming
  if (clean.includes("code") || clean.includes("write") || clean.includes("program") || clean.includes("javascript") || clean.includes("python")) {
    return {
      text: [
        header,
        warning,
        "",
        "💻 [LOCAL CODE REFERENCE]",
        "Since I am running offline, I cannot write complex code for you. Here is a basic template:",
        "",
        "```javascript",
        "// Node.js entry template",
        "import fs from 'node:fs/promises';",
        "",
        "async function main() {",
        "  console.log('Krims Code offline node initialized.');",
        "}",
        "main();",
        "```",
        "",
        "Configure an API key to have Krims Code write, refactor, or debug code on your behalf!"
      ].join("\n"),
      type: "krylo-local"
    };
  }

  return {
    text: [
      header,
      warning,
      "",
      "No active API keys configured. Please set GOOGLE_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY in your config to start chatting.",
      "Example: krims-code config set GOOGLE_API_KEY <your-key>"
    ].join("\n"),
    type: "offline-error"
  };
}

