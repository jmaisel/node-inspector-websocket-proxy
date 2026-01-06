/**
 * WatchesController - Manages watch expressions
 *
 * Responsibilities:
 * - Render watches from template (with TemplateRegistry override support)
 * - Add/remove watch expressions
 * - Evaluate watches when debugger pauses
 * - Display evaluated values or errors
 *
 * Features:
 * - Add watch expression input
 * - Remove watch button per expression
 * - Automatic evaluation on Debugger.paused events
 * - Display current value or error message
 */

import { TemplateRegistry } from '../core/TemplateRegistry.js';
import { watchesTemplate } from '../templates/watches-template.js';

export class WatchesController {
    constructor(config = {}) {
        this.eventQueue = config.eventQueue;
        this.proxy = config.proxy;
        this.container = config.container || '#watches';
        this.instanceId = config.instanceId || 'watches-' + Date.now();

        // State
        this.watches = [];  // Array of { id, expression, value, error }
        this.nextWatchId = 1;

        console.log('[WatchesController] Created');
    }

    /**
     * Initialize - render and setup
     */
    async initialize() {
        console.log('[WatchesController] Initializing...');

        // Render the template
        this.render();

        // Setup event handlers
        this.setupDOMEventHandlers();

        // Subscribe to events
        this.subscribeToEvents();

        console.log('[WatchesController] Initialized');
    }

    /**
     * Render watches from template (with TemplateRegistry override support)
     */
    render() {
        // Check TemplateRegistry first, fall back to default template
        const templateFn = TemplateRegistry.get('watches') || watchesTemplate;

        // Prepare watch data for template (format values for display)
        const watchData = this.watches.map(watch => ({
            id: watch.id,
            expression: watch.expression,
            value: watch.error ? `Error: ${watch.error}` : String(watch.value)
        }));

        const html = templateFn({
            watches: watchData
        }, {}, this.instanceId);

        // Insert into container
        $(this.container).html(html);

        console.log('[WatchesController] Rendered', this.watches.length, 'watches');
    }

    /**
     * Setup DOM event handlers
     */
    setupDOMEventHandlers() {
        // Add watch button
        $(`#${this.instanceId}-add-btn`).on('click', () => {
            this.handleAddWatch();
        });

        // Add watch on Enter key
        $(`#${this.instanceId}-expression-input`).on('keypress', (e) => {
            if (e.which === 13) {  // Enter key
                this.handleAddWatch();
            }
        });

        // Remove watch buttons (delegated event handler)
        $(this.container).on('click', '.watch-remove-btn', (e) => {
            const watchId = $(e.currentTarget).data('watch-id');
            this.handleRemoveWatch(watchId);
        });

        console.log('[WatchesController] DOM event handlers setup');
    }

    /**
     * Subscribe to events on the queue
     */
    subscribeToEvents() {
        // Evaluate watches when debugger pauses
        this.eventQueue.subscribe('Debugger.paused', (topic, data) => {
            console.log('[WatchesController] Debugger paused, evaluating watches');
            this.evaluateAllWatches(data);
        });

        // Clear values when debugger resumes
        this.eventQueue.subscribe('Debugger.resumed', () => {
            console.log('[WatchesController] Debugger resumed');
            // Optional: Could clear values or leave them as-is
        });

        console.log('[WatchesController] Subscribed to queue events');
    }

    /**
     * Handle add watch button click
     */
    handleAddWatch() {
        const expression = $(`#${this.instanceId}-expression-input`).val().trim();

        if (!expression) {
            console.warn('[WatchesController] Empty expression');
            return;
        }

        console.log('[WatchesController] Adding watch:', expression);

        // Add watch to state
        this.watches.push({
            id: this.nextWatchId++,
            expression: expression,
            value: undefined,
            error: null
        });

        // Clear input
        $(`#${this.instanceId}-expression-input`).val('');

        // Re-render
        this.render();

        // Setup event handlers again (after re-render)
        this.setupDOMEventHandlers();
    }

    /**
     * Handle remove watch button click
     * @param {number} watchId - ID of the watch to remove
     */
    handleRemoveWatch(watchId) {
        console.log('[WatchesController] Removing watch:', watchId);

        // Remove from state
        this.watches = this.watches.filter(w => w.id !== watchId);

        // Re-render
        this.render();

        // Setup event handlers again (after re-render)
        this.setupDOMEventHandlers();
    }

    /**
     * Evaluate all watches using the Runtime.evaluate API
     * @param {Object} pauseData - Data from Debugger.paused event
     */
    async evaluateAllWatches(pauseData) {
        if (this.watches.length === 0) {
            return;
        }

        // Get the call frame context if available
        const callFrameId = pauseData?.callFrames?.[0]?.callFrameId;

        // Evaluate each watch expression
        for (const watch of this.watches) {
            try {
                console.log('[WatchesController] Evaluating:', watch.expression);

                // Use Runtime.evaluate to evaluate the expression
                // If we have a call frame, evaluate in that context
                const evaluateParams = {
                    expression: watch.expression,
                    generatePreview: true
                };

                // If in paused context, evaluate on the call frame
                if (callFrameId) {
                    // Use Debugger.evaluateOnCallFrame instead
                    const result = await this.proxy.debuggerController.evaluateOnCallFrame(
                        callFrameId,
                        watch.expression
                    );

                    if (result.exceptionDetails) {
                        watch.error = result.exceptionDetails.exception?.description || 'Error';
                        watch.value = undefined;
                    } else {
                        watch.error = null;
                        watch.value = this.formatValue(result.result);
                    }
                } else {
                    // Evaluate in global context
                    const result = await this.proxy.runtimeController.evaluate(watch.expression);

                    if (result.exceptionDetails) {
                        watch.error = result.exceptionDetails.exception?.description || 'Error';
                        watch.value = undefined;
                    } else {
                        watch.error = null;
                        watch.value = this.formatValue(result.result);
                    }
                }
            } catch (error) {
                console.error('[WatchesController] Evaluation error:', error);
                watch.error = error.message || 'Unknown error';
                watch.value = undefined;
            }
        }

        // Re-render with updated values
        this.render();

        // Setup event handlers again (after re-render)
        this.setupDOMEventHandlers();
    }

    /**
     * Format a RemoteObject value for display
     * @param {Object} remoteObject - Chrome DevTools Protocol RemoteObject
     * @returns {string} Formatted value
     */
    formatValue(remoteObject) {
        if (!remoteObject) {
            return 'undefined';
        }

        const type = remoteObject.type;
        const value = remoteObject.value;
        const description = remoteObject.description;

        switch (type) {
            case 'string':
                return `"${value}"`;
            case 'number':
            case 'boolean':
                return String(value);
            case 'undefined':
                return 'undefined';
            case 'object':
                if (remoteObject.subtype === 'null') {
                    return 'null';
                }
                if (remoteObject.subtype === 'array') {
                    return description || 'Array';
                }
                return description || 'Object';
            case 'function':
                return description || 'function';
            case 'symbol':
                return description || 'Symbol';
            case 'bigint':
                return String(value) + 'n';
            default:
                return description || String(value) || type;
        }
    }
}
