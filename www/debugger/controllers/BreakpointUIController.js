import { BaseUIController } from './BaseUIController.js';
import { TemplateRegistry, generateInstanceId } from '../TemplateRegistry.js';
import { breakpointsTemplate, breakpointItemTemplate } from '../templates/breakpoints-template.js';

/**
 * BreakpointUIController - Manages breakpoint display and operations
 *
 * Supports two modes:
 * 1. Standalone: Generates its own HTML from template
 * 2. Embedded: Uses existing HTML in the DOM
 *
 * @example
 * // Standalone with default template
 * const breakpoints = new BreakpointUIController();
 * breakpoints.mount('.tab-content');
 * breakpoints.initialize();
 *
 * // Embedded with existing HTML
 * const breakpoints = new BreakpointUIController({
 *     instanceId: 'breakpoints',
 *     skipRender: true
 * });
 * breakpoints.initialize();
 */
export class BreakpointUIController extends BaseUIController {
    constructor(config = {}) {
        super();

        const instanceId = config.instanceId || generateInstanceId('breakpoints');

        this.instanceId = instanceId;
        this.debuggerUI = config.debuggerUI || null;
        this.skipRender = config.skipRender || false;
        this.logger = new Logger("BreakpointUIController");

        this.breakpoints = new Map(); // breakpointId -> { url, lineNumber, enabled }
        this.nextTempId = 1; // For UI display before breakpoint is resolved

        // Store references (will be set after render/mount)
        this.$list = null;
    }

    /**
     * Render HTML from template
     * @returns {string} HTML string
     */
    render() {
        const template = TemplateRegistry.get('breakpoints') || breakpointsTemplate;
        return template({
            emptyMessage: 'No breakpoints set',
            urlPlaceholder: 'File URL or path',
            linePlaceholder: 'Line #'
        }, this.instanceId);
    }

    /**
     * Mount the breakpoints into a DOM container
     * @param {string|jQuery} container - Container for tab pane (e.g., '.tab-content')
     */
    mount(container) {
        if (this.skipRender) {
            // Use existing HTML
            this.$list = $(`#${this.instanceId}-list`);
            return;
        }

        const html = this.render();
        $(container).append(html);
        this.$list = $(`#${this.instanceId}-list`);
    }

    /**
     * Render the breakpoints list
     */
    renderBreakpoints() {
        if (this.breakpoints.size === 0) {
            this.$list.html('<div class="empty-state">No breakpoints set</div>');
            return;
        }

        this.$list.empty();

        this.breakpoints.forEach((bp, breakpointId) => {
            const fileName = this.getFileName(bp.url);

            const bpHtml = breakpointItemTemplate({
                breakpointId,
                fileName,
                url: bp.url,
                lineNumber: bp.lineNumber,
                enabled: bp.enabled
            });

            this.$list.append(bpHtml);
        });
    }

    /**
     * Extract filename from URL
     * @param {string} url - The file URL
     * @returns {string} The filename
     */
    getFileName(url) {
        if (!url) return 'unknown';
        const parts = url.split('/');
        return parts[parts.length - 1] || url;
    }

    /**
     * Add a new breakpoint
     * @param {string} url - File URL or path
     * @param {number} lineNumber - Line number (1-indexed)
     */
    async addBreakpoint(url, lineNumber) {
        if (!url || !lineNumber) {
            log('Invalid breakpoint: URL and line number required', 'error');
            return;
        }

        if (!this.debuggerUI?.debuggerController || !this.debuggerUI.debuggerController.client) {
            log('Not connected to debugger', 'error');
            return;
        }

        try {
            // Normalize URL format - ensure file:// prefix for absolute paths
            let normalizedUrl = url;
            if (url.startsWith('/') && !url.startsWith('file://')) {
                normalizedUrl = 'file://' + url;
                log(`Normalized URL to: ${normalizedUrl}`, 'info');
            }

            // Convert to 0-indexed for protocol
            const protocolLine = lineNumber - 1;

            log(`Setting breakpoint at ${normalizedUrl}:${lineNumber}`, 'info');

            // Try with normalized URL first
            const result = await this.debuggerUI.debuggerController.client.debugger.setBreakpointByUrl(
                protocolLine,
                normalizedUrl
            );

            this.logger.info('Breakpoint set result:', result);
            this.logger.info('Available scripts in debugger:', Array.from(this.debuggerUI.debuggerController.scriptMap.entries()));

            if (result.breakpointId) {
                // Store the breakpoint
                this.breakpoints.set(result.breakpointId, {
                    url: url,
                    lineNumber: lineNumber, // Store as 1-indexed for display
                    enabled: true
                });

                log(`Breakpoint set: ${result.breakpointId} at ${url}:${lineNumber}`, 'info');

                // Log resolved locations if available
                if (result.locations && result.locations.length > 0) {
                    this.logger.info('Breakpoint resolved to locations:', result.locations);
                    log(`Breakpoint resolved (${result.locations.length} location(s))`, 'info');
                } else {
                    log('Breakpoint set but not yet resolved - will resolve when script loads', 'info');
                }

                this.renderBreakpoints();
            } else {
                log('Breakpoint set but no breakpointId returned', 'error');
            }
        } catch (error) {
            log(`Failed to set breakpoint: ${error.message}`, 'error');
            this.logger.error('Breakpoint error:', error);
        }
    }

    /**
     * Remove a breakpoint
     * @param {string} breakpointId - The breakpoint ID to remove
     */
    async removeBreakpoint(breakpointId) {
        if (!this.debuggerUI?.debuggerController || !this.debuggerUI.debuggerController.client) {
            log('Not connected to debugger', 'error');
            return;
        }

        try {
            await this.debuggerUI.debuggerController.client.debugger.removeBreakpoint(breakpointId);
            this.breakpoints.delete(breakpointId);

            log(`Breakpoint removed: ${breakpointId}`, 'info');
            this.renderBreakpoints();
        } catch (error) {
            log(`Failed to remove breakpoint: ${error.message}`, 'error');
        }
    }

    /**
     * Toggle breakpoint enabled/disabled state
     * @param {string} breakpointId - The breakpoint ID to toggle
     */
    async toggleBreakpoint(breakpointId) {
        const bp = this.breakpoints.get(breakpointId);
        if (!bp) return;

        if (!this.debuggerUI?.debuggerController || !this.debuggerUI.debuggerController.client) {
            log('Not connected to debugger', 'error');
            return;
        }

        try {
            if (bp.enabled) {
                // Disable by removing and storing state
                await this.debuggerUI.debuggerController.client.debugger.removeBreakpoint(breakpointId);
                bp.enabled = false;
                log(`Breakpoint disabled: ${breakpointId}`, 'info');
            } else {
                // Re-enable by setting again
                const protocolLine = bp.lineNumber - 1;
                const result = await this.debuggerUI.debuggerController.client.debugger.setBreakpointByUrl(
                    protocolLine,
                    bp.url
                );

                if (result.breakpointId) {
                    // Update with new ID
                    this.breakpoints.delete(breakpointId);
                    this.breakpoints.set(result.breakpointId, {
                        url: bp.url,
                        lineNumber: bp.lineNumber,
                        enabled: true
                    });
                    log(`Breakpoint enabled: ${result.breakpointId}`, 'info');
                }
            }

            this.renderBreakpoints();
        } catch (error) {
            log(`Failed to toggle breakpoint: ${error.message}`, 'error');
        }
    }

    /**
     * Clear all breakpoints
     */
    async clearAllBreakpoints() {
        if (!this.debuggerUI?.debuggerController || !this.debuggerUI.debuggerController.client) {
            return;
        }

        const promises = Array.from(this.breakpoints.keys()).map(id =>
            this.removeBreakpoint(id)
        );

        await Promise.all(promises);
    }

    /**
     * Handle add breakpoint form submission
     */
    handleAddBreakpoint() {
        const url = $(`#${this.instanceId}-url`).val().trim();
        const lineNumber = parseInt($(`#${this.instanceId}-line`).val(), 10);

        if (!url || isNaN(lineNumber) || lineNumber < 1) {
            log('Please enter a valid URL and line number', 'error');
            return;
        }

        this.addBreakpoint(url, lineNumber);

        // Clear inputs
        $(`#${this.instanceId}-url`).val('');
        $(`#${this.instanceId}-line`).val('');
    }

    /**
     * Setup event handlers for breakpoint interactions
     */
    setupEventHandlers() {
        // Add breakpoint button
        $(`#${this.instanceId}-add-btn`).on('click', () => {
            this.handleAddBreakpoint();
        });

        // Enter key in inputs
        $(`#${this.instanceId}-url, #${this.instanceId}-line`).on('keypress', (e) => {
            if (e.which === 13) { // Enter key
                this.handleAddBreakpoint();
            }
        });

        // Remove breakpoint button (delegated event for dynamically added elements)
        $(document).on('click', '.bp-remove-btn', (e) => {
            const breakpointId = $(e.currentTarget).data('breakpoint-id');
            this.removeBreakpoint(breakpointId);
        });

        // Toggle breakpoint checkbox (delegated event for dynamically added elements)
        $(document).on('change', '.bp-toggle', (e) => {
            const breakpointId = $(e.currentTarget).data('breakpoint-id');
            this.toggleBreakpoint(breakpointId);
        });
    }

    /**
     * Handle breakpoint resolved event from debugger
     * @param {Object} event - The breakpointResolved event
     */
    handleBreakpointResolved(event) {
        const bp = this.breakpoints.get(event.breakpointId);
        if (bp) {
            bp.resolved = true;
            bp.actualLocation = event.location;
            log(`✓ Breakpoint resolved at ${bp.url}:${event.location.lineNumber + 1}`, 'info');
            this.renderBreakpoints();
        }
    }

    /**
     * Initialize the breakpoint controller
     */
    initialize() {
        // If skipRender, ensure we have references to existing elements
        if (this.skipRender) {
            this.$list = $(`#${this.instanceId}-list`);
        }

        this.setupEventHandlers();
        this.renderBreakpoints();
    }
}