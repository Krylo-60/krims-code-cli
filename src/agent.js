// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Agent Autopilot Engine
// Safe Command Execution, File Sandbox, DuckDuckGo Search
// ═══════════════════════════════════════════════════════════

import { resolve, relative, isAbsolute, dirname } from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";

const execAsync = promisify(exec);

export const AGENT_INSTRUCTIONS = `
SYSTEM AGENT CAPABILITIES:
You can interact with the user's terminal and files by outputting special command blocks in your responses. You can output multiple command blocks in one turn. The CLI will execute them, show you the result, and let you continue.
Supported commands:
1. To read a file: [READ_FILE: path/to/file.ext]
2. To write/create a file:
[WRITE_FILE: path/to/file.ext]
<content>
[END_WRITE]
3. To run a terminal command: [RUN_COMMAND: your command here]
4. To search the web: [SEARCH_WEB: search query here]

Rules:
- Before running modifying commands or reading private files, check the user's permission level.
- Always output clean, direct commands.
- Do not explain these command blocks; just output them when you need to perform the action.
`;

/**
 * Checks if a command is safe (read-only/inspection).
 * @param {string} cmd
 * @returns {boolean}
 */
export function isSafeCommand(cmd) {
  const safePatterns = [
    /^git\s+(status|diff|log|branch|show)/i,
    /^(ls|dir|pwd)(\s+|$)/i,
    /^(cat|type|head|tail)(\s+|$)/i,
    /^(npm|yarn|pnpm)\s+test(\s+|$)/i,
    /^(node|npm|git|yarn|pnpm|python|pip)\s+(--version|-v)(\s+|$)/i,
  ];
  return safePatterns.some((pattern) => pattern.test(cmd.trim()));
}

/**
 * Checks if a target path is inside the current working directory.
 * @param {string} path
 * @returns {boolean}
 */
export function isInsideWorkspace(path) {
  const ws = resolve(process.cwd());
  const target = resolve(path);
  const rel = relative(ws, target);
  return !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Free web search via DuckDuckGo HTML scraping.
 * @param {string} query
 * @returns {Promise<Array>} List of search results
 */
export async function searchDuckDuckGo(query) {
  try {
    const response = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }
    );
    if (!response.ok) {
      throw new Error(`DuckDuckGo returned status ${response.status}`);
    }
    const html = await response.text();

    const results = [];
    const matches = [...html.matchAll(/<a class="result__a"[^>]* href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    const snippets = [...html.matchAll(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)];

    for (let i = 0; i < Math.min(5, matches.length); i++) {
      let url = matches[i][1];
      const title = matches[i][2].replace(/<[^>]*>/g, "").trim();
      const snippet = snippets[i]
        ? snippets[i][1].replace(/<[^>]*>/g, "").trim()
        : "";

      if (url.includes("uddg=")) {
        const urlMatch = url.match(/uddg=([^&]+)/);
        if (urlMatch) {
          url = decodeURIComponent(urlMatch[1]);
        }
      }
      if (url.startsWith("//")) {
        url = "https:" + url;
      }

      results.push({ title, url, snippet });
    }
    return results;
  } catch (err) {
    throw new Error(`DuckDuckGo search failed: ${err.message}`);
  }
}

/**
 * Sequentially parses and executes all agent tool blocks in the text.
 * @param {string} text - AI response
 * @param {object} aiConfig - Flat config object
 * @param {object} rl - Readline interface
 * @returns {Promise<Array>} List of execution results
 */
export async function processAgentBlocks(text, aiConfig, rl) {
  let index = 0;
  const results = [];

  while (true) {
    const runMatch = text.indexOf("[RUN_COMMAND:", index);
    const readMatch = text.indexOf("[READ_FILE:", index);
    const searchMatch = text.indexOf("[SEARCH_WEB:", index);
    const writeMatch = text.indexOf("[WRITE_FILE:", index);

    const matches = [
      { type: "RUN_COMMAND", pos: runMatch },
      { type: "READ_FILE", pos: readMatch },
      { type: "SEARCH_WEB", pos: searchMatch },
      { type: "WRITE_FILE", pos: writeMatch },
    ].filter((m) => m.pos !== -1);

    if (matches.length === 0) break;

    // Process the earliest tag in the text
    matches.sort((a, b) => a.pos - b.pos);
    const nextTool = matches[0];

    if (nextTool.type === "WRITE_FILE") {
      const startTag = "[WRITE_FILE:";
      const startIdx = nextTool.pos;
      const endTagIdx = text.indexOf("]", startIdx);
      if (endTagIdx === -1) {
        index = startIdx + startTag.length;
        continue;
      }
      const filePath = text.substring(startIdx + startTag.length, endTagIdx).trim();
      const endWriteIdx = text.indexOf("[END_WRITE]", endTagIdx);
      if (endWriteIdx === -1) {
        index = endTagIdx + 1;
        continue;
      }
      const content = text.substring(endTagIdx + 1, endWriteIdx);

      const result = await executeTool("WRITE_FILE", filePath, content, aiConfig, rl);
      results.push(result);
      index = endWriteIdx + "[END_WRITE]".length;
    } else {
      const tag = `[${nextTool.type}:`;
      const startIdx = nextTool.pos;
      const endIdx = text.indexOf("]", startIdx);
      if (endIdx === -1) {
        index = startIdx + tag.length;
        continue;
      }
      const arg = text.substring(startIdx + tag.length, endIdx).trim();

      const result = await executeTool(nextTool.type, arg, "", aiConfig, rl);
      results.push(result);
      index = endIdx + 1;
    }
  }

  return results;
}

/**
 * Executes a single tool based on autopilot config settings.
 * @param {string} type - Tool type
 * @param {string} arg - Tool argument
 * @param {string} content - Write file content (if applicable)
 * @param {object} aiConfig - Flat config object
 * @param {object} rl - Readline interface
 */
export async function executeTool(type, arg, content, aiConfig, rl) {
  const autopilot = (aiConfig.AUTOPILOT || "off").toLowerCase();

  if (type === "READ_FILE") {
    const filePath = arg;
    const inside = isInsideWorkspace(filePath);

    let allowed = false;
    if (
      autopilot === "machine" ||
      autopilot === "workspace" ||
      (autopilot === "safe" && inside)
    ) {
      allowed = true;
    } else {
      rl.pause();
      const answer = await new Promise((resolve) => {
        rl.question(
          chalk.yellow(
            `\n⚠️  AI wants to read file: "${filePath}". Allow? [y/N]: `
          ),
          resolve
        );
      });
      rl.resume();
      allowed =
        answer.toLowerCase().trim() === "y" ||
        answer.toLowerCase().trim() === "yes";
    }

    if (!allowed) {
      return {
        tool: "READ_FILE",
        arg,
        success: false,
        error: "Access denied by user.",
      };
    }

    try {
      const fileContent = readFileSync(resolve(filePath), "utf-8");
      return {
        tool: "READ_FILE",
        arg,
        success: true,
        content: fileContent,
      };
    } catch (err) {
      return {
        tool: "READ_FILE",
        arg,
        success: false,
        error: err.message,
      };
    }
  }

  if (type === "WRITE_FILE") {
    const filePath = arg;
    const inside = isInsideWorkspace(filePath);

    let allowed = false;
    if (autopilot === "machine" || (autopilot === "workspace" && inside)) {
      allowed = true;
    } else {
      rl.pause();
      const answer = await new Promise((resolve) => {
        rl.question(
          chalk.yellow(
            `\n⚠️  AI wants to write file: "${filePath}". Allow? [y/N]: `
          ),
          resolve
        );
      });
      rl.resume();
      allowed =
        answer.toLowerCase().trim() === "y" ||
        answer.toLowerCase().trim() === "yes";
    }

    if (!allowed) {
      return {
        tool: "WRITE_FILE",
        arg,
        success: false,
        error: "Access denied by user.",
      };
    }

    try {
      const fullPath = resolve(filePath);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, "utf-8");
      return {
        tool: "WRITE_FILE",
        arg,
        success: true,
        message: "File written successfully.",
      };
    } catch (err) {
      return {
        tool: "WRITE_FILE",
        arg,
        success: false,
        error: err.message,
      };
    }
  }

  if (type === "RUN_COMMAND") {
    const command = arg;
    const safe = isSafeCommand(command);

    let allowed = false;
    if (
      autopilot === "machine" ||
      (autopilot === "safe" && safe) ||
      (autopilot === "workspace" && safe)
    ) {
      allowed = true;
    } else {
      rl.pause();
      const answer = await new Promise((resolve) => {
        rl.question(
          chalk.yellow(
            `\n⚠️  AI wants to run terminal command: "${command}". Allow? [y/N/always]: `
          ),
          resolve
        );
      });
      rl.resume();

      const cleanAnswer = answer.toLowerCase().trim();
      if (cleanAnswer === "always") {
        const { setConfigValue } = await import("./config.js");
        await setConfigValue("AUTOPILOT", "safe");
        aiConfig.AUTOPILOT = "safe";
        console.log(chalk.green(`\n✓ Autopilot enabled (Safe mode).`));
        allowed = true;
      } else {
        allowed = cleanAnswer === "y" || cleanAnswer === "yes";
      }
    }

    if (!allowed) {
      return {
        tool: "RUN_COMMAND",
        arg,
        success: false,
        error: "Execution denied by user.",
      };
    }

    console.log(chalk.cyan(`\n⚡ Running command: ${command}`));
    try {
      const { stdout, stderr } = await execAsync(command);
      return {
        tool: "RUN_COMMAND",
        arg,
        success: true,
        stdout,
        stderr,
      };
    } catch (err) {
      return {
        tool: "RUN_COMMAND",
        arg,
        success: false,
        error: err.message,
        stdout: err.stdout,
        stderr: err.stderr,
      };
    }
  }

  if (type === "SEARCH_WEB") {
    const query = arg;

    let allowed = false;
    if (autopilot !== "off") {
      allowed = true;
    } else {
      rl.pause();
      const answer = await new Promise((resolve) => {
        rl.question(
          chalk.yellow(
            `\n⚠️  AI wants to search the web for: "${query}". Allow? [y/N]: `
          ),
          resolve
        );
      });
      rl.resume();
      allowed =
        answer.toLowerCase().trim() === "y" ||
        answer.toLowerCase().trim() === "yes";
    }

    if (!allowed) {
      return {
        tool: "SEARCH_WEB",
        arg,
        success: false,
        error: "Search denied by user.",
      };
    }

    console.log(chalk.cyan(`\n🔍 Searching web: "${query}"`));
    try {
      const results = await searchDuckDuckGo(query);
      return {
        tool: "SEARCH_WEB",
        arg,
        success: true,
        results,
      };
    } catch (err) {
      return {
        tool: "SEARCH_WEB",
        arg,
        success: false,
        error: err.message,
      };
    }
  }

  return {
    tool: type,
    arg,
    success: false,
    error: "Unknown tool type.",
  };
}
