/**
 * ConsoleController - Manages console output and search
 *
 * Responsibilities:
 * - Render console from template (with TemplateRegistry override support)
 * - Subscribe to Runtime.consoleAPICalled and Runtime.exceptionThrown
 * - Log messages with timestamps
 * - Search/filter with regex support
 * - Dual-mode rendering (tabbed + floating dock)
 * - Auto-scroll detection
 * - Expose global log() function
 *
 * Features:
 * - Console log with timestamps
 * - Search with regex toggle
 * - Highlight matches
 * - Dual-mode: tabbed (in tab system) + floating (TODO: draggable)
 * - Undock/redock functionality (simplified version)
 */

import { TemplateRegistry } from '../core/TemplateRegistry.js';
import { consoleTemplate } from '../templates/console-template.js';

export class ConsoleController {
    constructor(config = {}) {
        this.eventQueue = config.eventQueue;
        this.proxy = config.proxy;
        this.container = config.container || '#console';
        this.instanceId = config.instanceId || 'console-' + Date.now();
        this.tabSystem = config.tabSystem;  // Reference to TabSystemController

        // State
        this.mode = 'tabbed';  // 'tabbed' or 'floating'
        this.wasUndocked = false;
        this.logEntries = [];  // Array of { timestamp, message, type }
        this.searchText = '';
        this.useRegex = false;
        this.searchExpanded = false;
        this.autoScroll = true;

        console.log('[ConsoleController] Created');
    }

    /**
     * Initialize - render and setup
     */
    async initialize() {
        console.log('[ConsoleController] Initializing...');

        // Render the template
        this.render();

        // Setup event handlers
        this.setupDOMEventHandlers();

        // Subscribe to events
        this.subscribeToEvents();

        // Expose global log function
        window.log = (message, type = 'info') => {
            this.log(message, type);
        };

        console.log('[ConsoleController] Initialized');
    }

    /**
     * Render console from template (with TemplateRegistry override support)
     */
    render() {
        // Check TemplateRegistry first, fall back to default template
        const templateFn = TemplateRegistry.get('console') || consoleTemplate;

        const html = templateFn({
            mode: this.mode,
            searchExpanded: this.searchExpanded,
            logEntries: this.logEntries,
            showRedockPlaceholder: this.mode === 'tabbed' && this.wasUndocked
        }, {}, this.instanceId);

        // Insert based on mode
        if (this.mode === 'tabbed' && this.tabSystem) {
            // Render into tab pane
            const tabPaneSelector = this.tabSystem.getTabPaneSelector('console');
            $(tabPaneSelector).html(html);
        } else {
            // Render into dedicated container
            $(this.container).html(html);
        }

        console.log('[ConsoleController] Rendered', this.logEntries.length, 'log entries');
    }

    /**
     * Setup DOM event handlers
     */
    setupDOMEventHandlers() {
        // Search toggle
        $(`#${this.instanceId}-search-toggle`).on('click', () => {
            this.searchExpanded = !this.searchExpanded;
            this.render();
            this.setupDOMEventHandlers();
        });

        // Search input
        $(`#${this.instanceId}-search-input`).on('input', (e) => {
            this.searchText = $(e.currentTarget).val();
            this.filterLogEntries();
        });

        // Regex toggle
        $(`#${this.instanceId}-regex-toggle`).on('change', (e) => {
            this.useRegex = $(e.currentTarget).is(':checked');
            this.filterLogEntries();
        });

        // Clear search
        $(`#${this.instanceId}-clear-search`).on('click', () => {
            this.searchText = '';
            this.useRegex = false;
            $(`#${this.instanceId}-search-input`).val('');
            $(`#${this.instanceId}-regex-toggle`).prop('checked', false);
            this.filterLogEntries();
        });

        // Undock button
        $(`#${this.instanceId}-undock-btn`).on('click', () => {
            this.undock();
        });

        // Redock button (large button in placeholder)
        $(`#${this.instanceId}-redock-large-btn`).on('click', () => {
            this.redock();
        });

        // Redock button (in floating mode)
        $(`#${this.instanceId}-redock-btn`).on('click', () => {
            this.redock();
        });

        // Auto-scroll detection
        $(`#${this.instanceId}-log`).on('scroll', (e) => {
            const logEl = e.currentTarget;
            const isAtBottom = logEl.scrollHeight - logEl.scrollTop <= logEl.clientHeight + 50;
            this.autoScroll = isAtBottom;
        });

        console.log('[ConsoleController] DOM event handlers setup');
    }

    /**
     * Subscribe to events on the queue
     */
    subscribeToEvents() {
        // Console API calls (console.log, console.warn, etc.)
        this.eventQueue.subscribe('Runtime.consoleAPICalled', (topic, data) => {
            const type = data.type || 'log';  // log, warning, error, info, debug
            const args = data.args || [];

            // Format message from arguments
            const message = args.map(arg => {
                if (arg.type === 'string') {
                    return arg.value;
                } else if (arg.description) {
                    return arg.description;
                } else {
                    return String(arg.value);
                }
            }).join(' ');

            this.log(message, type);
        });

        // Exception thrown
        this.eventQueue.subscribe('Runtime.exceptionThrown', (topic, data) => {
            const exception = data.exceptionDetails?.exception;
            const message = exception?.description || exception?.value || 'Unknown error';
            this.log(message, 'error');
        });

        console.log('[ConsoleController] Subscribed to queue events');
    }

    /**
     * Log a message to the console
     * @param {string} message - The message to log
     * @param {string} type - Log type ('info', 'log', 'warning', 'error', 'debug', 'event')
     */
    log(message, type = 'info') {
        // Map CDP types to our types
        const typeMap = {
            'log': 'info',
            'warning': 'warning',
            'error': 'error',
            'info': 'info',
            'debug': 'info',
            'event': 'event'
        };

        const mappedType = typeMap[type] || 'info';

        // Add to log entries
        const timestamp = new Date().toLocaleTimeString();
        this.logEntries.push({
            timestamp: timestamp,
            message: message,
            type: mappedType
        });

        // Keep last 1000 entries to prevent memory issues
        if (this.logEntries.length > 1000) {
            this.logEntries.shift();
        }

        // Re-render
        this.render();

        // Re-setup event handlers
        this.setupDOMEventHandlers();

        // Apply search filter if active
        if (this.searchText) {
            this.filterLogEntries();
        }

        // Auto-scroll if at bottom
        if (this.autoScroll) {
            const logEl = $(`#${this.instanceId}-log`)[0];
            if (logEl) {
                logEl.scrollTop = logEl.scrollHeight;
            }
        }
    }

    /**
     * Filter console log entries based on search text
     */
    filterLogEntries() {
        if (!this.searchText) {
            // Show all entries
            $(`#${this.instanceId}-log .log-entry`).removeClass('hidden').each(function() {
                const $entry = $(this);
                // Remove highlights
                $entry.html($entry.text());
            });
            return;
        }

        let pattern;
        try {
            pattern = this.useRegex ? new RegExp(this.searchText, 'gi') : null;
        } catch (e) {
            // Invalid regex, treat as plain text
            pattern = null;
        }

        $(`#${this.instanceId}-log .log-entry`).each(function() {
            const $entry = $(this);
            const text = $entry.text();

            let matches = false;
            if (pattern) {
                matches = pattern.test(text);
            } else {
                matches = text.toLowerCase().includes(this.searchText.toLowerCase());
            }

            if (matches) {
                $entry.removeClass('hidden');
                // Highlight matches
                let highlightedText = text;
                if (pattern) {
                    highlightedText = text.replace(pattern, match => `<mark>${match}</mark>`);
                } else {
                    const regex = new RegExp(this.searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                    highlightedText = text.replace(regex, match => `<mark>${match}</mark>`);
                }
                $entry.html(highlightedText);
            } else {
                $entry.addClass('hidden');
            }
        }.bind(this));
    }

    /**
     * Undock console to floating mode
     * TODO: Add jQuery UI draggable support for full v1 feature parity
     */
    undock() {
        console.log('[ConsoleController] Undocking console');

        this.mode = 'floating';
        this.wasUndocked = true;

        // Re-render
        this.render();
        this.setupDOMEventHandlers();

        // Show floating console
        $(`#${this.instanceId}`).show();

        // TODO: Enable draggable (requires jQuery UI)
        // $(`#${this.instanceId}`).draggable({
        //     handle: `#${this.instanceId}-dock-grip`,
        //     containment: 'window'
        // });
    }

    /**
     * Redock console to tabbed mode
     */
    redock() {
        console.log('[ConsoleController] Redocking console');

        this.mode = 'tabbed';
        this.wasUndocked = false;

        // Re-render
        this.render();
        this.setupDOMEventHandlers();

        // Switch to console tab
        if (this.tabSystem) {
            this.tabSystem.switchToTab('console');
        }
    }

    /**
     * Clear all log entries
     */
    clearLog() {
        this.logEntries = [];
        this.render();
        this.setupDOMEventHandlers();
    }
}
