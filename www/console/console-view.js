/**
 * ConsoleUIView - Handles console UI rendering and interactions
 */
class ConsoleUIView {
    constructor(containerSelector, model) {
        this.container = $(containerSelector);
        this.model = model;
        this.contentDiv = this.container.find('#console-content');
        this.autoScroll = true;
        this.logger = new Logger('ConsoleUIView');

        this.levelColors = {
            'DEBUG': '#999',
            'INFO': '#0099ff',
            'WARN': '#ff9800',
            'ERROR': '#f44336',
            'EVENT': '#4caf50'
        };

        // Track last rendered message ID for incremental updates
        this.lastRenderedId = 0;
        // Track current filter state to detect when we need full re-render
        this.currentFilters = { levels: null, searchText: '' };
    }

    /**
     * Render messages with incremental updates for performance
     * Only re-renders when filters change, otherwise appends new messages
     * @param {Array} messages - Array of message objects to display
     */
    renderMessages(messages) {
        // If there are no messages, just clear and return
        if (messages.length === 0) {
            if (this.contentDiv.children().length > 0) {
                this.contentDiv.empty();
                this.lastRenderedId = 0;
            }
            return;
        }

        // Find only new messages (those with ID > lastRenderedId)
        const newMessages = messages.filter(msg => msg.id > this.lastRenderedId);

        // If we have new messages and no filter changes, just append them
        if (newMessages.length > 0 && newMessages.length < messages.length) {
            // Incremental update - just append new messages
            newMessages.forEach(msg => {
                this.appendMessage(msg);
                this.lastRenderedId = Math.max(this.lastRenderedId, msg.id);
            });
        } else {
            // Full re-render needed (filters changed, or first render, or all messages are new)
            this.contentDiv.empty();
            this.lastRenderedId = 0;

            messages.forEach(msg => {
                this.appendMessage(msg);
                this.lastRenderedId = Math.max(this.lastRenderedId, msg.id);
            });
        }

        if (this.autoScroll) {
            this.scrollToBottom();
        }
    }

    /**
     * Append a single message to the console (DOM creation only, no scrolling)
     * @param {Object} msg - Message object
     */
    appendMessage(msg) {
        const messageDiv = $('<div></div>')
            .addClass('console-message')
            .attr('data-id', msg.id)
            .attr('data-level', msg.level);

        // Timestamp
        const timestamp = $('<span></span>')
            .addClass('console-timestamp')
            .text(this.formatTimestamp(msg.timestamp));

        // Level badge
        const levelBadge = $('<span></span>')
            .addClass('console-level-badge')
            .css('background-color', this.levelColors[msg.level] || '#666')
            .text(msg.level);

        // Source badge
        const sourceBadge = $('<span></span>')
            .addClass('console-source-badge')
            .text(msg.source);

        // Message text
        const messageText = $('<span></span>')
            .addClass('console-message-text')
            .text(msg.message);

        // Assemble message
        messageDiv
            .append(timestamp)
            .append(' ')
            .append(levelBadge)
            .append(' ')
            .append(sourceBadge)
            .append(' ')
            .append(messageText);

        // Click to expand details
        if (msg.data) {
            messageDiv.addClass('has-details');
            messageDiv.on('click', () => {
                this.showMessageDetails(msg);
            });
        }

        this.contentDiv.append(messageDiv);
    }

    /**
     * Show detailed view of a message
     * @param {Object} msg - Message object
     */
    showMessageDetails(msg) {
        // Toggle details view
        const existingDetails = this.contentDiv.find(`[data-parent-id="${msg.id}"]`);

        if (existingDetails.length > 0) {
            existingDetails.remove();
            return;
        }

        const detailsDiv = $('<div></div>')
            .addClass('console-message-details')
            .attr('data-parent-id', msg.id);

        const dataJson = $('<pre></pre>')
            .addClass('console-json')
            .text(JSON.stringify(msg.data, null, 2));

        detailsDiv.append(dataJson);

        // Insert after the message
        this.contentDiv.find(`[data-id="${msg.id}"]`).after(detailsDiv);
    }

    /**
     * Format timestamp for display
     * @param {Date} timestamp
     * @returns {string} Formatted time string
     */
    formatTimestamp(timestamp) {
        const hours = String(timestamp.getHours()).padStart(2, '0');
        const minutes = String(timestamp.getMinutes()).padStart(2, '0');
        const seconds = String(timestamp.getSeconds()).padStart(2, '0');
        const ms = String(timestamp.getMilliseconds()).padStart(3, '0');

        return `${hours}:${minutes}:${seconds}.${ms}`;
    }

    /**
     * Scroll console content to bottom
     */
    scrollToBottom() {
        const content = this.contentDiv[0];
        if (content) {
            content.scrollTop = content.scrollHeight;
        }
    }

    /**
     * Clear console display
     */
    clear() {
        this.contentDiv.empty();
        this.lastRenderedId = 0;
        this.logger.info('Console view cleared');
    }

    /**
     * Set auto-scroll behavior
     * @param {boolean} enabled
     */
    setAutoScroll(enabled) {
        this.autoScroll = enabled;
    }

    /**
     * Check if user has scrolled away from bottom
     * @returns {boolean}
     */
    isScrolledToBottom() {
        const content = this.contentDiv[0];
        if (!content) return true;

        const threshold = 50; // pixels from bottom
        return content.scrollHeight - content.scrollTop - content.clientHeight < threshold;
    }

    /**
     * Initialize event handlers for toolbar buttons
     * @param {Object} handlers - Object with handler functions
     */
    bindToolbarHandlers(handlers) {
        // Level filter buttons
        this.container.find('.console-level-btn').on('click', (e) => {
            const btn = $(e.currentTarget);
            btn.toggleClass('active');
            if (handlers.onFilterChange) {
                handlers.onFilterChange();
            }
        });

        // Search input
        this.container.find('#console-search').on('input', (e) => {
            if (handlers.onSearchChange) {
                handlers.onSearchChange($(e.target).val());
            }
        });

        // Clear button
        this.container.find('#console-clear-btn').on('click', () => {
            if (handlers.onClear) {
                handlers.onClear();
            }
        });

        // Collapse button
        this.container.find('#console-collapse-btn').on('click', () => {
            if (handlers.onToggleCollapse) {
                handlers.onToggleCollapse();
            }
        });

        // Detach button - use direct selector since ID is unique
        $('#console-detach-btn').on('click', () => {
            this.logger.info('Detach button clicked');
            if (handlers.onDetach) {
                handlers.onDetach();
            }
        });

        // Auto-scroll detection
        this.contentDiv.on('scroll', () => {
            this.autoScroll = this.isScrolledToBottom();
        });

        this.logger.info('Toolbar handlers bound');
    }

    /**
     * Get currently active log levels from filter buttons
     * @returns {Array} Array of active level names
     */
    getActiveLevels() {
        return this.container.find('.console-level-btn.active')
            .map(function() { return $(this).data('level'); })
            .get();
    }

    /**
     * Get current search text
     * @returns {string}
     */
    getSearchText() {
        return this.container.find('#console-search').val() || '';
    }
}