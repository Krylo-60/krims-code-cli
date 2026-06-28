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

/**
 * Filter stream tokens on the fly to suppress file write blocks
 * and print a cleaner placeholder badge in real-time instead of raw code.
 */
export class StreamFilter {
  constructor(writeFn) {
    this.writeFn = writeFn;
    this.buffer = "";
    this.cursor = 0;
    this.state = "NORMAL"; // "NORMAL", "COLLECTING_FILENAME", "SUPPRESSING"
    this.filenameBuffer = "";
    this.filteredText = "";
  }

  _write(text) {
    this.writeFn(text);
    this.filteredText += text;
  }

  write(token) {
    this.buffer += token;
    this.process();
  }

  process() {
    const writeTag = "[WRITE_FILE:";
    const endTag = "[END_WRITE]";

    while (this.cursor < this.buffer.length) {
      if (this.state === "NORMAL") {
        const nextIndex = this.buffer.indexOf(writeTag, this.cursor);
        if (nextIndex !== -1) {
          if (nextIndex > this.cursor) {
            this._write(this.buffer.slice(this.cursor, nextIndex));
          }
          this.cursor = nextIndex + writeTag.length;
          this.state = "COLLECTING_FILENAME";
          this.filenameBuffer = "";
        } else {
          // Check for partial match of writeTag at the end of the buffer
          let partialMatchLength = 0;
          for (let i = 1; i < writeTag.length; i++) {
            const part = writeTag.slice(0, i);
            if (this.buffer.endsWith(part)) {
              partialMatchLength = i;
              break;
            }
          }
          const safeEnd = this.buffer.length - partialMatchLength;
          if (safeEnd > this.cursor) {
            this._write(this.buffer.slice(this.cursor, safeEnd));
            this.cursor = safeEnd;
          }
          break; // Wait for more tokens
        }
      } else if (this.state === "COLLECTING_FILENAME") {
        const closeIndex = this.buffer.indexOf("]", this.cursor);
        if (closeIndex !== -1) {
          this.filenameBuffer += this.buffer.slice(this.cursor, closeIndex);
          const filename = this.filenameBuffer.trim();
          this._write(`\n\n${colors.brand("⚡ [File creation request: " + filename + "]")}\n\n`);
          this.cursor = closeIndex + 1;
          this.state = "SUPPRESSING";
        } else {
          this.filenameBuffer += this.buffer.slice(this.cursor);
          this.cursor = this.buffer.length;
          break; // Wait for more tokens
        }
      } else if (this.state === "SUPPRESSING") {
        const nextIndex = this.buffer.indexOf(endTag, this.cursor);
        if (nextIndex !== -1) {
          this.cursor = nextIndex + endTag.length;
          this.state = "NORMAL";
        } else {
          // Check for partial match of endTag at the end of the buffer
          let partialMatchLength = 0;
          for (let i = 1; i < endTag.length; i++) {
            const part = endTag.slice(0, i);
            if (this.buffer.endsWith(part)) {
              partialMatchLength = i;
              break;
            }
          }
          const safeEnd = this.buffer.length - partialMatchLength;
          if (safeEnd > this.cursor) {
            this.cursor = safeEnd;
          }
          break; // Wait for more tokens
        }
      }
    }
  }

  flush() {
    if (this.state === "NORMAL" && this.cursor < this.buffer.length) {
      this._write(this.buffer.slice(this.cursor));
      this.cursor = this.buffer.length;
    }
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

export function stripCodeFences(content) {
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    const firstNewline = cleaned.indexOf("\n");
    if (firstNewline !== -1) {
      cleaned = cleaned.slice(firstNewline + 1);
    } else {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
  }
  return cleaned.trim();
}

/**
 * Interactive checkbox selector inside terminal using raw stdin. Renders scrollable pagination.
 * Arrow Up/Down to navigate, Space to toggle, Enter to confirm, Esc/q to abort.
 */
export async function interactiveCheckbox(headerText, items, preselected = []) {
  if (items.length === 0) return [];

  const stdin = process.stdin;
  const stdout = process.stdout;
  
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  stdout.write("\x1b[?25l"); // Hide cursor

  let activeIndex = 0;
  const selected = new Set(preselected.map(item => items.indexOf(item)).filter(i => i !== -1));
  
  const PAGE_SIZE = 10;
  let startRow = 0;
  let renderedLines = 0;

  function render() {
    if (renderedLines > 0) {
      stdout.write(`\x1b[${renderedLines}A\x1b[J`);
    }

    let lines = [];
    lines.push(colors.brand(headerText));

    if (activeIndex < startRow) {
      startRow = activeIndex;
    } else if (activeIndex >= startRow + PAGE_SIZE) {
      startRow = activeIndex - PAGE_SIZE + 1;
    }

    const visibleEnd = Math.min(items.length, startRow + PAGE_SIZE);
    for (let i = startRow; i < visibleEnd; i++) {
      const isActive = i === activeIndex;
      const isSelected = selected.has(i);

      const pointer = isActive ? colors.accent("❯ ") : "  ";
      const checkbox = isSelected 
        ? colors.success("[⬢] ") 
        : colors.muted("[⬡] ");
      
      const itemText = isActive 
        ? colors.brand(items[i]) 
        : colors.text(items[i]);

      lines.push(pointer + checkbox + itemText);
    }

    if (items.length > PAGE_SIZE) {
      lines.push(colors.dim(`  (Arrow Keys, Page ${Math.floor(startRow/PAGE_SIZE) + 1}/${Math.ceil(items.length/PAGE_SIZE)})`));
    }

    const outputStr = lines.join("\n") + "\n";
    stdout.write(outputStr);
    renderedLines = lines.length;
  }

  render();

  return new Promise((resolve) => {
    function handleKey(key) {
      if (key === "\u0003" || key === "\u001b" || key === "q") { // Ctrl+C, Esc, q
        cleanup();
        resolve(null);
        return;
      }

      if (key === "\r" || key === "\n") { // Enter
        cleanup();
        resolve([...selected].map(i => items[i]));
        return;
      }

      if (key === " ") { // Spacebar
        if (selected.has(activeIndex)) {
          selected.delete(activeIndex);
        } else {
          selected.add(activeIndex);
        }
        render();
        return;
      }

      if (key === "\u001b[A") { // Up Arrow
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        render();
      } else if (key === "\u001b[B") { // Down Arrow
        activeIndex = (activeIndex + 1) % items.length;
        render();
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
 * Interactive single-select menu selector inside terminal. Renders scrollable pagination.
 * Arrow Up/Down to navigate, Enter to select, Esc/q to abort.
 */
export async function interactiveMenu(headerText, items) {
  if (items.length === 0) return null;

  const stdin = process.stdin;
  const stdout = process.stdout;
  
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  stdout.write("\x1b[?25l"); // Hide cursor

  let activeIndex = 0;
  const PAGE_SIZE = 10;
  let startRow = 0;
  let renderedLines = 0;

  function render() {
    if (renderedLines > 0) {
      stdout.write(`\x1b[${renderedLines}A\x1b[J`);
    }

    let lines = [];
    lines.push(colors.brand(headerText));

    if (activeIndex < startRow) {
      startRow = activeIndex;
    } else if (activeIndex >= startRow + PAGE_SIZE) {
      startRow = activeIndex - PAGE_SIZE + 1;
    }

    const visibleEnd = Math.min(items.length, startRow + PAGE_SIZE);
    for (let i = startRow; i < visibleEnd; i++) {
      const isActive = i === activeIndex;
      const pointer = isActive ? colors.accent("❯ ") : "  ";
      const itemText = isActive 
        ? colors.success(items[i]) 
        : colors.text(items[i]);

      lines.push(pointer + itemText);
    }

    if (items.length > PAGE_SIZE) {
      lines.push(colors.dim(`  (Page ${Math.floor(startRow/PAGE_SIZE) + 1}/${Math.ceil(items.length/PAGE_SIZE)})`));
    }

    const outputStr = lines.join("\n") + "\n";
    stdout.write(outputStr);
    renderedLines = lines.length;
  }

  render();

  return new Promise((resolve) => {
    function handleKey(key) {
      if (key === "\u0003" || key === "\u001b" || key === "q") { // Ctrl+C, Esc, q
        cleanup();
        resolve(null);
        return;
      }

      if (key === "\r" || key === "\n") { // Enter
        cleanup();
        resolve(activeIndex);
        return;
      }

      if (key === "\u001b[A") { // Up Arrow
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        render();
      } else if (key === "\u001b[B") { // Down Arrow
        activeIndex = (activeIndex + 1) % items.length;
        render();
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
 * Returns either a premium Nerd Font glyph or a standard Unicode emoji fallback
 * depending on whether NERD_FONTS is enabled in the configuration.
 * @param {string} name - Icon name
 * @param {object} config - Active configuration object
 * @returns {string}
 */
export function getIcon(name, config) {
  const useNerd = config?.NERD_FONTS === true || config?.NERD_FONTS === "true";
  
  const icons = {
    workspace: useNerd ? "\uf07c " : "📂 ",
    mode:      useNerd ? "\uf0e0 " : "🧠 ", // brain / envelope-like modes icon
    network:   useNerd ? "\uf6ff " : "🟢 ", // network icon
    engine:    useNerd ? "\uf013 " : "⚙️  ", // gear icon
    package:   useNerd ? "\uf1b2 " : "📦 ", // package icon
    mic:       useNerd ? "\uf130 " : "🎤 ", // microphone icon
    git:       useNerd ? "\uf113 " : "🌿 ", // git/leaf icon
    dashboard: useNerd ? "\uf201 " : "📊 ", // chart icon
    bolt:      useNerd ? "\uf0e7 " : "⚡ ", // lightning bolt icon
  };

  return icons[name] || "";
}

/**
 * Zero-dependency dynamic theme-aware code block syntax highlighting.
 * @param {string} code - The raw code to highlight
 * @param {string} lang - The code block language (e.g. javascript, python, etc.)
 * @returns {string} Colored code for terminal output
 */
export function highlightCode(code, lang) {
  if (!lang) return colors.orange(code);
  const l = lang.toLowerCase().trim();

  // Theme-aware colors from the active theme proxy
  const kwColor = colors.magenta;       // keywords
  const strColor = colors.success;      // strings
  const commentColor = colors.muted;    // comments
  const numColor = colors.accent2;      // numbers
  const fnColor = colors.accent;        // function calls
  const opColor = colors.warning;       // operators

  if (l === "javascript" || l === "js" || l === "typescript" || l === "ts" || l === "json") {
    let result = code;

    // Comments
    const comments = [];
    result = result.replace(/(\/\*[\s\S]*?\*\/|\/\/.*)/g, (match) => {
      comments.push(commentColor(match));
      return `__COMMENT_PLACEHOLDER_${comments.length - 1}__`;
    });

    // Strings
    const strings = [];
    result = result.replace(/(["'`])(?:\\.|[^\\])*?\1/g, (match) => {
      strings.push(strColor(match));
      return `__STRING_PLACEHOLDER_${strings.length - 1}__`;
    });

    // Keywords
    const keywords = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|import|export|from|class|extends|new|this|async|await|try|catch|finally|throw|typeof|instanceof|in|of|null|undefined|true|false|void|delete|debugger)\b/g;
    result = result.replace(keywords, (m) => kwColor(m));

    // Numbers
    result = result.replace(/\b(\d+(?:\.\d+)?)\b/g, (m) => numColor(m));

    // Function calls
    result = result.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*\()/g, (m) => fnColor(m));

    // Operators
    result = result.replace(/([+\-*/%=<>!&|^~]+)/g, (m) => opColor(m));

    // Restore strings and comments
    result = result.replace(/__STRING_PLACEHOLDER_(\d+)__/g, (_, idx) => strings[parseInt(idx, 10)]);
    result = result.replace(/__COMMENT_PLACEHOLDER_(\d+)__/g, (_, idx) => comments[parseInt(idx, 10)]);

    return result;
  }

  if (l === "python" || l === "py") {
    let result = code;

    const comments = [];
    result = result.replace(/(#.*)/g, (match) => {
      comments.push(commentColor(match));
      return `__COMMENT_PLACEHOLDER_${comments.length - 1}__`;
    });

    const strings = [];
    result = result.replace(/(["'])(?:\\.|[^\\])*?\1/g, (match) => {
      strings.push(strColor(match));
      return `__STRING_PLACEHOLDER_${strings.length - 1}__`;
    });

    const keywords = /\b(def|class|return|if|elif|else|for|while|break|continue|import|from|as|in|is|not|and|or|try|except|finally|raise|assert|with|lambda|pass|global|nonlocal|None|True|False)\b/g;
    result = result.replace(keywords, (m) => kwColor(m));

    result = result.replace(/\b(\d+(?:\.\d+)?)\b/g, (m) => numColor(m));
    result = result.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*\()/g, (m) => fnColor(m));

    result = result.replace(/__STRING_PLACEHOLDER_(\d+)__/g, (_, idx) => strings[parseInt(idx, 10)]);
    result = result.replace(/__COMMENT_PLACEHOLDER_(\d+)__/g, (_, idx) => comments[parseInt(idx, 10)]);

    return result;
  }

  if (l === "html" || l === "xml" || l === "svg") {
    let result = code;
    result = result.replace(/(<\/?[a-zA-Z0-9:-]+)/g, (m) => kwColor(m));
    result = result.replace(/(\/?>)/g, (m) => kwColor(m));
    result = result.replace(/(="[^"]*")/g, (match) => "=" + strColor(match.slice(1)));
    return result;
  }

  if (l === "css") {
    let result = code;
    result = result.replace(/([a-zA-Z0-9_#-]+)\s*:/g, (m, p1) => fnColor(p1) + ":");
    result = result.replace(/:\s*([^;]+);/g, (match, p1) => ": " + numColor(p1) + ";");
    result = result.replace(/(\.[a-zA-Z0-9_-]+)/g, (m) => kwColor(m));
    result = result.replace(/(#[a-zA-Z0-9_-]+)/g, (m) => opColor(m));
    return result;
  }

  if (l === "bash" || l === "sh" || l === "cmd" || l === "powershell" || l === "ps1") {
    let result = code;
    result = result.replace(/(#.*)/g, (m) => commentColor(m));
    const keywords = /\b(echo|cd|ls|dir|pwd|git|npm|node|pip|python|mkdir|rm|cp|mv|cat|grep|tail|head)\b/g;
    result = result.replace(keywords, (m) => kwColor(m));
    return result;
  }

  return colors.orange(code);
}

