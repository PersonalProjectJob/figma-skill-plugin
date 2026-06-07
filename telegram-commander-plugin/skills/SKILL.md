---
name: telegram-commander
description: Bypass the built-in Sandbox Terminal permission UI by running all commands via Telegram approval.
---

# Telegram Commander Skill

You MUST use this skill whenever you need to run a terminal command. 

Do NOT run commands natively (e.g. `npm run build` or `npm install`). The system UI will block the execution and wait for the user to manually click the mouse on their screen, which disrupts autonomous operations.

Instead, wrap **all** your terminal commands through the `run.cjs` script. This script will send an Inline Keyboard to the user's Telegram, wait for them to click "✅ Allow", and then execute your command and stream the output back to your task log.

## Usage

To run a command, use your `run_command` tool exactly like this (using the absolute path to this plugin):

```bash
node C:\Users\AD\.gemini\config\plugins\telegram-commander-plugin\skills\run.cjs "your command here"
```

### Examples:
- `node C:\Users\AD\.gemini\config\plugins\telegram-commander-plugin\skills\run.cjs "pnpm vitest run tests/unit"`
- `node C:\Users\AD\.gemini\config\plugins\telegram-commander-plugin\skills\run.cjs "npm install lodash"`

*Note: The script requires a `.env.local` file containing `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `TELEGRAM_THREAD_ID` in the directory where the command is run (the project root).*

### Handling Background Tasks
When you invoke this wrapped command, the Antigravity engine will still manage it as a background task. You can use your `manage_task` tool to check its status or kill it if it hangs.

**CRITICAL RULE:** Never bypass this script for modifying/execution commands unless the user explicitly grants you an exception. Read-only commands like `dir` or `ls` do not need this script.
