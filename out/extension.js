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

# Don't process here anymore - processing happens periodically in extension
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
        // Track what we've already processed
        let lastProcessedPosition = 0;
        // Function to process new prompts from session file
        const processNewPrompts = () => {
            if (!fs.existsSync(sessionFile)) {
                return;
            }
            try {
                const fileContent = fs.readFileSync(sessionFile, "utf8");
                // Only process content after our last position
                const newContent = fileContent.substring(lastProcessedPosition);
                if (newContent.length === 0) {
                    return;
                }
                // Process new lines for prompts
                const lines = newContent.split("\n");
                lines.forEach((line) => {
                    // Remove ANSI codes
                    const cleanLine = line
                        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
                        .replace(/\r/g, "")
                        .trim();
                    // Check if it's a user prompt line
                    if (cleanLine.startsWith("> ") && cleanLine.length > 2) {
                        const prompt = cleanLine.substring(2);
                        // Filter out UI hints
                        if (!prompt.includes("Try") &&
                            !prompt.includes("<filepath>") &&
                            prompt.length > 0) {
                            const timestamp = new Date().toISOString();
                            fs.appendFileSync(logFile, `[${timestamp}] User Prompt: ${prompt}\n`);
                        }
                    }
                });
                // Update our position
                lastProcessedPosition = fileContent.length;
            }
            catch (e) {
                // File might be locked, will retry on next interval
            }
        };
        // Process prompts every 30 seconds
        const processingInterval = setInterval(processNewPrompts, 5000);
        // Also process immediately when terminal opens (after a delay)
        setTimeout(processNewPrompts, 2000);
        // Cleanup on close
        const cleanup = vscode.window.onDidCloseTerminal((t) => {
            if (t === terminal) {
                // Do final processing before cleanup
                processNewPrompts();
                // Clear the interval
                clearInterval(processingInterval);
                try {
                    fs.unlinkSync(wrapperScript);
                    fs.unlinkSync(sessionFile);
                }
                catch (e) { }
                cleanup.dispose();
            }
        });
        vscode.window.showInformationMessage("Claude Logger started - prompts will be logged every 30 seconds!");
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