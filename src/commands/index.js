import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadCommands() {
  const commands = [];
  const files = fs.readdirSync(__dirname);

  for (const file of files) {
    if (file === 'index.js' || !file.endsWith('.js') || file.startsWith('.')) {
      continue;
    }

    const filePath = path.join(__dirname, file);
    const fileUrl = new URL(`file://${filePath}`).href;
    const module = await import(fileUrl);
    const cmd = module.default || module.command;

    if (cmd && cmd.name) {
      commands.push(cmd);
    }
  }

  return commands;
}

class CommandRegistry {
  constructor() {
    this.commands = new Map();
    this.aliases = new Map();
    this.allList = [];
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return;
    this.commands.clear();
    this.aliases.clear();
    this.allList = [];

    const loaded = await loadCommands();
    for (const cmd of loaded) {
      this.commands.set(cmd.name.toLowerCase(), cmd);
      this.allList.push(cmd);
      if (cmd.aliases && Array.isArray(cmd.aliases)) {
        for (const alias of cmd.aliases) {
          this.aliases.set(alias.toLowerCase(), cmd);
        }
      }
    }
    this.loaded = true;
  }

  get(nameOrAlias) {
    const key = nameOrAlias.toLowerCase();
    return this.commands.get(key) || this.aliases.get(key);
  }

  getAll() {
    return this.allList;
  }
}

export const registry = new CommandRegistry();
