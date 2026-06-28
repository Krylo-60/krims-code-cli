import { getGitDiff, runGitCommit } from "../git.js";
import { getAIConfig } from "../config.js";
import { routePrompt } from "../ai/router.js";
import { MODES, DEFAULT_MODE } from "../modes.js";
import { colors, label } from "../ui/theme.js";
import { createInterface } from "node:readline/promises";

export default {
  name: "commit",
  description: "Generate conventional commit message from git diff and commit changes",
  aliases: [],
  options: [],
  async executeCLI(args, options) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      const { diff, isStaged } = await getGitDiff();
      if (!diff) {
        console.log("\n" + label.system + " " + colors.warning("No staged or unstaged changes detected. Stage your files using 'git add' first.\n"));
        rl.close();
        return;
      }

      if (!isStaged) {
        const stageAnswer = await rl.question("\n" + label.system + " " + colors.warning("No staged changes found. Do you want to stage all changes automatically? [y/N]: "));

        if (stageAnswer.toLowerCase().trim() === "y" || stageAnswer.toLowerCase().trim() === "yes") {
          const { exec } = await import("node:child_process");
          const { promisify } = await import("node:util");
          const execAsync = promisify(exec);
          await execAsync("git add .");
          console.log(label.system + " " + colors.success("Staged all changes successfully."));
        } else {
          console.log("\n" + label.system + " " + colors.muted("Aborted. Please stage files using 'git add' first.\n"));
          rl.close();
          return;
        }
      }

      const aiConfig = await getAIConfig();
      const mode = MODES[DEFAULT_MODE];

      console.log("");
      console.log(label.system + " " + colors.brand("Reading git diff and generating conventional commit message..."));
      console.log("");

      const systemPrompt = "You are an expert developer assistant. Generate a concise, clear, and professional conventional commit message (e.g., 'feat: add login page', 'fix: resolve buffer overflow') based on the provided git diff. Output ONLY the commit message itself on a single line, with absolutely no backticks, markdown, explanations, prefix, or introductory text.";
      const userPrompt = `Here is the git diff:\n\n${diff}`;

      let firstToken = true;
      let commitMessage = "";
      const onToken = (token) => {
        if (firstToken) {
          firstToken = false;
          process.stdout.write(label.aether + " Suggested Commit Message: " + colors.success(token));
        } else {
          process.stdout.write(colors.success(token));
        }
        commitMessage += token;
      };

      const result = await routePrompt(userPrompt, mode.systemPrompt, aiConfig, onToken);
      console.log("\n");

      const cleanMessage = result.text.trim().replace(/^`+|`+$/g, ""); // strip quotes/backticks

      const answer = await rl.question(colors.muted("Commit with this message? [Y/n]: "));

      if (answer.toLowerCase().trim() === "n" || answer.toLowerCase().trim() === "no") {
        console.log("\n" + label.system + " " + colors.muted("Commit aborted.\n"));
        rl.close();
        return;
      }

      console.log("\n" + label.system + " " + colors.brand("Executing git commit..."));
      const output = await runGitCommit(cleanMessage);
      console.log("\n" + colors.success(output) + "\n");

    } catch (err) {
      console.log("\n" + label.error + " " + colors.danger(err.message) + "\n");
    } finally {
      rl.close();
    }
  },
  async executeChat(args, ctx) {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    try {
      const { diff, isStaged } = await getGitDiff();
      if (!diff) {
        console.log("\n" + label.system + " " + colors.warning("No staged or unstaged changes detected. Stage your files using 'git add' first.\n"));
        return;
      }

      if (!isStaged) {
        ctx.rl.pause();
        const stageAnswer = await new Promise((resolve) => {
          ctx.rl.question(colors.warning("\nNo staged changes found. Do you want to stage all changes automatically? [y/N]: "), resolve);
        });
        ctx.rl.resume();

        if (stageAnswer.toLowerCase().trim() === "y" || stageAnswer.toLowerCase().trim() === "yes") {
          await execAsync("git add .");
          console.log(label.system + " " + colors.success("Staged all changes successfully."));
        } else {
          console.log("\n" + label.system + " " + colors.muted("Aborted. Please stage files using 'git add' first.\n"));
          return;
        }
      }

      console.log("\n" + label.system + " " + colors.brand("Reading git diff and generating conventional commit message..."));
      console.log("");

      const systemPrompt = "You are an expert developer assistant. Generate a concise, clear, and professional conventional commit message (e.g., 'feat: add login page', 'fix: resolve buffer overflow') based on the provided git diff. Output ONLY the commit message itself on a single line, with absolutely no backticks, markdown, explanations, prefix, or introductory text.";
      const userPrompt = `Here is the git diff:\n\n${diff}`;

      let firstToken = true;
      let commitMessage = "";
      const onToken = (token) => {
        if (firstToken) {
          firstToken = false;
          process.stdout.write(label.aether + " Suggested Commit Message: " + colors.success(token));
        } else {
          process.stdout.write(colors.success(token));
        }
        commitMessage += token;
      };

      const result = await routePrompt(userPrompt, systemPrompt, ctx.aiConfig, onToken);
      console.log("\n");

      const cleanMessage = result.text.trim().replace(/^`+|`+$/g, ""); // strip quotes/backticks

      ctx.rl.pause();
      const answer = await new Promise((resolve) => {
        ctx.rl.question(colors.muted("Commit with this message? [Y/n]: "), resolve);
      });
      ctx.rl.resume();

      if (answer.toLowerCase().trim() === "n" || answer.toLowerCase().trim() === "no") {
        console.log("\n" + label.system + " " + colors.muted("Commit aborted.\n"));
        return;
      }

      console.log("\n" + label.system + " " + colors.brand("Executing git commit..."));
      const output = await runGitCommit(cleanMessage);
      console.log("\n" + colors.success(output) + "\n");

    } catch (err) {
      console.log("\n" + label.error + " " + colors.danger(err.message) + "\n");
    }
  }
};
