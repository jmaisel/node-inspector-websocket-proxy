/**
 * ConsoleUIController - Manages console output, search, and docking behavior
 */
class ConsoleUIController extends DockableUIController {
    constructor() {
        // Configure the dockable behavior
        super({
            $element: $('#consoleDock'),
            storagePrefix: 'console',
            draggableConfig: {
                handle: '#consoleDockGrip',
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

        this.consoleAutoScroll = true;
        this.consoleDockAutoScroll = true;
    }

    /**
     * Log a message to both console views
     * @param {string} message - The message to log
     * @param {string} type - Log type ('info', 'error', 'event')
     */
    log(message, type = 'info') {
        // Remove empty state if exists
        $('#debugLog .empty-state').remove();
        $('#debugLogDock .empty-state').remove();

        const timestamp = new Date().toLocaleTimeString();
        const logHtml = `<div class="log-entry ${type}">[${timestamp}] ${message}</div>`;

        // Add to both console views
        $('#debugLog').append(logHtml);
        $('#debugLogDock').append(logHtml);

        // Auto-scroll if at bottom - #debugLog IS the scrollable container
        const debugLogEl = $('#debugLog')[0];
        if (this.consoleAutoScroll && debugLogEl) {
            debugLogEl.scrollTop = debugLogEl.scrollHeight;
        }

        const debugLogDockEl = $('#debugLogDock')[0];
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
        const searchText = $('#consoleSearchInput').val() || $('#consoleSearchInputDock').val();
        const useRegex = $('#consoleSearchRegex').is(':checked') || $('#consoleSearchRegexDock').is(':checked');

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
        $('#tab-console').addClass('show-redock-placeholder');

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
        $('.tab-btn[data-tab="console"]').on('mouseenter.consoledock', () => {
            $(this).addClass('pulsate-dock-target');
        }).on('mouseleave.consoledock', () => {
            // Only remove if not currently dragging
            if (!this.$element.hasClass('ui-draggable-dragging')) {
                $(this).removeClass('pulsate-dock-target');
            }
        });
    }

    /**
     * Redock console to the tab panel (implements DockableUIController.dock)
     */
    dock() {
        // Remove undocked mode from console tab
        $('.console-container').removeClass('undocked-mode');
        $('#tab-console').removeClass('show-redock-placeholder');

        // Remove hover listeners
        $('.tab-btn[data-tab="console"]').off('.consoledock');
        $('.tab-btn[data-tab="console"]').removeClass('pulsate-dock-target');

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
            const debugLogEl = $('#debugLog')[0];
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
        $('#debugLog').html('<div class="empty-state">No console output</div>');
        $('#debugLogDock').html('<div class="empty-state">No console output</div>');
    }

    /**
     * Setup event handlers for console interactions
     */
    setupEventHandlers() {
        // Search input handlers
        $('#consoleSearchInput, #consoleSearchInputDock').on('input', () => {
            const val = $('#consoleSearchInput').val() || $('#consoleSearchInputDock').val();
            $('#consoleSearchInput, #consoleSearchInputDock').val(val);
            this.filterConsoleEntries();
        });

        // Search regex toggle
        $('#consoleSearchRegex, #consoleSearchRegexDock').on('change', () => {
            const checked = $('#consoleSearchRegex').is(':checked') || $('#consoleSearchRegexDock').is(':checked');
            $('#consoleSearchRegex, #consoleSearchRegexDock').prop('checked', checked);
            this.filterConsoleEntries();
        });

        // Clear search
        $('#consoleClearSearch, #consoleClearSearchDock').on('click', () => {
            $('#consoleSearchInput, #consoleSearchInputDock').val('');
            this.filterConsoleEntries();
        });

        // Toggle search visibility
        $('#consoleSearchToggle').on('click', () => {
            $('.console-search-wrapper').first().toggleClass('collapsed');
        });

        $('#consoleSearchToggleDock').on('click', () => {
            $('#consoleDock .console-search-wrapper').toggleClass('collapsed');
        });

        // Dock/undock handlers
        $('#consoleUndockBtn').on('click', () => {
            this.undockConsole();
        });

        $('#consoleRedockBtn, #consoleRedockLargeBtn').on('click', () => {
            this.redockConsole();
        });

        // Scroll handlers for auto-scroll detection
        $('#debugLog').on('scroll', () => {
            this.consoleAutoScroll = isScrolledToBottom($('#debugLog')[0]);
        });

        $('#debugLogDock').on('scroll', () => {
            this.consoleDockAutoScroll = isScrolledToBottom($('#debugLogDock')[0]);
        });
    }

    /**
     * Setup console dock draggable and resizable behavior
     */
    setupConsoleDock() {
        // Initialize draggable with custom drag/stop handlers
        this.initDraggable({
            drag: (event, ui) => {
                const consoleTab = $('.tab-btn[data-tab="console"]');
                const tabOffset = consoleTab.offset();
                const tabWidth = consoleTab.outerWidth();
                const tabHeight = consoleTab.outerHeight();

                const dockOffset = ui.offset;
                const dockWidth = this.$element.outerWidth();
                const dockHeight = 50;

                const nearTab = dockOffset.left < tabOffset.left + tabWidth + 100 &&
                               dockOffset.left + dockWidth > tabOffset.left - 100 &&
                               dockOffset.top < tabOffset.top + tabHeight + 100 &&
                               dockOffset.top + dockHeight > tabOffset.top - 100;

                if (nearTab) {
                    consoleTab.addClass('pulsate-dock-target');
                } else {
                    consoleTab.removeClass('pulsate-dock-target');
                }
            },
            stop: (event, ui) => {
                $('.tab-btn[data-tab="console"]').removeClass('pulsate-dock-target');
                this.savePosition(ui.position);
            }
        });

        // Initialize resizable
        this.initResizable();
    }

    /**
     * Initialize the console
     */
    initialize() {
        this.setupEventHandlers();
        this.setupConsoleDock();

        // Expose log function globally for other components
        window.log = (message, type) => this.log(message, type);
    }
}