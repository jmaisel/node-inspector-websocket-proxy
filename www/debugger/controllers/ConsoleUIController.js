import { DockableUIController } from './DockableUIController.js';
import { TemplateRegistry, generateInstanceId } from '../TemplateRegistry.js';
import { consoleTemplate, logEntryTemplate } from '../templates/console-template.js';

/**
 * ConsoleUIController - Manages console output, search, and docking behavior
 *
 * Supports two modes:
 * 1. Standalone: Generates its own HTML from template
 * 2. Embedded: Uses existing HTML in the DOM
 *
 * @example
 * // Standalone with default template
 * const console = new ConsoleUIController();
 * console.mount('#tab-console', 'body');
 * console.initialize();
 *
 * // Embedded with existing HTML
 * const console = new ConsoleUIController({
 *     instanceId: 'console',
 *     skipRender: true
 * });
 * console.initialize();
 *
 * // With custom template
 * TemplateRegistry.register('console', myCustomTemplate);
 * const console = new ConsoleUIController();
 */
export class ConsoleUIController extends DockableUIController {
    constructor(config = {}) {
        const instanceId = config.instanceId || generateInstanceId('console');

        // Configure the dockable behavior
        // Note: $element will be set after render() or in initialize() for embedded mode
        super({
            $element: config.skipRender ? $(`#${instanceId}-dock`) : null,
            storagePrefix: config.storagePrefix || 'console',
            draggableConfig: {
                handle: `#${instanceId}-dock-grip`,
                containment: 'window',
                disabled: true
            },
            resizableConfig: {
                handles: 'n, e, s, w, ne, nw, se, sw',
                minHeight: 100,
                minWidth: 300,
                maxHeight: 600
            }
        });

        this.instanceId = instanceId;
        this.debuggerUI = config.debuggerUI || null;
        this.skipRender = config.skipRender || false;

        // State
        this.consoleAutoScroll = true;
        this.consoleDockAutoScroll = true;
        this.logEntries = [];

        // Store references (will be set after render/mount)
        this.$tabPane = null;
        this.$log = null;
        this.$logDock = null;
    }

    /**
     * Render HTML from template
     * @returns {Object} Object with tabPane and dockPanel HTML strings
     */
    render() {
        const template = TemplateRegistry.get('console') || consoleTemplate;
        return template({
            showRedockPlaceholder: false,
            logEntries: this.logEntries
        }, this.instanceId);
    }

    /**
     * Mount the console into DOM containers
     * @param {string|jQuery} tabContainer - Container for tab pane (e.g., '#tab-console' or '.tab-content')
     * @param {string|jQuery} dockContainer - Container for dock panel (e.g., 'body')
     */
    mount(tabContainer, dockContainer = 'body') {
        if (this.skipRender) {
            // Use existing HTML
            this.$element = $(`#${this.instanceId}-dock`);
            this.$tabPane = $(`#${this.instanceId}-tab-pane`);
            this.$log = $(`#${this.instanceId}-log`);
            this.$logDock = $(`#${this.instanceId}-log-dock`);
            return;
        }

        const html = this.render();

        // Inject tab pane
        if (tabContainer) {
            $(tabContainer).append(html.tabPane);
            this.$tabPane = $(`#${this.instanceId}-tab-pane`);
            this.$log = $(`#${this.instanceId}-log`);
        }

        // Inject dock panel
        $(dockContainer).append(html.dockPanel);
        this.$element = $(`#${this.instanceId}-dock`);
        this.$logDock = $(`#${this.instanceId}-log-dock`);
    }

    /**
     * Log a message to both console views
     * @param {string} message - The message to log
     * @param {string} type - Log type ('info', 'error', 'event')
     */
    log(message, type = 'info') {
        // Add to log entries array
        const timestamp = new Date().toLocaleTimeString();
        this.logEntries.push({ timestamp, message, type });

        // Keep last 1000 entries
        if (this.logEntries.length > 1000) {
            this.logEntries.shift();
        }

        // Remove empty state if exists
        $(`#${this.instanceId}-log .empty-state`).remove();
        $(`#${this.instanceId}-log-dock .empty-state`).remove();

        const logHtml = logEntryTemplate({ timestamp, message, type });

        // Add to both console views
        $(`#${this.instanceId}-log`).append(logHtml);
        $(`#${this.instanceId}-log-dock`).append(logHtml);

        // Auto-scroll if at bottom
        const debugLogEl = $(`#${this.instanceId}-log`)[0];
        if (this.consoleAutoScroll && debugLogEl) {
            debugLogEl.scrollTop = debugLogEl.scrollHeight;
        }

        const debugLogDockEl = $(`#${this.instanceId}-log-dock`)[0];
        if (this.consoleDockAutoScroll && debugLogDockEl) {
            debugLogDockEl.scrollTop = debugLogDockEl.scrollHeight;
        }

        // Apply current search filter
        this.filterConsoleEntries();
    }

    /**
     * Filter console entries based on search text and regex option
     */
    filterConsoleEntries() {
        const searchText = $(`#${this.instanceId}-search-input`).val() || $(`#${this.instanceId}-search-input-dock`).val();
        const useRegex = $(`#${this.instanceId}-search-regex`).is(':checked') || $(`#${this.instanceId}-search-regex-dock`).is(':checked');

        if (!searchText) {
            $('.log-entry').removeClass('hidden').each(function() {
                $(this).html($(this).text());
            });
            return;
        }

        let pattern;
        try {
            pattern = useRegex ? new RegExp(searchText, 'gi') : null;
        } catch (e) {
            // Invalid regex, treat as plain text
            pattern = null;
        }

        $('.log-entry').each(function() {
            const entry = $(this);
            const text = entry.text();

            let matches = false;
            if (pattern) {
                matches = pattern.test(text);
            } else {
                matches = text.toLowerCase().includes(searchText.toLowerCase());
            }

            if (matches) {
                entry.removeClass('hidden');
                // Highlight matches
                let highlightedText = text;
                if (pattern) {
                    highlightedText = text.replace(pattern, match => `<mark>${match}</mark>`);
                } else {
                    const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                    highlightedText = text.replace(regex, match => `<mark>${match}</mark>`);
                }
                entry.html(highlightedText);
            } else {
                entry.addClass('hidden');
            }
        });
    }

    /**
     * Undock console to a floating window (implements DockableUIController.undock)
     */
    undock() {
        // Keep console tab visible, but show redock placeholder in tab content
        $('.console-container').addClass('undocked-mode');
        $(`#${this.instanceId}-tab-pane`).addClass('show-redock-placeholder');

        // Remove docked class, add floating class
        this.$element.removeClass('docked').addClass('floating');

        // Restore saved position or center it
        const savedPos = this.restorePosition();
        if (savedPos) {
            this.applyPosition({
                top: savedPos.top,
                left: savedPos.left,
                bottom: 'auto',
                right: 'auto'
            });
        } else {
            // Center the console panel
            const pos = this.centerInWindow(600, 300);
            this.applyPosition({
                top: pos.top,
                left: pos.left,
                bottom: 'auto',
                right: 'auto'
            });
        }

        // Show the dock first
        this.$element.show();

        // Enable draggable and resizable for floating mode
        this.setDraggableEnabled(true);
        this.setResizableEnabled(true);
        this.setResizableOption('handles', 'n, e, s, w, ne, nw, se, sw');
        this.setResizableOption('maxHeight', 800);

        // Save state
        this.saveDockState(false);

        // Add hover effect on console tab when console is undocked
        const $consoleTab = $('.tab-btn[data-tab="console"]');
        $consoleTab.on('mouseenter.consoledock', () => {
            $consoleTab.addClass('pulsate-dock-target');
        }).on('mouseleave.consoledock', () => {
            // Only remove if not currently dragging
            if (!this.$element.hasClass('ui-draggable-dragging')) {
                $consoleTab.removeClass('pulsate-dock-target');
            }
        });
    }

    /**
     * Redock console to the tab panel (implements DockableUIController.dock)
     */
    dock() {
        // Remove undocked mode from console tab
        $('.console-container').removeClass('undocked-mode');
        $(`#${this.instanceId}-tab-pane`).removeClass('show-redock-placeholder');

        // Remove hover listeners
        const $consoleTab = $('.tab-btn[data-tab="console"]');
        $consoleTab.off('.consoledock');
        $consoleTab.removeClass('pulsate-dock-target');

        // Disable draggable
        this.setDraggableEnabled(false);

        // Configure resizable for docked mode (only top handle)
        this.setResizableOption('handles', 'n');
        this.setResizableOption('maxHeight', 600);

        // Remove floating class, add docked class
        this.$element.removeClass('floating').addClass('docked');

        // Reset to bottom docked position
        this.applyPosition({ top: 'auto', left: 0, right: 0, bottom: 0 });

        // Hide floating window
        this.$element.hide();

        // Save state
        this.saveDockState(true);

        // Force scroll to bottom after tab is displayed if auto-scroll is enabled
        setTimeout(() => {
            const debugLogEl = $(`#${this.instanceId}-log`)[0];
            if (this.consoleAutoScroll && debugLogEl) {
                debugLogEl.scrollTop = debugLogEl.scrollHeight;
            }
        }, 50);
    }

    /**
     * Undock console to a floating window (public API for backwards compatibility)
     */
    undockConsole() {
        this.undock();
    }

    /**
     * Redock console to the tab panel (public API for backwards compatibility)
     */
    redockConsole() {
        this.dock();
    }

    /**
     * Clear console output
     */
    clearConsole() {
        this.logEntries = [];
        $(`#${this.instanceId}-log`).html('<div class="empty-state">No console output</div>');
        $(`#${this.instanceId}-log-dock`).html('<div class="empty-state">No console output</div>');
    }

    /**
     * Setup event handlers for console interactions
     */
    setupEventHandlers() {
        // Search input handlers
        $(`#${this.instanceId}-search-input, #${this.instanceId}-search-input-dock`).on('input', () => {
            const val = $(`#${this.instanceId}-search-input`).val() || $(`#${this.instanceId}-search-input-dock`).val();
            $(`#${this.instanceId}-search-input, #${this.instanceId}-search-input-dock`).val(val);
            this.filterConsoleEntries();
        });

        // Search regex toggle
        $(`#${this.instanceId}-search-regex, #${this.instanceId}-search-regex-dock`).on('change', () => {
            const checked = $(`#${this.instanceId}-search-regex`).is(':checked') || $(`#${this.instanceId}-search-regex-dock`).is(':checked');
            $(`#${this.instanceId}-search-regex, #${this.instanceId}-search-regex-dock`).prop('checked', checked);
            this.filterConsoleEntries();
        });

        // Clear search
        $(`#${this.instanceId}-clear-search, #${this.instanceId}-clear-search-dock`).on('click', () => {
            $(`#${this.instanceId}-search-input, #${this.instanceId}-search-input-dock`).val('');
            this.filterConsoleEntries();
        });

        // Toggle search visibility
        $(`#${this.instanceId}-search-toggle`).on('click', () => {
            $('.console-search-wrapper').first().toggleClass('collapsed');
        });

        $(`#${this.instanceId}-search-toggle-dock`).on('click', () => {
            $(`#${this.instanceId}-dock .console-search-wrapper`).toggleClass('collapsed');
        });

        // Dock/undock handlers
        $(`#${this.instanceId}-undock-btn`).on('click', () => {
            this.undockConsole();
        });

        $(`#${this.instanceId}-redock-btn, #${this.instanceId}-redock-large-btn`).on('click', () => {
            this.redockConsole();
        });

        // Scroll handlers for auto-scroll detection
        $(`#${this.instanceId}-log`).on('scroll', () => {
            const el = $(`#${this.instanceId}-log`)[0];
            this.consoleAutoScroll = isScrolledToBottom(el);
        });

        $(`#${this.instanceId}-log-dock`).on('scroll', () => {
            const el = $(`#${this.instanceId}-log-dock`)[0];
            this.consoleDockAutoScroll = isScrolledToBottom(el);
        });
    }

    /**
     * Setup console dock draggable and resizable behavior
     */
    setupConsoleDock() {
        const $consoleTab = $('.tab-btn[data-tab="console"]');

        // Initialize draggable with zone snapping using base class helper
        this.setupDraggableWithZoneSnapping($consoleTab, () => {
            // Snap callback - redock the console
            this.dock();
        }, {
            // Use larger threshold for tab detection
            drag: (event, ui) => {
                if (this.isNearTarget(ui.offset, $consoleTab, 100)) {
                    this.highlightTarget($consoleTab);
                } else {
                    this.unhighlightTarget($consoleTab);
                }
            }
        });

        // Initialize resizable
        this.initResizable();
    }

    /**
     * Initialize the console
     */
    initialize() {
        // If skipRender, ensure we have references to existing elements
        if (this.skipRender) {
            this.$element = $(`#${this.instanceId}-dock`);
            this.$tabPane = $(`#${this.instanceId}-tab-pane`);
            this.$log = $(`#${this.instanceId}-log`);
            this.$logDock = $(`#${this.instanceId}-log-dock`);
        }

        this.setupEventHandlers();
        this.setupConsoleDock();

        // Expose log function globally for other components
        window.log = (message, type) => this.log(message, type);
    }
}