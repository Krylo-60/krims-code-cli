# Krims Code CLI

> ⚡ **Universal AI Gateway** — 13+ providers, free & paid models, cyberpunk terminal

[![npm version](https://img.shields.io/npm/v/@krishivpb60/krims-code-cli.svg)](https://www.npmjs.com/package/@krishivpb60/krims-code-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-≥18.0.0-green.svg)](https://nodejs.org)

```
  ╔════════════════════════════════════════════════════════════════╗
  ║  ██╗  ██╗██████╗ ██╗███╗   ███╗███████╗     ██████╗ ██████╗  ║
  ║  ██║ ██╔╝██╔══██╗██║████╗ ████║██╔════╝    ██╔════╝██╔═══██╗ ║
  ║  █████╔╝ ██████╔╝██║██╔████╔██║███████╗    ██║     ██║   ██║ ║
  ║  ██╔═██╗ ██╔══██╗██║██║╚██╔╝██║╚════██║    ██║     ██║   ██║ ║
  ║  ██║  ██╗██║  ██║██║██║ ╚═╝ ██║███████║    ╚██████╗╚██████╔╝ ║
  ║  ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚══════╝     ╚═════╝ ╚═════╝  ║
  ║              ██████╗██╗     ██╗                                  ║
  ║             ██╔════╝██║     ██║                                  ║
  ║             ██║     ██║     ██║                                  ║
  ║             ██║     ██║     ██║                                  ║
  ║             ╚██████╗███████╗██║                                  ║
  ║              ╚═════╝╚══════╝╚═╝                                  ║
  ╚════════════════════════════════════════════════════════════════╝
```

**Krims Code CLI** is a production-ready, globally installable command-line AI assistant that connects to **any AI provider in the world** — both free and paid. Chat with GPT-4o, Claude, Gemini, Llama, Mixtral, DeepSeek, and 50+ more models, all from one terminal.

---

## ✨ Features

- 🌐 **13+ AI Providers** — OpenAI, Anthropic, Google, Groq, Together, Mistral, OpenRouter, DeepSeek, Cerebras, Cohere, Perplexity, Fireworks, xAI
- 🆓 **Free Models Included** — Groq, Together AI, Cerebras, OpenRouter, and Cohere all offer generous free tiers
- 💬 **Interactive Chat** — Full terminal chat with slash commands, mode switching, and file attachments
- ⚡ **Single-Shot Queries** — Quick one-off questions directly from the CLI
- 🧠 **4 Reasoning Modes** — Synthesis, Research, Architect, Titan Fusion — each with unique system prompts
- 📎 **File Context Injection** — Attach code files, logs, or documents for context-aware AI responses
- 🤖 **Autopilot Debug Loop** — Automatically correct build/test failures using AI self-correcting feedback loop
- 🌿 **Interactive Git TUI** — Beautiful cyberpunk ASCII branch tree commit history & interactive file staging checkbox menu
- 📊 **Web HUD Dashboard** — Companion local zero-dependency telemetry dashboard displaying real-time latencies & provider status
- 🎤 **Voice Microphone Input** — Record voice input directly from your terminal and transcribe it to text using Google Gemini or Whisper
- 🔄 **Failover Mesh** — Automatic failback across all configured providers
- 🔢 **Local Math Solver** — Evaluates mathematical expressions without an API call
- 🤖 **Krylo Companion** — Offline cyberpunk companion bot when no API keys are configured
- 🔐 **Your Keys, Your Control** — API keys stored locally on YOUR machine, never transmitted anywhere
- 📤 **Export Conversations** — Save full chat history as Markdown files
- 🎨 **Cyberpunk UI** — Neon colors, ASCII art, signal bars, and mode badges
- 🎭 **4 Color Themes** — Cyberpunk, Matrix, Synthwave, Crimson — switch with `/theme`
- ⌨️ **Custom Commands** — Create reusable prompt shortcuts with `/cmd add`
- 📝 **File Creation** — AI can create files on your system with path override prompts
- 📊 **Live Telemetry** — Real-time response latency & tokens/sec in the status bar
- 🎮 **Mini-Game** — Built-in mainframe hacking game (`/game`)
- 📋 **Clipboard Copy** — Copy last response to clipboard with `/copy`

---

## 🚀 Quick Start

### Install globally via npm

```bash
npm install -g @krishivpb60/krims-code-cli
```

### Or run directly with npx

```bash
npx @krishivpb60/krims-code-cli chat
```

### Or install via pip (Python wrapper)

```bash
pip install krims-code-cli
# Run via terminal:
krims-pip chat
```

### Setup (Interactive Wizard)

```bash
krims-code setup
```

The wizard walks you through configuring providers — **start with free ones!**

### Or set keys manually

```bash
# Free providers (recommended to start)
krims-code config set GROQ_API_KEY gsk_your_key_here
krims-code config set GOOGLE_API_KEY AIza_your_key_here
krims-code config set OPENROUTER_API_KEY sk-or-your_key_here

# Paid providers
krims-code config set OPENAI_API_KEY sk-your_key_here
krims-code config set ANTHROPIC_API_KEY sk-ant-your_key_here
```

### Start chatting

```bash
krims-code chat
```

### Quick one-shot query

```bash
krims-code ask "Explain quantum computing in simple terms"
```

---

## 📦 Supported Providers

| Provider | Key | Free Tier | Default Model |
|----------|-----|-----------|---------------|
| **Groq** | `GROQ_API_KEY` | ✅ Generous | `llama-3.3-70b-versatile` |
| **Together AI** | `TOGETHER_API_KEY` | ✅ Free credits | `Meta-Llama-3.1-70B-Instruct-Turbo` |
| **Cerebras** | `CEREBRAS_API_KEY` | ✅ Free tier | `llama-3.3-70b` |
| **OpenRouter** | `OPENROUTER_API_KEY` | ✅ Free models | `llama-3.1-70b-instruct:free` |
| **Google Gemini** | `GOOGLE_API_KEY` | ✅ Free tier | `gemini-2.5-flash` |
| **Cohere** | `COHERE_API_KEY` | ✅ Dev free | `command-r-plus` |
| **Fireworks AI** | `FIREWORKS_API_KEY` | ✅ Free tier | `llama-v3p1-70b-instruct` |
| **OpenAI** | `OPENAI_API_KEY` | 💳 Paid | `gpt-4o` |
| **Anthropic** | `ANTHROPIC_API_KEY` | 💳 Paid | `claude-sonnet-4` |
| **xAI** | `XAI_API_KEY` | 💳 Paid | `grok-2` |
| **Mistral** | `MISTRAL_API_KEY` | 💳 Paid | `mistral-large-latest` |
| **DeepSeek** | `DEEPSEEK_API_KEY` | 💳 Paid | `deepseek-chat` |
| **Perplexity** | `PERPLEXITY_API_KEY` | 💳 Paid | `sonar` |

> 💡 **Tip:** Start with **Groq** (fastest, free) or **Google Gemini** (most capable free tier). You can configure multiple providers and Krims Code will automatically failover between them!

---

## 🎮 Commands

### Core Commands

```bash
krims-code chat                    # Interactive chat session
krims-code ask "your question"     # Single-shot query
krims-code setup                   # Guided provider setup wizard
```

### Configuration

```bash
krims-code config set <KEY> <value>   # Set a config value
krims-code config get <KEY>           # Get a config value
krims-code config list                # List all config (keys masked)
krims-code config delete <KEY>        # Delete a config key
krims-code config reset               # Delete all config
krims-code config path                # Show config file location
```

### Discovery

```bash
krims-code providers               # List all 13+ supported providers
krims-code providers --free        # Show only free-tier providers
krims-code models                  # List all available models
krims-code models groq             # Models for a specific provider
krims-code modes                   # List reasoning modes
krims-code status                  # System status & active providers
```

### Flags

```bash
krims-code ask "prompt" --mode research     # Use specific reasoning mode
krims-code ask "prompt" --file error.log    # Attach file context
krims-code ask "prompt" --model gpt-4o      # Override model
krims-code ask "prompt" --raw               # Raw text output (for piping)
krims-code chat --mode architect            # Start chat in specific mode
```

---

## 💬 Chat Commands

Inside interactive chat mode, use these slash commands:

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/mode <name>` | Switch reasoning mode (synthesis, research, architect, titan) |
| `/modes` | List all modes with signal bars |
| `/theme <name>` | Switch visual theme (cyberpunk, matrix, synthwave, crimson) |
| `/themes` | List available color themes |
| `/attach <file>` | Attach a file for context (supports Tab autocomplete!) |
| `/files` | List attached files |
| `/clear` | Clear terminal screen |
| `/providers` | Show active providers |
| `/export` | Export chat to Markdown |
| `/copy` | Copy last response to clipboard |
| `/write <file>` | Extract last code block and save to file |
| `/cmd list` | List custom command shortcuts |
| `/cmd add <name> <template>` | Create a custom command shortcut |
| `/cmd remove <name>` | Delete a custom command |
| `/game` | Start the mainframe hacking mini-game |
| `/history` | List, switch, and resume past interactive chat sessions |
| `/history-clear` | Clear saved persistent chat history |
| `/autopilot <mode\|debug [cmd]>` | View/switch autopilot safety level or run autonomous debug loop |
| `/git` | Launch interactive cyberpunk Git TUI and file stager checkbox menu |
| `/github <status\|issues\|prs>` | Git/GitHub orchestration, auto-staging, semantic AI commit generation, and remote sync |
| `/teamwork-preview` | Render real-time multi-agent matrix status dashboard with heartbeats & tasks |
| `/dashboard` | Spawn zero-dependency local web server and launch telemetry dashboard HUD |
| `/mic` | Record audio voice input from microphone and transcribe to text |
| `/tokens` | View detailed session token usage and exchanges telemetry |
| `/update` | Force check for updates and update Krims Code CLI manually |
| `/review` | Run git diff and stream an AI code review |
| `/diagnose [cmd]` | Run build/tests and AI-debug any errors |
| `/explain <file>` | AI-explain the design and logic of a file |
| `/refactor <file>` | AI-refactor the code of a target file |
| `/bug <file>` | Scan a file to detect logical edge case failures |
| `/doc <file>` | Write documentation, inline comments, or JSDoc |
| `/translate <file> <lang>` | AI-translate file code into another target language |
| `/exit` | End session |

---

## 🧠 Reasoning Modes

| Mode | Layer | Style | Signal |
|------|-------|-------|--------|
| **Synthesis** | v2.5 | Balanced, clean, direct | ████████░░ 80% |
| **Research** | v104 | Deep analysis, evidence-based | █████████░ 85% |
| **Architect** | v55 | Systems thinking, debugging | █████████░ 90% |
| **Titan Fusion** | v110 | Premium, maximum signal density | █████████░ 95% |

---

## 🔐 Security

- **Your keys stay on YOUR machine** — stored at `~/.krims-code/config.json`
- **No keys are bundled** in the package
- **No telemetry** — zero data collection
- **Keys are masked** when displayed (`krims-code config list`)
- **Environment variables** also supported as fallback

---

## 🔄 Failover Mesh

Krims Code routes your prompt through all configured providers automatically:

```
Your Prompt
    ↓
[Provider 1] → Success? → Response ✓
    ↓ (fail)
[Provider 2] → Success? → Response ✓
    ↓ (fail)
[Provider N] → Success? → Response ✓
    ↓ (all fail)
[Krylo Companion] → Local Response ✓
```

If a provider returns an error (rate limit, quota, etc.), Krims Code automatically tries the next one. Configure multiple free providers for maximum resilience!

---

## 📁 File Attachment

Attach code files, logs, configs, or documents for context-aware responses:

```bash
# From CLI
krims-code ask "What's wrong with this code?" --file buggy.js

# In chat mode
/attach error.log
What errors are in this file?
```

**Supported file types:** `.js`, `.ts`, `.py`, `.html`, `.css`, `.json`, `.md`, `.txt`, `.log`, `.yaml`, `.xml`, `.toml`, `.sql`, `.go`, `.rs`, `.java`, `.c`, `.cpp`, `.rb`, `.php`, `.swift`, `.kt`, `.dart`, `.vue`, `.svelte`, `.sh`, `.bat`, `.ps1`, `.env`, `.csv`

---

## 🏗️ Development

```bash
# Clone the repo
git clone https://github.com/Krylo-60/krims-code-cli.git
cd krims-code-cli

# Install dependencies
npm install

# Link for local development
npm link

# Test
krims-code --help
krims-code status
krims-code ask "hello"
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 👨‍💻 Author

**Krishiv PB** ([@Krylo-60](https://github.com/Krylo-60))

> *"Stay cyberpunk. ⚡"*

---

<p align="center">
  <b>⚡ Krims Code CLI — Fusion Command Station ⚡</b><br>
  <i>Universal AI Gateway for the Terminal</i>
</p>
