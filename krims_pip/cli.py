import sys
import os
import json
import getpass
from krims_code_sdk import KrimsClient, PROVIDERS

# ANSI color helper matching chalk
class Colors:
    RED = "\033[31m"
    CYAN = "\033[36m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    WHITE = "\033[37m"
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    
    @staticmethod
    def hex(code):
        h = code.lstrip('#')
        r, g, b = tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
        return f"\033[38;2;{r};{g};{b}m"

# Config Path Resolver
def get_config_path():
    home = os.path.expanduser("~")
    return os.path.join(home, ".aether", "config.json")

def load_config():
    config_path = get_config_path()
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_config(config):
    config_path = get_config_path()
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

def print_banner(config, current_mode="titan"):
    c1 = Colors.hex('#FF3E3E') # Red-Orange
    c2 = Colors.hex('#FF8500') # Orange
    c3 = Colors.hex('#FFD000') # Yellow
    c4 = Colors.hex('#00F2FF') # Cyan
    c5 = Colors.hex('#0085FF') # Blue
    c6 = Colors.hex('#7000FF') # Violet
    c7 = Colors.hex('#B000FF') # Purple
    dim = Colors.DIM
    reset = Colors.RESET

    username = getpass.getuser() or "Explorer"
    cwd = os.getcwd()
    home = os.path.expanduser("~")
    display_cwd = cwd
    if cwd.startswith(home):
        display_cwd = "~" + cwd[len(home):]

    # Resolve active providers
    active_providers = []
    for k, p in PROVIDERS.items():
        env_key = p.get('envKey')
        if env_key and os.environ.get(env_key):
            active_providers.append(k)
        elif env_key and config.get(env_key):
            active_providers.append(k)
            
    if active_providers:
        active_names = ", ".join(set(active_providers))
        mesh_status = f"{Colors.GREEN}● Online ({len(active_providers)} active node(s)){reset}"
    else:
        active_names = "Local math & offline logic only"
        mesh_status = f"{Colors.YELLOW}○ Offline (Local fallbacks active){reset}"

    # Truncate values to fit screen
    max_val_width = 46
    if len(display_cwd) > max_val_width:
        display_cwd = "..." + display_cwd[-(max_val_width - 3):]
    if len(active_names) > max_val_width:
        active_names = active_names[:max_val_width - 3] + "..."

    logo = [
        c1("  █▄     ▄█"),
        c2("  ██    ██ "),
        c3("  ██ ▄█    "),
        c4("  ███▀     "),
        c5("  ██ ▀█    "),
        c6("  ██    ██ "),
        c7("  █▀     ▀█")
    ]

    info = [
        f"   ⚡ {c4}KRIMS CODE COMMAND STATION v1.5.7{reset} • Welcome back, {c4}{username}{reset}",
        dim("   " + "─" * 58),
        f"     {dim}Workspace{reset} : {display_cwd}",
        f"     {dim}Mode{reset}      : {c4}{current_mode.upper()}{reset} {dim}— Ultimate reasoning fusion of Codex & Claude Code.{reset}",
        f"     {dim}Network{reset}   : {mesh_status}",
        f"     {dim}Engine{reset}    : {active_names}",
        f"     {dim}Packager{reset}  : pip (krims-code-cli)"
    ]

    print("")
    for i in range(7):
        print(logo[i] + info[i] + reset)
    print("")

def run_chat(config, model=None, provider=None):
    # Resolve default provider
    prov_key = provider or config.get("DEFAULT_PROVIDER") or "google"
    model_name = model or config.get("DEFAULT_MODEL") or ""
    
    # Resolve key
    prov_config = PROVIDERS.get(prov_key.lower(), {})
    env_key = prov_config.get("envKey", "")
    api_key = config.get(env_key) or os.environ.get(env_key) or ""

    client = KrimsClient(provider=prov_key, model=model_name, api_key=api_key)
    session = client.create_session()

    print_banner(config)
    print(f"{Colors.DIM}Type 'exit' or 'quit' to terminate session. Ctrl+C to abort.{Colors.RESET}\n")

    while True:
        try:
            prompt = input(f"{Colors.hex('#00F2FF')}you > {Colors.RESET}")
            if not prompt.strip():
                continue
            if prompt.strip().lower() in ['exit', 'quit']:
                break
            
            print(f"{Colors.DIM}krims is composing response...{Colors.RESET}")
            res = session.ask(prompt)
            print(f"\n{Colors.hex('#7000FF')}krims > {Colors.RESET}{res['text']}\n")
        except KeyboardInterrupt:
            print("\nSession terminated.")
            break
        except Exception as e:
            print(f"\n{Colors.RED}Error: {e}{Colors.RESET}\n")

def run_ask(prompt, config):
    prov_key = config.get("DEFAULT_PROVIDER") or "google"
    model_name = config.get("DEFAULT_MODEL") or ""
    prov_config = PROVIDERS.get(prov_key.lower(), {})
    env_key = prov_config.get("envKey", "")
    api_key = config.get(env_key) or os.environ.get(env_key) or ""

    client = KrimsClient(provider=prov_key, model=model_name, api_key=api_key)
    try:
        res = client.ask(prompt)
        print(res['text'])
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

def handle_config(args, config):
    if len(args) == 0:
        print("Usage: krims-pip config <get/set/list/delete> [key] [value]")
        return
        
    action = args[0].lower()
    if action == "list":
        for k, v in config.items():
            print(f"{k}={v}")
    elif action == "get" and len(args) >= 2:
        print(config.get(args[1], ""))
    elif action == "set" and len(args) >= 3:
        config[args[1]] = args[2]
        save_config(config)
        print(f"Set {args[1]}={args[2]}")
    elif action == "delete" and len(args) >= 2:
        if args[1] in config:
            del config[args[1]]
            save_config(config)
            print(f"Deleted {args[1]}")
        else:
            print(f"Key {args[1]} not found")
    else:
        print("Invalid config arguments.")

def main():
    config = load_config()
    args = sys.argv[1:]

    if not args:
        run_chat(config)
        return

    cmd = args[0].lower()
    if cmd == "chat":
        run_chat(config)
    elif cmd == "ask" and len(args) >= 2:
        run_ask(args[1], config)
    elif cmd == "config":
        handle_config(args[1:], config)
    elif cmd in ["version", "-v", "--version"]:
        print("Krims Code CLI v1.5.7 (Native Python Edition)")
    elif cmd in ["help", "-h", "--help"]:
        print("Krims Code CLI — Native Python Edition")
        print("\nCommands:")
        print("  chat                  Start stateful chat loop (default)")
        print("  ask <prompt>          Get single answer for prompt")
        print("  config <get/set/list> Get or set keys")
        print("  version               Display version info")
    else:
        # Fallback to ask if they just write a prompt directly
        run_ask(" ".join(args), config)

if __name__ == "__main__":
    main()
