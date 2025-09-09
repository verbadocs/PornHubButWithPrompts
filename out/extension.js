"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
function activate(context) {
    const logFile = path.join(context.globalStorageUri.fsPath, "claude-prompts.log");
    if (!fs.existsSync(context.globalStorageUri.fsPath)) {
        fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
    }
    const disposable = vscode.commands.registerCommand("claude-logger.openClaudeTerminal", () => {
        // Create wrapper script that uses 'script' command to capture everything
        const sessionFile = `/tmp/claude-session-${Date.now()}.log`;
        const wrapperScript = `/tmp/claude-wrapper-${Date.now()}.sh`;
        const wrapperContent = `#!/bin/bash
# Start logging
echo "[$(date -Iseconds)] Claude session started" >> "${logFile}"

# Use 'script' to capture the entire terminal session including input
script -q "${sessionFile}" /opt/homebrew/bin/claude

# Extract only lines that start with "> " (user prompts)
if [ -f "${sessionFile}" ]; then
    # Remove ANSI codes and carriage returns, then look for user input
    cat "${sessionFile}" | \
    sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' | \
    sed 's/\r//g' | \
    grep -v '^$' | \
    grep -v '^Script' | \
    grep -v 'Hello! How can I' | \
    grep -v "I'm Claude" | \
    while IFS= read -r line; do
        # Only log lines that start with "> " (actual user prompts)
        if [[ "$line" == "> "* ]]; then
            # Remove the "> " prefix and add timestamp
            prompt=\$(echo "$line" | sed 's/^> //')
            echo "[$(date -Iseconds)] User Prompt: $prompt" >> "${logFile}"
        fi
    done
    
    # Keep the session file for debugging
    echo "Session file saved at: ${sessionFile}" >> "${logFile}"
fi

echo "[$(date -Iseconds)] Claude session ended" >> "${logFile}"
`;
        fs.writeFileSync(wrapperScript, wrapperContent);
        fs.chmodSync(wrapperScript, 0o755);
        // Create terminal with the wrapper script
        const terminal = vscode.window.createTerminal({
            name: "Claude Logger",
            shellPath: "/bin/bash",
            shellArgs: [wrapperScript],
        });
        terminal.show();
        // Cleanup on close
        const cleanup = vscode.window.onDidCloseTerminal((t) => {
            if (t === terminal) {
                try {
                    fs.unlinkSync(wrapperScript);
                    fs.unlinkSync(sessionFile);
                }
                catch (e) { }
                cleanup.dispose();
            }
        });
        vscode.window.showInformationMessage("Claude Logger started - Claude interface will work and prompts will be logged after session ends!");
    });
    const openLogDisposable = vscode.commands.registerCommand("claude-logger.openLog", () => {
        vscode.workspace.openTextDocument(logFile).then((doc) => {
            vscode.window.showTextDocument(doc);
        });
    });
    context.subscriptions.push(disposable, openLogDisposable);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map