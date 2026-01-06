import { DockableView } from '../core/DockableView.js';
import { consoleTemplate } from '../templates/console-template.js';
import { formatTimestamp, isScrolledToBottom, scrollToBottom } from '../core/ViewUtils.js';

/**
 * ConsoleView - Dockable console with search and log management
 *
 * Features:
 * - Dual-mode rendering (tabbed or floating)
 * - Log entry management with types (info, error, event)
 * - Search with regex support and highlighting
 * - Auto-scroll detection
 * - Dock/undock capability
 */
export class ConsoleView extends DockableView {
    constructor(config = {}) {
        super({
            ...config,
            storagePrefix: config.storagePrefix || 'console',
            draggableConfig: {
                handle: `#${config.instanceId || 'console'}-dock-grip`,
                containment: 'window',
                disabled: true,
                ...(config.draggableConfig || {})
            },
            resizableConfig: {
                handles: 'n, e, s, w, ne, nw, se, sw',
                minHeight: 100,
                minWidth: 300,
                maxHeight: 600,
                ...(config.resizableConfig || {})
            }
        });

        // Default state
        if (!this.state.mode) {
            this.state.mode = 'tabbed';
        }
        if (!this.state.logEntries) {
            this.state.logEntries = [];
        }
        if (this.state.searchExpanded === undefined) {
            this.state.searchExpanded = false;
        }
        if (this.state.showRedockPlaceholder === undefined) {
            this.state.showRedockPlaceholder = false;
        }

        this.autoScroll = true;
        this.searchText = '';
        this.useRegex = false;
    }

    /**
     * Define element map (varies by mode)
     */
    defineElementMap() {
        if (this.state.mode === 'tabbed') {
            return {
                container: '',
                searchWrapper: '-search-wrapper',
                searchToggle: '-search-toggle',
                searchInput: '-search-input',
                searchRegex: '-search-regex',
                clearSearch: '-clear-search',
                undockBtn: '-undock-btn',
                redockLargeBtn: '-redock-large-btn',
                logContent: '-log-content'
            };
        } else {
            return {
                container: '',
                dockGrip: '-dock-grip',
                searchWrapperDock: '-search-wrapper-dock',
                searchToggleDock: '-search-toggle-dock',
                searchInputDock: '-search-input-dock',
                searchRegexDock: '-search-regex-dock',
                clearSearchDock: '-clear-search-dock',
                redockBtn: '-redock-btn',
                logContentDock: '-log-content-dock'
            };
        }
    }

    /**
     * Get default template
     */
    getDefaultTemplate() {
        return consoleTemplate;
    }

    /**
     * Attach event handlers
     */
    async attachEvents() {
        const elements = this.getElementMap();

        if (this.state.mode === 'tabbed') {
            // Search toggle
            this.registerEventHandler(elements.searchToggle, 'click', () => this.toggleSearch());

            // Search input
            this.registerEventHandler(elements.searchInput, 'input', (e) => {
                this.searchText = $(e.target).val();
                this.filterLogEntries();
            });

            // Search regex toggle
            this.registerEventHandler(elements.searchRegex, 'change', (e) => {
                this.useRegex = $(e.target).is(':checked');
                this.filterLogEntries();
            });

            // Clear search
            this.registerEventHandler(elements.clearSearch, 'click', () => this.clearSearch());

            // Undock button
            this.registerEventHandler(elements.undockBtn, 'click', () => this.undock());

            // Redock large button
            this.registerEventHandler(elements.redockLargeBtn, 'click', () => this.dock());

            // Auto-scroll detection
            $(elements.logContent).on('scroll', () => {
                this.autoScroll = isScrolledToBottom($(elements.logContent)[0]);
            });
        } else {
            // Floating mode handlers
            this.registerEventHandler(elements.searchToggleDock, 'click', () => this.toggleSearch());

            this.registerEventHandler(elements.searchInputDock, 'input', (e) => {
                this.searchText = $(e.target).val();
                this.filterLogEntries();
            });

            this.registerEventHandler(elements.searchRegexDock, 'change', (e) => {
                this.useRegex = $(e.target).is(':checked');
                this.filterLogEntries();
            });

            this.registerEventHandler(elements.clearSearchDock, 'click', () => this.clearSearch());

            this.registerEventHandler(elements.redockBtn, 'click', () => this.dock());

            // Auto-scroll detection
            $(elements.logContentDock).on('scroll', () => {
                this.autoScroll = isScrolledToBottom($(elements.logContentDock)[0]);
            });
        }
    }

    /**
     * Add a log entry
     * @param {Object} entry - Log entry { message, type, timestamp }
     */
    addLogEntry(entry) {
        const logEntry = {
            message: entry.message || '',
            type: entry.type || 'info',
            timestamp: entry.timestamp || formatTimestamp()
        };

        this.state.logEntries.push(logEntry);

        // Add to DOM directly for performance
        const elements = this.getElementMap();
        const logHtml = `<div class="log-entry ${logEntry.type}">[${logEntry.timestamp}] ${this.escapeHtml(logEntry.message)}</div>`;

        if (this.state.mode === 'tabbed') {
            const $logContent = $(elements.logContent);
            // Remove empty state if exists
            $logContent.find('.empty-state').remove();
            $logContent.append(logHtml);

            // Auto-scroll
            if (this.autoScroll) {
                scrollToBottom($logContent[0]);
            }
        } else {
            const $logContentDock = $(elements.logContentDock);
            $logContentDock.find('.empty-state').remove();
            $logContentDock.append(logHtml);

            if (this.autoScroll) {
                scrollToBottom($logContentDock[0]);
            }
        }

        // Apply search filter
        this.filterLogEntries();
    }

    /**
     * Clear all log entries
     */
    clearLog() {
        this.state.logEntries = [];

        const elements = this.getElementMap();
        const emptyState = '<div class="empty-state">No console output</div>';

        if (this.state.mode === 'tabbed') {
            $(elements.logContent).html(emptyState);
        } else {
            $(elements.logContentDock).html(emptyState);
        }
    }

    /**
     * Toggle search visibility
     */
    toggleSearch() {
        this.setState({ searchExpanded: !this.state.searchExpanded });

        const elements = this.getElementMap();
        const wrapper = this.state.mode === 'tabbed' ? elements.searchWrapper : elements.searchWrapperDock;

        $(wrapper).toggleClass('collapsed');
    }

    /**
     * Clear search
     */
    clearSearch() {
        this.searchText = '';
        this.useRegex = false;

        const elements = this.getElementMap();

        if (this.state.mode === 'tabbed') {
            $(elements.searchInput).val('');
            $(elements.searchRegex).prop('checked', false);
        } else {
            $(elements.searchInputDock).val('');
            $(elements.searchRegexDock).prop('checked', false);
        }

        this.filterLogEntries();
    }

    /**
     * Filter log entries based on search
     */
    filterLogEntries() {
        const elements = this.getElementMap();
        const $logEntries = this.$element.find('.log-entry');

        if (!this.searchText) {
            // Show all entries, remove highlights
            $logEntries.removeClass('hidden').each(function() {
                const text = $(this).text();
                $(this).text(text);
            });
            return;
        }

        let pattern = null;
        if (this.useRegex) {
            try {
                pattern = new RegExp(this.searchText, 'gi');
            } catch (e) {
                // Invalid regex, fall back to plain text
                pattern = null;
            }
        }

        $logEntries.each((index, entry) => {
            const $entry = $(entry);
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
                const originalText = text;
                let highlightedHtml;

                if (pattern) {
                    highlightedHtml = originalText.replace(pattern, match => `<mark>${match}</mark>`);
                } else {
                    const escapedSearch = this.searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const searchRegex = new RegExp(escapedSearch, 'gi');
                    highlightedHtml = originalText.replace(searchRegex, match => `<mark>${match}</mark>`);
                }

                $entry.html(highlightedHtml);
            } else {
                $entry.addClass('hidden');
            }
        });
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Undock console to floating panel
     */
    undock() {
        // Switch to floating mode
        this.state.mode = 'floating';
        this.state.showRedockPlaceholder = true;

        // Unmount and remount in floating mode
        const container = this.$container;
        const containerSelector = this.config.container;

        this.unmount();

        // Mount as floating panel
        this.config.container = 'body';
        this.mount().then(() => {
            // Position and configure floating panel
            const $element = this.$element;

            $element.removeClass('docked').addClass('floating');
            $element.show();

            // Restore or center position
            const savedPos = this.restorePosition();
            if (savedPos) {
                this.applyPosition({
                    top: savedPos.top,
                    left: savedPos.left,
                    bottom: 'auto',
                    right: 'auto'
                });
            } else {
                const pos = this.centerInWindow(600, 300);
                this.applyPosition({
                    top: pos.top,
                    left: pos.left,
                    bottom: 'auto',
                    right: 'auto'
                });
            }

            // Enable draggable and resizable
            this.initDraggable({
                stop: (event, ui) => {
                    this.savePosition(ui.position);
                }
            });
            this.initResizable();

            // Save state
            this.saveDockState(false);

            // Restore container for future docking
            this.config.container = containerSelector;
        });
    }

    /**
     * Dock console back to tab panel
     */
    dock() {
        // Switch to tabbed mode
        this.state.mode = 'tabbed';
        this.state.showRedockPlaceholder = false;

        // Unmount floating panel
        this.unmount();

        // Mount in tab panel
        this.mount().then(() => {
            // Save state
            this.saveDockState(true);

            // Scroll to bottom if auto-scroll enabled
            if (this.autoScroll) {
                const elements = this.getElementMap();
                scrollToBottom($(elements.logContent)[0]);
            }
        });
    }

    /**
     * Initialize after mount
     */
    async onMounted() {
        // Check if should be docked
        const isDocked = this.restoreDockState(true);

        if (!isDocked && this.state.mode === 'tabbed') {
            // Should be floating but currently in tabbed mode
            this.undock();
        }
    }
}
