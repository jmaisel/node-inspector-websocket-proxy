import { BaseUIController } from './BaseUIController.js';

/**
 * BreakpointUIController - Manages breakpoint display and operations
 */
export class BreakpointUIController extends BaseUIController {
    constructor() {
        super();
        this.breakpoints = new Map(); // breakpointId -> { url, lineNumber, enabled }
        this.nextTempId = 1; // For UI display before breakpoint is resolved
    }

    /**
     * Render the breakpoints list
     */
    renderBreakpoints() {
        const $list = $('#breakpointsList');

        if (this.breakpoints.size === 0) {
            $list.html('<div class="empty-state">No breakpoints set</div>');
            return;
        }

        $list.empty();

        this.breakpoints.forEach((bp, breakpointId) => {
            const fileName = this.getFileName(bp.url);
            const enabledClass = bp.enabled ? 'enabled' : 'disabled';
            const checkboxChecked = bp.enabled ? 'checked' : '';

            const bpHtml = `
                <div class="breakpoint-item ${enabledClass}" data-breakpoint-id="${breakpointId}">
                    <input type="checkbox"
                           class="bp-toggle"
                           ${checkboxChecked}
                           data-breakpoint-id="${breakpointId}">
                    <div class="bp-info">
                        <div class="bp-location" title="${bp.url}">
                            ${fileName}:${bp.lineNumber}
                        </div>
                    </div>
                    <button class="bp-remove-btn"
                            data-breakpoint-id="${breakpointId}"
                            title="Remove breakpoint">×</button>
                </div>
            `;

            $list.append(bpHtml);
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

        if (!debuggerController || !debuggerController.client) {
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
            const result = await debuggerController.client.debugger.setBreakpointByUrl(
                protocolLine,
                normalizedUrl
            );

            console.log('Breakpoint set result:', result);
            console.log('Available scripts in debugger:', Array.from(debuggerController.scriptMap.entries()));

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
                    console.log('Breakpoint resolved to locations:', result.locations);
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
            console.error('Breakpoint error:', error);
        }
    }

    /**
     * Remove a breakpoint
     * @param {string} breakpointId - The breakpoint ID to remove
     */
    async removeBreakpoint(breakpointId) {
        if (!debuggerController || !debuggerController.client) {
            log('Not connected to debugger', 'error');
            return;
        }

        try {
            await debuggerController.client.debugger.removeBreakpoint(breakpointId);
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

        if (!debuggerController || !debuggerController.client) {
            log('Not connected to debugger', 'error');
            return;
        }

        try {
            if (bp.enabled) {
                // Disable by removing and storing state
                await debuggerController.client.debugger.removeBreakpoint(breakpointId);
                bp.enabled = false;
                log(`Breakpoint disabled: ${breakpointId}`, 'info');
            } else {
                // Re-enable by setting again
                const protocolLine = bp.lineNumber - 1;
                const result = await debuggerController.client.debugger.setBreakpointByUrl(
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
        if (!debuggerController || !debuggerController.client) {
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
        const url = $('#bpUrl').val().trim();
        const lineNumber = parseInt($('#bpLine').val(), 10);

        if (!url || isNaN(lineNumber) || lineNumber < 1) {
            log('Please enter a valid URL and line number', 'error');
            return;
        }

        this.addBreakpoint(url, lineNumber);

        // Clear inputs
        $('#bpUrl').val('');
        $('#bpLine').val('');
    }

    /**
     * Setup event handlers for breakpoint interactions
     */
    setupEventHandlers() {
        // Add breakpoint button
        $(document).on('click', '#addBreakpointBtn', () => {
            this.handleAddBreakpoint();
        });

        // Enter key in inputs
        $(document).on('keypress', '#bpUrl, #bpLine', (e) => {
            if (e.which === 13) { // Enter key
                this.handleAddBreakpoint();
            }
        });

        // Remove breakpoint button
        $(document).on('click', '.bp-remove-btn', (e) => {
            const breakpointId = $(e.currentTarget).data('breakpoint-id');
            this.removeBreakpoint(breakpointId);
        });

        // Toggle breakpoint checkbox
        $(document).on('change', '.bp-toggle', (e) => {
            const breakpointId = $(e.currentTarget).data('breakpoint-id');
            this.toggleBreakpoint(breakpointId);
        });

        // Expose globally for debugger controller events
        window.breakpointController = this;
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
        this.setupEventHandlers();
        this.renderBreakpoints();
    }
}