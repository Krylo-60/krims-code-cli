import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Checks if inside a git repository and returns the staged or unstaged diff.
 * @returns {Promise<{ diff: string, isStaged: boolean }>}
 */
export async function getGitDiff() {
  try {
    await execAsync("git rev-parse --is-inside-work-tree");
  } catch {
    throw new Error("Not a git repository (or git is not installed).");
  }

  // Try staged changes first
  const { stdout: staged } = await execAsync("git diff --cached");
  if (staged.trim()) {
    return { diff: staged.trim(), isStaged: true };
  }

  // Fallback to unstaged changes
  const { stdout: unstaged } = await execAsync("git diff");
  if (unstaged.trim()) {
    return { diff: unstaged.trim(), isStaged: false };
  }

  return { diff: "", isStaged: false };
}

/**
 * Executes a git commit with the specified message.
 * @param {string} message - The commit message
 * @returns {Promise<string>} stdout output of the git commit command
 */
export async function runGitCommit(message) {
  const escaped = message.replace(/"/g, '\\"');
  const { stdout } = await execAsync(`git commit -m "${escaped}"`);
  return stdout.trim();
}
