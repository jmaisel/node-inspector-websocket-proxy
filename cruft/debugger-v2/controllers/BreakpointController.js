/**
 * BreakpointController - Manages breakpoint operations
 *
 * Responsibilities:
 * - Render breakpoints from template (with TemplateRegistry override support)
 * - Add/remove/toggle breakpoints
 * - Subscribe to Debugger.breakpointResolved events
 * - URL normalization (file:// handling)
 * - Integration with FileTreeController
 *
 * Features:
 * - Breakpoint list with enable/disable toggles
 * - Add breakpoint form (URL + line number)
 * - Remove breakpoint button
 * - URL normalization for cross-platform compatibility
 * - Breakpoint resolution tracking
 */

import { TemplateRegistry } from '../core/TemplateRegistry.js';
import { breakpointListTemplate } from '../templates/breakpoint-list-template.js';

export class BreakpointController {
    constructor(config = {}) {
        this.eventQueue = config.eventQueue;
        this.proxy = config.proxy;
        this.container = config.container || '#breakpoints';
        this.instanceId = config.instanceId || 'breakpoints-' + Date.now();

        // State
        this.breakpoints = new Map();  // breakpointId -> { url, lineNumber, enabled, fileName }
        this.nextTempId = 1;  // For UI display before breakpoint is resolved

        console.log('[BreakpointController] Created');
    }

    /**
     * Initialize - render and setup
     */
    async initialize() {
        console.log('[BreakpointController] Initializing...');

        // Render the template
        this.render();

        // Setup event handlers
        this.setupDOMEventHandlers();

        // Subscribe to events
        this.subscribeToEvents();

        console.log('[BreakpointController] Initialized');
    }

    /**
     * Render breakpoints from template (with TemplateRegistry override support)
     */
    render() {
        // Check TemplateRegistry first, fall back to default template
        const templateFn = TemplateRegistry.get('breakpoints') || breakpointListTemplate;

        // Format breakpoints for template
        const breakpointData = Array.from(this.breakpoints.entries()).map(([id, bp]) => ({
            id: id,
            fileName: bp.fileName,
            lineNumber: bp.lineNumber,
            enabled: bp.enabled
        }));

        const html = templateFn({
            breakpoints: breakpointData
        }, {}, this.instanceId);

        // Insert into container
        $(this.container).html(html);

        console.log('[BreakpointController] Rendered', this.breakpoints.size, 'breakpoints');
    }

    /**
     * Setup DOM event handlers
     */
    setupDOMEventHandlers() {
        // Add breakpoint button
        $(`#${this.instanceId}-add-btn`).on('click', () => {
            this.handleAddBreakpoint();
        });

        // Toggle breakpoint (delegated event handler)
        $(this.container).on('change', '.bp-toggle', (e) => {
            const breakpointId = $(e.currentTarget).data('breakpoint-id');
            const enabled = $(e.currentTarget).is(':checked');
            this.handleToggleBreakpoint(breakpointId, enabled);
        });

        // Remove breakpoint (delegated event handler)
        $(this.container).on('click', '.bp-remove-btn', (e) => {
            const breakpointId = $(e.currentTarget).data('breakpoint-id');
            this.handleRemoveBreakpoint(breakpointId);
        });

        console.log('[BreakpointController] DOM event handlers setup');
    }

    /**
     * Subscribe to events on the queue
     */
    subscribeToEvents() {
        // Track breakpoint resolution
        this.eventQueue.subscribe('Debugger.breakpointResolved', (topic, data) => {
            console.log('[BreakpointController] Breakpoint resolved:', data);
            // Update breakpoint state if needed
            const breakpointId = data.breakpointId;
            if (this.breakpoints.has(breakpointId)) {
                console.log('[BreakpointController] Breakpoint resolved successfully');
            }
        });

        console.log('[BreakpointController] Subscribed to queue events');
    }

    /**
     * Handle add breakpoint button click
     */
    async handleAddBreakpoint() {
        const url = $(`#${this.instanceId}-url-input`).val().trim();
        const lineNumber = parseInt($(`#${this.instanceId}-line-input`).val(), 10);

        if (!url || !lineNumber || lineNumber < 1) {
            console.warn('[BreakpointController] Invalid URL or line number');
            alert('Please enter a valid file URL and line number');
            return;
        }

        await this.addBreakpoint(url, lineNumber);

        // Clear inputs
        $(`#${this.instanceId}-url-input`).val('');
        $(`#${this.instanceId}-line-input`).val('');
    }

    /**
     * Handle toggle breakpoint
     * @param {string} breakpointId - ID of the breakpoint
     * @param {boolean} enabled - New enabled state
     */
    async handleToggleBreakpoint(breakpointId, enabled) {
        console.log('[BreakpointController] Toggling breakpoint:', breakpointId, enabled);

        if (!this.breakpoints.has(breakpointId)) {
            return;
        }

        const bp = this.breakpoints.get(breakpointId);

        try {
            if (enabled) {
                // Re-enable by setting the breakpoint again
                await this.proxy.debuggerController.setBreakpointByUrl(
                    bp.lineNumber - 1,  // Convert to 0-indexed
                    this.normalizeUrl(bp.url)
                );
                bp.enabled = true;
            } else {
                // Disable by removing the breakpoint
                await this.proxy.debuggerController.removeBreakpoint(breakpointId);
                bp.enabled = false;
            }

            // Re-render
            this.render();
            this.setupDOMEventHandlers();

        } catch (error) {
            console.error('[BreakpointController] Error toggling breakpoint:', error);
            alert(`Error toggling breakpoint: ${error.message}`);
        }
    }

    /**
     * Handle remove breakpoint
     * @param {string} breakpointId - ID of the breakpoint
     */
    async handleRemoveBreakpoint(breakpointId) {
        console.log('[BreakpointController] Removing breakpoint:', breakpointId);

        try {
            // Remove via protocol
            await this.proxy.debuggerController.removeBreakpoint(breakpointId);

            // Remove from state
            this.breakpoints.delete(breakpointId);

            // Re-render
            this.render();
            this.setupDOMEventHandlers();

        } catch (error) {
            console.error('[BreakpointController] Error removing breakpoint:', error);
            alert(`Error removing breakpoint: ${error.message}`);
        }
    }

    /**
     * Add a new breakpoint
     * Public API for other controllers (e.g., FileTreeController)
     * @param {string} url - File URL or path
     * @param {number} lineNumber - Line number (1-indexed)
     */
    async addBreakpoint(url, lineNumber) {
        if (!url || !lineNumber || lineNumber < 1) {
            console.warn('[BreakpointController] Invalid breakpoint parameters');
            return;
        }

        if (!this.proxy || !this.proxy.debuggerController) {
            console.error('[BreakpointController] Not connected to debugger');
            alert('Not connected to debugger. Please connect first.');
            return;
        }

        try {
            console.log('[BreakpointController] Setting breakpoint at', url, lineNumber);

            // Normalize URL
            const normalizedUrl = this.normalizeUrl(url);

            // Convert to 0-indexed for protocol
            const protocolLine = lineNumber - 1;

            // Set breakpoint via protocol
            const result = await this.proxy.debuggerController.setBreakpointByUrl(
                protocolLine,
                normalizedUrl
            );

            console.log('[BreakpointController] Breakpoint set result:', result);

            if (result.breakpointId) {
                // Store the breakpoint
                this.breakpoints.set(result.breakpointId, {
                    url: url,
                    lineNumber: lineNumber,  // Store as 1-indexed for display
                    enabled: true,
                    fileName: this.getFileName(url)
                });

                console.log('[BreakpointController] Breakpoint set:', result.breakpointId);

                // Log resolution status
                if (result.locations && result.locations.length > 0) {
                    console.log('[BreakpointController] Breakpoint resolved to', result.locations.length, 'locations');
                } else {
                    console.log('[BreakpointController] Breakpoint set but not yet resolved');
                }

                // Re-render
                this.render();
                this.setupDOMEventHandlers();

            } else {
                console.warn('[BreakpointController] Breakpoint set but no ID returned');
                alert('Breakpoint set but could not be tracked');
            }

        } catch (error) {
            console.error('[BreakpointController] Error setting breakpoint:', error);
            alert(`Error setting breakpoint: ${error.message}`);
        }
    }

    /**
     * Remove a breakpoint by ID
     * Public API for other controllers
     * @param {string} breakpointId - ID of the breakpoint to remove
     */
    async removeBreakpoint(breakpointId) {
        await this.handleRemoveBreakpoint(breakpointId);
    }

    /**
     * Normalize URL format
     * Ensure file:// prefix for absolute paths
     * @param {string} url - The URL to normalize
     * @returns {string} Normalized URL
     */
    normalizeUrl(url) {
        if (!url) return url;

        // If it's an absolute path without file://, add the prefix
        if (url.startsWith('/') && !url.startsWith('file://')) {
            return 'file://' + url;
        }

        return url;
    }

    /**
     * Extract filename from URL
     * @param {string} url - The file URL
     * @returns {string} The filename
     */
    getFileName(url) {
        if (!url) return 'unknown';

        // Remove file:// prefix
        let path = url.replace('file://', '');

        // Get the last part of the path
        const parts = path.split('/');
        return parts[parts.length - 1] || url;
    }
}
