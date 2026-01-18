/**
 * DebuggerEventHelper - Handles debugger events (paused, resumed, scripts, console)
 */
class DebuggerEventHelper {
    constructor(aceController) {
        this.ace = aceController;
        this.logger = new Logger("DebuggerEventHelper");
    }

    onDebuggerPaused(params) {
        this.logger.info("onDebuggerPaused", params);

        // Extract call frame info
        const callFrames = params.callFrames || [];
        if (callFrames.length > 0) {
            const topFrame = callFrames[0];
            const location = topFrame.location;

            // Get script URL
            const scriptId = location.scriptId;
            const lineNumber = location.lineNumber;

            this.logger.info(`Paused at scriptId: ${scriptId}, line: ${lineNumber}`);

            // Get script info to find the file
            const scriptInfo = this.ace.scripts.get(scriptId);
            if (scriptInfo && scriptInfo.url) {
                // Extract file path from URL (may need adjustment based on URL format)
                const filePath = scriptInfo.url.replace('file://', '');

                // Check if this file is already open
                if (this.ace.openSessions.has(filePath)) {
                    // Switch to this file if it's not already active
                    if (this.ace.activeFile !== filePath) {
                        this.logger.info(`Switching to file ${filePath} for debugging`);
                        this.ace.editorHelper.switchToFile(filePath);
                    }
                } else {
                    this.logger.info(`Debug file ${filePath} not open, staying on current file`);
                    // Could optionally load the file here, but for now just highlight on current file
                }
            }

            // Highlight the current execution line
            if (this.ace.editorHelper) {
                this.ace.editorHelper.setDebugLine(lineNumber);
            }

            // Store call frames for inspection
            this.ace.currentCallFrames = callFrames;

            // Publish paused event
            if (this.ace.application) {
                this.ace.application.pub("debugger:paused", {
                    reason: params.reason,
                    callFrames: callFrames,
                    location: location,
                    timestamp: Date.now()
                });
            }
        }
    }

    onDebuggerResumed() {
        this.logger.info("onDebuggerResumed");

        // Clear execution line marker
        if (this.ace.editorHelper) {
            this.ace.editorHelper.clearDebugLine();
        }

        // Clear call frames
        this.ace.currentCallFrames = null;

        // Publish resumed event
        if (this.ace.application) {
            this.ace.application.pub("debugger:resumed", {
                timestamp: Date.now()
            });
        }
    }

    onScriptParsed(params) {
        this.logger.info("Script parsed:", params.scriptId, params.url);

        // Store script information
        if (!this.ace.scripts) {
            this.ace.scripts = new Map();
        }

        this.ace.scripts.set(params.scriptId, {
            url: params.url,
            startLine: params.startLine || 0,
            startColumn: params.startColumn || 0,
            endLine: params.endLine || 0,
            endColumn: params.endColumn || 0,
            hash: params.hash
        });

        // Publish script parsed event
        if (this.ace.application) {
            this.ace.application.pub("debugger:script:parsed", {
                scriptId: params.scriptId,
                url: params.url,
                timestamp: Date.now()
            });
        }
    }

    onConsoleMessage(params) {
        this.logger.info("Console message:", params);

        // Publish console message event
        if (this.ace.application) {
            this.ace.application.pub("debugger:console", {
                type: params.type,
                args: params.args,
                stackTrace: params.stackTrace,
                timestamp: Date.now()
            });
        }
    }
}
