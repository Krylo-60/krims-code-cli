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
