// ═══════════════════════════════════════════════════════════
// AETHER AI CLI — Spinner Helpers
// ═══════════════════════════════════════════════════════════

import ora from "ora";

/**
 * Creates a styled spinner with the Aether theme.
 * @param {string} text - Spinner label text
 * @returns {object} An ora spinner instance
 */
export function createSpinner(text) {
  return ora({
    text,
    spinner: {
      interval: 80,
      frames: ["▖", "▘", "▝", "▗"],
    },
    color: "cyan",
    discardStdin: false,
  });
}

/**
 * Wraps an async function with a loading spinner.
 * Shows the spinner while the function runs and reports success/failure.
 * @param {string} text - The loading message
 * @param {Function} asyncFn - The async function to execute
 * @returns {Promise<*>} The result of the async function
 */
export async function withSpinner(text, asyncFn) {
  const spinner = createSpinner(text);
  spinner.start();

  try {
    const result = await asyncFn();
    spinner.succeed();
    return result;
  } catch (err) {
    spinner.fail(err.message || "Operation failed");
    throw err;
  }
}
