import { BaseUIController } from './BaseUIController.js';

/**
 * CallStackUIController - Manages call stack display and scope variables
 */
export class CallStackUIController extends BaseUIController {
    constructor() {
        super();
    }

    /**
     * Fetch source code for a stack frame
     * @param {Object} frame - The stack frame
     * @returns {Object|null} Source info with line number, code, and highlighted code
     */
    async fetchFrameSource(frame) {
        if (!frame.location?.scriptId || !debuggerController) return null;

        try {
            const result = await debuggerController.client.debugger.getScriptSource(frame.location.scriptId);
            if (result.scriptSource) {
                const lines = result.scriptSource.split('\n');
                const lineNumber = frame.location.lineNumber;

                if (lineNumber < lines.length) {
                    const codeLine = lines[lineNumber];
                    const highlightedCode = highlightCode(codeLine, 'javascript');

                    return {
                        lineNumber: lineNumber + 1, // 1-indexed for display
                        code: codeLine,
                        highlighted: highlightedCode
                    };
                }
            }
        } catch (error) {
            console.warn('Could not fetch source for frame:', error);
        }

        return null;
    }

    /**
     * Render the call stack
     * @param {Array} callFrames - Array of call frames to render
     */
    async renderCallStack(callFrames) {
        if (debuggerController) {
            debuggerController.currentCallFrames = callFrames || [];
        }

        console.log('renderCallStack called with frames:', callFrames);

        if (!callFrames || callFrames.length === 0) {
            $('#callstack').html('<div class="empty-state">Pause execution to see call stack</div>');
            return;
        }

        $('#callstack').empty();

        for (let index = 0; index < callFrames.length; index++) {
            const frame = callFrames[index];
            console.log(`Frame ${index}:`, frame);
            const functionName = frame.functionName || '(anonymous)';

            // Try to get URL from frame, or look it up via scriptId
            let url = frame.url;
            if (!url && frame.location?.scriptId && debuggerController) {
                url = debuggerController.scriptMap.get(frame.location.scriptId);
            }
            if (!url) {
                url = 'unknown';
            }

            const displayPath = formatFilePath(url);
            const line = frame.location?.lineNumber ?? '?';
            const col = frame.location?.columnNumber ?? '?';

            // Build the frame HTML
            let frameHtml = `
                <div class="list-item ${index === 0 ? 'selected' : ''}" onclick="selectCallFrame(${index})">
                    <div class="item-content">
                        <div class="function-name">${functionName}</div>
                        <div class="function-location" title="${url}">${displayPath}:${line}:${col}</div>
            `;

            // For the active frame (index 0), fetch and show source code
            if (index === 0) {
                const sourceInfo = await this.fetchFrameSource(frame);
                if (sourceInfo) {
                    frameHtml += `
                        <div class="frame-code-preview">
                            <span class="code-line-number">${sourceInfo.lineNumber}</span>
                            <code class="code-line">${sourceInfo.highlighted}</code>
                        </div>
                    `;
                }
            }

            frameHtml += `
                    </div>
                </div>
            `;

            $('#callstack').append(frameHtml);
        }

        // Render scope for first frame
        if (callFrames.length > 0) {
            await this.renderScope(callFrames[0].scopeChain);
        }
    }

    /**
     * Select a specific call frame
     * @param {number} index - Index of the frame to select
     */
    selectCallFrame(index) {
        $('#callstack .list-item').removeClass('selected');
        $('#callstack .list-item').eq(index).addClass('selected');

        if (debuggerController && debuggerController.currentCallFrames[index]) {
            this.renderScope(debuggerController.currentCallFrames[index].scopeChain);
        }
    }

    /**
     * Render scope variables for a scope chain
     * @param {Array} scopeChain - The scope chain to render
     */
    async renderScope(scopeChain) {
        const $scope = $('#scopeVariables');

        if (!scopeChain || scopeChain.length === 0) {
            $scope.html('<div class="empty-state">No scope information available</div>');
            return;
        }

        $scope.empty();

        for (const scope of scopeChain) {
            $scope.append(`<div style="margin-top: 8px; color: var(--text-secondary); font-weight: 600; font-size: var(--font-xs);">${scope.type.toUpperCase()}</div>`);

            if (scope.object?.objectId && debuggerController) {
                try {
                    const props = await debuggerController.client.runtime.getProperties(scope.object.objectId, true);
                    if (props.result) {
                        props.result.forEach(prop => {
                            const value = prop.value?.value ?? prop.value?.description ?? 'undefined';
                            $scope.append(`
                                <div class="variable-item">
                                    <span class="variable-name">${prop.name}:</span>
                                    <span class="variable-value">${value}</span>
                                </div>
                            `);
                        });
                    }
                } catch (error) {
                    $scope.append(`<div class="empty-state">Error loading properties</div>`);
                }
            }
        }
    }

    /**
     * Setup event handlers - expose global function for onclick handlers
     */
    setupEventHandlers() {
        // Expose selectCallFrame globally for HTML onclick handlers
        window.selectCallFrame = (index) => this.selectCallFrame(index);
    }

    /**
     * Initialize the call stack controller
     */
    initialize() {
        this.setupEventHandlers();

        // Expose renderCallStack globally for debugger controller
        window.renderCallStack = (callFrames) => this.renderCallStack(callFrames);
    }
}