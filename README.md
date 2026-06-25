# Aether AI CLI

> ⚡ **Universal AI Gateway** — 13+ providers, free & paid models, cyberpunk terminal

[![npm version](https://img.shields.io/npm/v/@krylo-60/aether-ai-cli.svg)](https://www.npmjs.com/package/@krylo-60/aether-ai-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-≥18.0.0-green.svg)](https://nodejs.org)

```
  ╔═══════════════════════════════════════════════════════════╗
  ║     █████╗ ███████╗████████╗██╗  ██╗███████╗██████╗    ║
  ║    ██╔══██╗██╔════╝╚══██╔══╝██║  ██║██╔════╝██╔══██╗   ║
  ║    ███████║█████╗     ██║   ████████║█████╗  ██████╔╝   ║
  ║    ██╔══██║██╔══╝     ██║   ██╔══██║██╔══╝  ██╔══██╗   ║
  ║    ██║  ██║███████╗   ██║   ██║  ██║███████╗██║  ██║   ║
  ║    ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ║
  ╚═══════════════════════════════════════════════════════════╝
```

**Aether Core AI v110** is a production-ready, globally installable command-line AI assistant that connects to **any AI provider in the world** — both free and paid. Chat with GPT-4o, Claude, Gemini, Llama, Mixtral, DeepSeek, and 50+ more models, all from one terminal.

---

## ✨ Features

- 🌐 **13+ AI Providers** — OpenAI, Anthropic, Google, Groq, Together, Mistral, OpenRouter, DeepSeek, Cerebras, Cohere, Perplexity, Fireworks, xAI
- 🆓 **Free Models Included** — Groq, Together AI, Cerebras, OpenRouter, and Cohere all offer generous free tiers
- 💬 **Interactive Chat** — Full terminal chat with slash commands, mode switching, and file attachments
- ⚡ **Single-Shot Queries** — Quick one-off questions directly from the CLI
- 🧠 **4 Reasoning Modes** — Synthesis, Research, Architect, Titan Fusion — each with unique system prompts
- 📎 **File Context Injection** — Attach code files, logs, or documents for context-aware AI responses
- 🔄 **Failover Mesh** — Automatic failback across all configured providers
- 🔢 **Local Math Solver** — Evaluates mathematical expressions without an API call
- 🤖 **Krylo Companion** — Offline cyberpunk companion bot when no API keys are configured
- 🔐 **Your Keys, Your Control** — API keys stored locally on YOUR machine, never transmitted anywhere
- 📤 **Export Conversations** — Save full chat history as Markdown files
- 🎨 **Cyberpunk UI** — Neon colors, ASCII art, signal bars, and mode badges

---

## 🚀 Quick Start

### Install globally

```bash
npm install -g @krylo-60/aether-ai-cli
```

### Or run directly with npx

```bash
npx @krylo-60/aether-ai-cli chat
```

### Setup (Interactive Wizard)

```bash
aether setup
```

The wizard walks you through configuring providers — **start with free ones!**

### Or set keys manually

```bash
# Free providers (recommended to start)
aether config set GROQ_API_KEY gsk_your_key_here
aether config set GOOGLE_API_KEY AIza_your_key_here
aether config set OPENROUTER_API_KEY sk-or-your_key_here

# Paid providers
aether config set OPENAI_API_KEY sk-your_key_here
aether config set ANTHROPIC_API_KEY sk-ant-your_key_here
```

### Start chatting

```bash
aether chat
```

### Quick one-shot query

```bash
aether ask "Explain quantum computing in simple terms"
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

> 💡 **Tip:** Start with **Groq** (fastest, free) or **Google Gemini** (most capable free tier). You can configure multiple providers and Aether will automatically failover between them!

---

## 🎮 Commands

### Core Commands

```bash
aether chat                    # Interactive chat session
aether ask "your question"     # Single-shot query
aether setup                   # Guided provider setup wizard
```

### Configuration

```bash
aether config set <KEY> <value>   # Set a config value
aether config get <KEY>           # Get a config value
aether config list                # List all config (keys masked)
aether config delete <KEY>        # Delete a config key
aether config reset               # Delete all config
aether config path                # Show config file location
```

### Discovery

```bash
aether providers               # List all 13+ supported providers
aether providers --free        # Show only free-tier providers
aether models                  # List all available models
aether models groq             # Models for a specific provider
aether modes                   # List reasoning modes
aether status                  # System status & active providers
```

### Flags

```bash
aether ask "prompt" --mode research     # Use specific reasoning mode
aether ask "prompt" --file error.log    # Attach file context
aether ask "prompt" --model gpt-4o      # Override model
aether ask "prompt" --raw               # Raw text output (for piping)
aether chat --mode architect            # Start chat in specific mode
```

---

## 💬 Chat Commands

Inside interactive chat mode, use these slash commands:

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/mode <name>` | Switch reasoning mode |
| `/modes` | List all modes with signal bars |
| `/attach <file>` | Attach a file for context |
| `/files` | List attached files |
| `/clear` | Remove attached files |
| `/providers` | Show active providers |
| `/export` | Export chat to Markdown |
| `/status` | Session status |
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

- **Your keys stay on YOUR machine** — stored at `~/.aether/config.json`
- **No keys are bundled** in the package
- **No telemetry** — zero data collection
- **Keys are masked** when displayed (`aether config list`)
- **Environment variables** also supported as fallback

---

## 🔄 Failover Mesh

Aether routes your prompt through all configured providers automatically:

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

If a provider returns an error (rate limit, quota, etc.), Aether automatically tries the next one. Configure multiple free providers for maximum resilience!

---

## 📁 File Attachment

Attach code files, logs, configs, or documents for context-aware responses:

```bash
# From CLI
aether ask "What's wrong with this code?" --file buggy.js

# In chat mode
/attach error.log
What errors are in this file?
```

**Supported file types:** `.js`, `.ts`, `.py`, `.html`, `.css`, `.json`, `.md`, `.txt`, `.log`, `.yaml`, `.xml`, `.toml`, `.sql`, `.go`, `.rs`, `.java`, `.c`, `.cpp`, `.rb`, `.php`, `.swift`, `.kt`, `.dart`, `.vue`, `.svelte`, `.sh`, `.bat`, `.ps1`, `.env`, `.csv`

---

## 🏗️ Development

```bash
# Clone the repo
git clone https://github.com/Krylo-60/aether-ai-cli.git
cd aether-ai-cli

# Install dependencies
npm install

# Link for local development
npm link

# Test
aether --help
aether status
aether ask "hello"
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
  <b>⚡ Aether Core AI v110 — Fusion Command Station ⚡</b><br>
  <i>Universal AI Gateway for the Terminal</i>
</p>
