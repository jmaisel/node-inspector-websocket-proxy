/**
 * CallStackController - Manages call stack display
 *
 * Responsibilities:
 * - Render call stack from template (with TemplateRegistry override support)
 * - Subscribe to Debugger.paused/resumed events
 * - Fetch source code for active frame
 * - Display frame information (function name, location, line, column)
 * - Handle frame selection
 * - Expose global renderCallStack() function
 *
 * Features:
 * - Call frame list with function names and locations
 * - Source code preview for active frame
 * - Frame selection for variable inspection
 * - Integration with debugger pause/resume lifecycle
 */

import { TemplateRegistry } from '../core/TemplateRegistry.js';
import { callstackTemplate } from '../templates/callstack-template.js';

export class CallStackController {
    constructor(config = {}) {
        this.eventQueue = config.eventQueue;
        this.proxy = config.proxy;
        this.container = config.container || '#callstack';
        this.instanceId = config.instanceId || 'callstack-' + Date.now();

        // State
        this.callFrames = [];
        this.selectedFrameIndex = 0;
        this.scriptMap = new Map();  // scriptId -> url mapping

        console.log('[CallStackController] Created');
    }

    /**
     * Initialize - render and setup
     */
    async initialize() {
        console.log('[CallStackController] Initializing...');

        // Render the template
        this.render();

        // Setup event handlers
        this.setupDOMEventHandlers();

        // Subscribe to events
        this.subscribeToEvents();

        // Expose global function for backwards compatibility
        window.renderCallStack = (frames) => {
            this.renderCallStack(frames);
        };

        console.log('[CallStackController] Initialized');
    }

    /**
     * Render call stack from template (with TemplateRegistry override support)
     */
    render() {
        // Check TemplateRegistry first, fall back to default template
        const templateFn = TemplateRegistry.get('callstack') || callstackTemplate;

        // Format frames for template
        const formattedFrames = this.callFrames.map((frame, index) => ({
            functionName: frame.functionName || '(anonymous)',
            url: this.formatFilePath(frame.url || 'unknown'),
            line: frame.location?.lineNumber ?? '?',
            col: frame.location?.columnNumber ?? '?',
            selected: index === this.selectedFrameIndex
        }));

        const html = templateFn({
            callFrames: formattedFrames
        }, {}, this.instanceId);

        // Insert into container
        $(this.container).html(html);

        console.log('[CallStackController] Rendered', this.callFrames.length, 'frames');
    }

    /**
     * Setup DOM event handlers
     */
    setupDOMEventHandlers() {
        // Frame selection
        $(this.container).on('click', '.list-item', (e) => {
            const frameIndex = $(e.currentTarget).data('frame-index');
            console.log('[CallStackController] Frame selected:', frameIndex);
            this.selectFrame(frameIndex);
        });

        console.log('[CallStackController] DOM event handlers setup');
    }

    /**
     * Subscribe to events on the queue
     */
    subscribeToEvents() {
        // Render call stack when debugger pauses
        this.eventQueue.subscribe('Debugger.paused', (topic, data) => {
            console.log('[CallStackController] Debugger paused');
            const callFrames = data?.callFrames || [];
            this.renderCallStack(callFrames);
        });

        // Clear call stack when debugger resumes
        this.eventQueue.subscribe('Debugger.resumed', () => {
            console.log('[CallStackController] Debugger resumed');
            this.clearCallStack();
        });

        // Track script URLs for mapping
        this.eventQueue.subscribe('Debugger.scriptParsed', (topic, data) => {
            const scriptId = data.scriptId;
            const url = data.url;
            this.scriptMap.set(scriptId, url);
        });

        console.log('[CallStackController] Subscribed to queue events');
    }

    /**
     * Render call stack (can be called externally or by events)
     * @param {Array} callFrames - Array of call frames
     */
    async renderCallStack(callFrames) {
        console.log('[CallStackController] renderCallStack called with', callFrames?.length || 0, 'frames');

        this.callFrames = callFrames || [];
        this.selectedFrameIndex = 0;

        // Resolve URLs for frames that only have scriptId
        for (const frame of this.callFrames) {
            if (!frame.url && frame.location?.scriptId) {
                frame.url = this.scriptMap.get(frame.location.scriptId) || 'unknown';
            }
        }

        // Render
        this.render();

        // Re-setup event handlers after render
        this.setupDOMEventHandlers();

        // Fetch source code for active frame (index 0)
        if (this.callFrames.length > 0) {
            await this.fetchAndDisplayFrameSource(0);
        }
    }

    /**
     * Clear call stack display
     */
    clearCallStack() {
        this.callFrames = [];
        this.selectedFrameIndex = 0;
        this.render();
        this.setupDOMEventHandlers();
    }

    /**
     * Select a specific frame
     * @param {number} frameIndex - Index of the frame to select
     */
    selectFrame(frameIndex) {
        if (frameIndex < 0 || frameIndex >= this.callFrames.length) {
            return;
        }

        this.selectedFrameIndex = frameIndex;

        // Update UI
        $(`#${this.instanceId} .list-item`).removeClass('selected');
        $(`#${this.instanceId} .list-item[data-frame-index="${frameIndex}"]`).addClass('selected');

        // Fetch source for selected frame
        this.fetchAndDisplayFrameSource(frameIndex);
    }

    /**
     * Fetch source code for a frame and display it
     * @param {number} frameIndex - Index of the frame
     */
    async fetchAndDisplayFrameSource(frameIndex) {
        const frame = this.callFrames[frameIndex];
        if (!frame || !frame.location?.scriptId) {
            return;
        }

        try {
            console.log('[CallStackController] Fetching source for frame', frameIndex);

            // Get script source
            const result = await this.proxy.debuggerController.getScriptSource(frame.location.scriptId);

            if (result.scriptSource) {
                const lines = result.scriptSource.split('\n');
                const lineNumber = frame.location.lineNumber;

                if (lineNumber < lines.length) {
                    const codeLine = lines[lineNumber];

                    // Display source preview (append to the selected frame)
                    const frameElement = $(`#${this.instanceId} .list-item[data-frame-index="${frameIndex}"]`);

                    // Remove any existing preview
                    frameElement.find('.frame-code-preview').remove();

                    // Add new preview
                    const previewHtml = `
                        <div class="frame-code-preview">
                            <span class="code-line-number">${lineNumber + 1}</span>
                            <code class="code-line">${this.escapeHtml(codeLine)}</code>
                        </div>
                    `;

                    frameElement.find('.item-content').append(previewHtml);
                }
            }
        } catch (error) {
            console.warn('[CallStackController] Could not fetch source for frame:', error);
        }
    }

    /**
     * Format file path for display
     * @param {string} path - Full file path
     * @returns {string} Shortened path
     */
    formatFilePath(path) {
        if (!path || path === 'unknown') {
            return 'unknown';
        }

        // Remove file:// prefix
        path = path.replace('file://', '');

        // Shorten node_modules paths
        if (path.includes('node_modules')) {
            const parts = path.split('node_modules/');
            if (parts.length > 1) {
                return 'node_modules/' + parts[parts.length - 1];
            }
        }

        // Show last 2-3 path segments
        const segments = path.split('/');
        if (segments.length > 3) {
            return '.../' + segments.slice(-3).join('/');
        }

        return path;
    }

    /**
     * Escape HTML for safe display
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeHtml(str) {
        if (!str) return '';

        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
