import { BaseUIController } from './BaseUIController.js';
import { TemplateRegistry, generateInstanceId } from '../TemplateRegistry.js';
import { callStackTemplate, callStackFrameTemplate, scopeTypeHeaderTemplate, scopeVariableTemplate } from '../templates/callstack-template.js';

/**
 * CallStackUIController - Manages call stack display and scope variables
 *
 * Supports two modes:
 * 1. Standalone: Generates its own HTML from template
 * 2. Embedded: Uses existing HTML in the DOM
 *
 * @example
 * // Standalone with default template
 * const callStack = new CallStackUIController();
 * callStack.mount('.tab-content');
 * callStack.initialize();
 *
 * // Embedded with existing HTML
 * const callStack = new CallStackUIController({
 *     instanceId: 'callstack',
 *     skipRender: true
 * });
 * callStack.initialize();
 */
export class CallStackUIController extends BaseUIController {
    constructor(config = {}) {
        super();

        const instanceId = config.instanceId || generateInstanceId('callstack');

        this.instanceId = instanceId;
        this.debuggerUI = config.debuggerUI || null;
        this.skipRender = config.skipRender || false;
        this.logger = new Logger("CallStackUIController");

        // Store references (will be set after render/mount)
        this.$container = null;
    }

    /**
     * Render HTML from template
     * @returns {string} HTML string
     */
    render() {
        const template = TemplateRegistry.get('callstack') || callStackTemplate;
        return template({
            emptyMessage: 'Pause execution to see call stack'
        }, this.instanceId);
    }

    /**
     * Mount the call stack into a DOM container
     * @param {string|jQuery} container - Container for tab pane (e.g., '.tab-content')
     */
    mount(container) {
        if (this.skipRender) {
            // Use existing HTML
            this.$container = $(`#${this.instanceId}`);
            return;
        }

        const html = this.render();
        $(container).append(html);
        this.$container = $(`#${this.instanceId}`);
    }

    /**
     * Fetch source code for a stack frame
     * @param {Object} frame - The stack frame
     * @returns {Object|null} Source info with line number, code, and highlighted code
     */
    async fetchFrameSource(frame) {
        if (!frame.location?.scriptId || !this.debuggerUI?.debuggerController) return null;

        try {
            const result = await this.debuggerUI.debuggerController.client.debugger.getScriptSource(frame.location.scriptId);
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
            this.logger.warn('Could not fetch source for frame:', error);
        }

        return null;
    }

    /**
     * Render the call stack
     * @param {Array} callFrames - Array of call frames to render
     */
    async renderCallStack(callFrames) {
        if (this.debuggerUI?.debuggerController) {
            this.debuggerUI.debuggerController.currentCallFrames = callFrames || [];
        }

        this.logger.info('renderCallStack called with frames:', callFrames);

        if (!callFrames || callFrames.length === 0) {
            $(`#${this.instanceId}`).html('<div class="empty-state">Pause execution to see call stack</div>');
            return;
        }

        $(`#${this.instanceId}`).empty();

        for (let index = 0; index < callFrames.length; index++) {
            const frame = callFrames[index];
            this.logger.info(`Frame ${index}:`, frame);
            const functionName = frame.functionName || '(anonymous)';

            // Try to get URL from frame, or look it up via scriptId
            let url = frame.url;
            if (!url && frame.location?.scriptId && this.debuggerUI?.debuggerController) {
                url = this.debuggerUI.debuggerController.scriptMap.get(frame.location.scriptId);
            }
            if (!url) {
                url = 'unknown';
            }

            const displayPath = formatFilePath(url);
            const line = frame.location?.lineNumber ?? '?';
            const col = frame.location?.columnNumber ?? '?';

            // For the active frame (index 0), fetch source code
            const sourceInfo = (index === 0) ? await this.fetchFrameSource(frame) : null;

            // Build the frame HTML using template
            const frameHtml = callStackFrameTemplate({
                index,
                functionName,
                displayPath,
                url,
                line,
                col,
                sourceInfo
            });

            $(`#${this.instanceId}`).append(frameHtml);
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
        $(`#${this.instanceId} .list-item`).removeClass('selected');
        $(`#${this.instanceId} .list-item`).eq(index).addClass('selected');

        if (this.debuggerUI?.debuggerController && this.debuggerUI.debuggerController.currentCallFrames[index]) {
            this.renderScope(this.debuggerUI.debuggerController.currentCallFrames[index].scopeChain);
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
            // Add scope type header
            $scope.append(scopeTypeHeaderTemplate(scope.type));

            if (scope.object?.objectId && this.debuggerUI?.debuggerController) {
                try {
                    const props = await this.debuggerUI.debuggerController.client.runtime.getProperties(scope.object.objectId, true);
                    if (props.result) {
                        props.result.forEach(prop => {
                            const value = prop.value?.value ?? prop.value?.description ?? 'undefined';
                            $scope.append(scopeVariableTemplate({
                                name: prop.name,
                                value: value
                            }));
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
        // If skipRender, ensure we have references to existing elements
        if (this.skipRender) {
            this.$container = $(`#${this.instanceId}`);
        }

        this.setupEventHandlers();

        // Expose renderCallStack globally for debugger controller
        window.renderCallStack = (callFrames) => this.renderCallStack(callFrames);
    }
}