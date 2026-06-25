# Original User Request

## Initial Request — 2026-06-25T09:32:46-04:00

An all-in-one CLI command-line assistant called Aether AI CLI (`aether`). It features high-fidelity interactive terminal chat (using custom spinner, cyberpunk theme), multi-mode reasoning selection, file attachment parsing, secure API key configuration, and robust local offline JS mathematical fallbacks.

Working directory: C:\Users\naina\.gemini\antigravity\scratch\aether-ai-cli
Integrity mode: benchmark

## Requirements

### R1. High-Fidelity Cyberpunk Interactive Terminal Chat
- Provide a CLI tool (`aether`) that starts a continuous, interactive terminal chat.
- Display a stylized cyberpunk banner and colors, spinner indicators during API requests, and render assistant responses in formatted markdown.
- Support key CLI flags and commands (such as `--help`, `/quit`, `/exit`, `/clear`, `/modes`, `/providers`, etc.).

### R2. Dual Secure Configuration Management
- Allow users to store API keys and models locally in `~/.aether/config.json` via a CLI setup/config command.
- Support reading from environment variables (e.g., from `.env` or system variables) as a fallback/alternative so no API key errors occur.
- Mask all sensitive configuration values (like API keys) when listed/viewed.

### R3. File Attachment & Context Parsing
- Support passing files to the CLI or during chat (e.g. via syntax like `/attach <path>` or a CLI parameter).
- Parse the content of common file types (text, code, json, csv) and inject it into the prompt context.

### R4. Multi-Mode Reasoning & Routing
- Route user queries dynamically based on model availability and reasoning modes (e.g., Fast, Standard, Deep/Thinking reasoning).
- Support standard free and paid AI provider models (Gemini, Grok, etc.).

### R5. Offline Mathematical Fallback
- When no internet connection is available or API calls fail, fallback to a local JavaScript-based math/logic evaluation engine to solve equations or execute simple logic locally.

### R6. Git Initialization & GitHub Actions CI
- Initialize a local git repository in the workspace folder.
- Add all code files and create an initial commit.
- Define a GitHub Actions workflow `.github/workflows/ci.yml` to automatically run tests/linting.

### R7. Programmatic Test Suite
- Create automated unit tests (using Node's test runner) under the `test/` directory to verify:
  - Configuration loading (priority order: file vs. environment variables).
  - Context parsing of files.
  - Multi-mode routing.
  - Offline math fallback logic.

## Acceptance Criteria

### Installation & Help
- [ ] Running `npm link` or global install allows starting the CLI using `aether`.
- [ ] Running `aether --help` outputs comprehensive usage instructions and options.

### Interactive Chat & UI
- [ ] The CLI starts with a cyberpunk banner and colored interface.
- [ ] Spinning indicators are displayed while waiting for an API response.
- [ ] File attachments can be specified using a CLI argument or dynamic chat command (e.g., `/attach`).

### Key Management
- [ ] Interactive configuration command successfully creates/updates `~/.aether/config.json`.
- [ ] A fallback mechanism works when `~/.aether/config.json` is absent but environment variables are set.
- [ ] Listing the configuration masks keys (showing only prefix/suffix with dots).

### Math Fallback
- [ ] Running a math query when offline or with simulated network failure returns correct evaluation outputs from the local JS fallback engine.

### CI/CD and Tests
- [ ] Running `npm test` executes the unit test suite and passes successfully.
- [ ] A `.github/workflows/ci.yml` workflow file exists and defines linting and testing steps.
- [ ] Git repository is initialized in the working directory and a clean initial commit has been made.

## Follow-up — 2026-06-25T13:33:56Z

The user has specified an additional critical requirement:
"and also it should fell better then clude code and codex so it will be opensorce and free so it will blow i guess"

Ensure the CLI UX is absolutely premium, responsive, and visually stunning—outperforming tools like Claude Code and Codex CLI. It must feel extremely polished, fast, and feature-rich (cyberpunk ASCII art, interactive autocomplete/menu helpers, smooth animations, and perfect markdown rendering). Focus heavily on the UI polish and usability so that it stands out as a top-tier open-source tool.
