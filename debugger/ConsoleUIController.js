/**
 * ConsoleUIController - Manages console output, search, and docking behavior
 */
class ConsoleUIController extends BaseUIController {
    constructor() {
        super();
        this.consoleAutoScroll = true;
        this.consoleDockAutoScroll = true;
        this.$dock = null;
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
     * Undock console to a floating window
     */
    undockConsole() {
        // Keep console tab visible, but show redock placeholder in tab content
        $('.console-container').addClass('undocked-mode');
        $('#tab-console').addClass('show-redock-placeholder');

        // Remove docked class, add floating class
        this.$dock.removeClass('docked').addClass('floating');

        // Restore saved position or center it
        const savedPos = localStorage.getItem('console-dock-pos');
        if (savedPos) {
            const pos = JSON.parse(savedPos);
            this.$dock.css({ top: pos.top, left: pos.left, bottom: 'auto', right: 'auto' });
        } else {
            // Center the console panel
            const left = ($(window).width() - 600) / 2;
            const top = ($(window).height() - 300) / 2;
            this.$dock.css({ top: top, left: left, bottom: 'auto', right: 'auto' });
        }

        // Show the dock first
        this.$dock.show();

        // Enable draggable and resizable for floating mode
        this.$dock.draggable('enable');
        this.$dock.resizable('enable');
        this.$dock.resizable('option', 'handles', 'n, e, s, w, ne, nw, se, sw');
        this.$dock.resizable('option', 'maxHeight', 800);

        // Add hover effect on console tab when console is undocked
        $('.tab-btn[data-tab="console"]').on('mouseenter.consoledock', () => {
            $(this).addClass('pulsate-dock-target');
        }).on('mouseleave.consoledock', () => {
            // Only remove if not currently dragging
            if (!this.$dock.hasClass('ui-draggable-dragging')) {
                $(this).removeClass('pulsate-dock-target');
            }
        });
    }

    /**
     * Redock console to the tab panel
     */
    redockConsole() {
        // Remove undocked mode from console tab
        $('.console-container').removeClass('undocked-mode');
        $('#tab-console').removeClass('show-redock-placeholder');

        // Remove hover listeners
        $('.tab-btn[data-tab="console"]').off('.consoledock');
        $('.tab-btn[data-tab="console"]').removeClass('pulsate-dock-target');

        // Disable draggable
        this.$dock.draggable('disable');

        // Configure resizable for docked mode (only top handle)
        this.$dock.resizable('option', 'handles', 'n');
        this.$dock.resizable('option', 'maxHeight', 600);

        // Remove floating class, add docked class
        this.$dock.removeClass('floating').addClass('docked');

        // Reset to bottom docked position
        this.$dock.css({ top: 'auto', left: 0, right: 0, bottom: 0 });

        // Hide floating window
        this.$dock.hide();

        // Force scroll to bottom after tab is displayed if auto-scroll is enabled
        setTimeout(() => {
            const debugLogEl = $('#debugLog')[0];
            if (this.consoleAutoScroll && debugLogEl) {
                debugLogEl.scrollTop = debugLogEl.scrollHeight;
            }
        }, 50);
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
        this.$dock = $('#consoleDock');

        this.$dock.draggable({
            handle: '#consoleDockGrip',
            containment: 'window',
            disabled: true,
            drag: (event, ui) => {
                const consoleTab = $('.tab-btn[data-tab="console"]');
                const tabOffset = consoleTab.offset();
                const tabWidth = consoleTab.outerWidth();
                const tabHeight = consoleTab.outerHeight();

                const dockOffset = ui.offset;
                const dockWidth = this.$dock.outerWidth();
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

                localStorage.setItem('console-dock-pos', JSON.stringify({
                    top: ui.position.top,
                    left: ui.position.left
                }));
            }
        });

        this.$dock.resizable({
            handles: 'n, e, s, w, ne, nw, se, sw',
            minHeight: 100,
            minWidth: 300,
            maxHeight: 600
        });
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