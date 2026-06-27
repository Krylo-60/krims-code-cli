# Aether CLI v1.3.10 Highlights
- **Microphone Audio Input Fixes & Transcription (`/mic`)**:
  - Adds `/mic` voice command to record audio directly from your microphone inside the terminal session.
  - Implements native zero-dependency audio recording on Windows using the WinMM Multimedia Control Interface (MCI) via PowerShell.
  - Automatically transcribes speech using Google Gemini (base64 inlineData), Groq Whisper, or OpenAI Whisper.
  - Fixes readline interface raw mode pausing blockages to ensure Enter keypress resolves transcription correctly.
  - Populates the active readline prompt buffer directly with the transcribed text so you can review, edit, and send it.

# Aether CLI v1.3.9 Highlights
- **Microphone Audio Input & Transcription (`/mic`)**:
  - Adds `/mic` voice command to record audio directly from your microphone inside the terminal session.
  - Implements native zero-dependency audio recording on Windows using the WinMM Multimedia Control Interface (MCI) via PowerShell.
  - Automatically transcribes speech using Google Gemini (base64 inlineData), Groq Whisper, or OpenAI Whisper.
  - Populates the active readline prompt buffer directly with the transcribed text so you can review, edit, and send it.

# Aether CLI v1.3.8 Highlights
- **OpenCode TUI Welcome & Navigation**:
  - Implements a stunning, responsive OpenCode-style TUI System State dashboard.
  - Adds `/cd <path>` workspace directory navigation command with directory-only Tab autocomplete.
  - Automatically displays packaging environment info (`npm` vs `pip`).

# Aether CLI v1.3.7 Highlights
- **Readme Updates**:
  - Updates documentation to display interactive Git TUI, Autopilot debug loop, and Web Telemetry Dashboard companion commands.

# Aether CLI v1.3.6 Highlights
- **DX Fixes & Upgrades (Git TUI, Autopilot, Dashboard)**:
  - Fixes non-interactive Git TUI test hangs in git-initialized home directories.
  - Fixes visual HUD telemetry version rendering.
  - Updates project package-lock mappings.

# Aether CLI v1.3.5 Highlights
- **Visual Telemetry Dashboard HUD (`aether dashboard` / `aether telemetry`)**:
  - Adds a local zero-dependency Web Server hosting a cyberpunk observability dashboard HUD.
  - Displays real-time request latencies, query success rates, model token distributions, and active failover mesh topologies.
  - Persistent storage preserves historical metrics across CLI executions in `~/.aether/telemetry.json`.
  - Offline-compatible custom SVG chart engine allows telemetry visualization without an internet connection.

# Aether CLI v1.3.4 Highlights
- **AI-Powered Workspace Search & Code Indexer (`/search`)**:
  - Adds `/search <query>` slash command to scan all workspace text files for keyword matches, showing line numbers and code snippets.
  - Supports `/search --ai <query>` to run a semantic search using the active AI reasoning model.
  - Automatically ignores binaries, files exceeding 250KB, and build/dependency/git directories.

# Aether CLI v1.3.3 Highlights
- **Codex & Claude Code Slash Commands**: Added 7 new advanced developer experience (DX) commands:
  - `/review`: Analyze staged/unstaged git changes and stream an AI-powered code review.
  - `/diagnose [cmd]`: Run tests/builds and automatically debug any errors.
  - `/explain <file>`: Explains design flow and patterns in code.
  - `/refactor <file>`: Rewrites a target file to optimize it.
  - `/bug <file>`: Scans a file to detect logical edge case failures.
  - `/doc <file>`: Automatically writes documentation, inline comments, or JSDoc.
  - `/translate <file> <lang>`: AI-translates file code into another target language.

# Aether CLI v1.3.2 Highlights
- **Manual Updater `/update`**: Added a new slash command `/update` to manually check the registry and force-upgrade Aether CLI to the latest version immediately, bypassing the 24-hour cache throttle.

# Aether CLI v1.3.1 Highlights
- **Codex & Claude Code Fusion**: The powers of OpenAI Codex and Claude Code are now combined directly inside the default **Titan Fusion** (`titan`) mode.
- **Streamlined Modes**: Removed the individual `codex` and `cloude-code` modes to reduce clutter, automatically redirecting all lookups of these modes to Titan Fusion.

# Aether CLI v1.3.0 Highlights
- **Token Telemetry Tracker**: Real-time prompt and completion token statistics shown on every chat turn.
- **Session Telemetry `/tokens`**: A new slash command displaying detailed model-by-model session token breakdowns and total exchange stats.
- **Toggle Telemetry**: Enable or disable display using `aether config set SHOW_TOKENS false`.

# Aether CLI v1.1.9 Highlights
- **Node 18 Compatibility**: Resolves `ReadableStream` reference errors inside the Node 18 CI test runner.
- **Auto-Updater**: Checks for updates once every 24 hours on launch and updates the CLI automatically.
- **Release Highlights**: Prompts and renders version release notes on launch.
- **Customizable Control**: Toggle behavior using `aether config set AUTO_UPDATE false` and `aether config set SHOW_HIGHLIGHTS false`.
- **Autopilot Safety Levels**: Added autonomous capabilities controlled by `/autopilot` setting.
- **Chat History Selector**: View and switch past chat logs with `/history`.
