/**
 * ConsoleUIModel - Manages console message storage and filtering
 * Implements a circular buffer to prevent memory issues
 */
class ConsoleUIModel {
    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
        this.messages = [];
        this.nextId = 1;
        this.logger = new Logger('ConsoleUIModel');
    }

    /**
     * Add a message to the console
     * @param {string} level - DEBUG, INFO, WARN, ERROR, EVENT
     * @param {string} source - debugger, application
     * @param {string} type - Specific type (console.log, error, event name)
     * @param {string} message - Formatted message text
     * @param {Object} data - Raw data for inspection
     */
    addMessage(level, source, type, message, data = null) {
        const msg = {
            id: this.nextId++,
            timestamp: new Date(),
            level: level,
            source: source,
            type: type,
            message: message,
            data: data
        };

        this.messages.push(msg);

        // Implement circular buffer - remove oldest when exceeding max
        if (this.messages.length > this.maxSize) {
            this.messages.shift();
        }

        this.logger.debug('Message added', msg);
        return msg;
    }

    /**
     * Get messages with optional filtering
     * @param {Object} filterOptions - {levels: [], searchText: ''}
     * @returns {Array} Filtered messages
     */
    getMessages(filterOptions = {}) {
        let filtered = this.messages;

        // Filter by log levels
        if (filterOptions.levels && filterOptions.levels.length > 0) {
            filtered = filtered.filter(msg => filterOptions.levels.includes(msg.level));
        }

        // Filter by search text
        if (filterOptions.searchText && filterOptions.searchText.trim() !== '') {
            const searchLower = filterOptions.searchText.toLowerCase();
            filtered = filtered.filter(msg =>
                msg.message.toLowerCase().includes(searchLower) ||
                msg.type.toLowerCase().includes(searchLower)
            );
        }

        return filtered;
    }

    /**
     * Clear all messages
     */
    clear() {
        this.messages = [];
        this.logger.info('Console cleared');
    }

    /**
     * Get message count statistics
     * @returns {Object} Stats by level and source
     */
    getStats() {
        const stats = {
            total: this.messages.length,
            byLevel: {},
            bySource: {}
        };

        this.messages.forEach(msg => {
            // Count by level
            stats.byLevel[msg.level] = (stats.byLevel[msg.level] || 0) + 1;

            // Count by source
            stats.bySource[msg.source] = (stats.bySource[msg.source] || 0) + 1;
        });

        return stats;
    }

    /**
     * Get the most recent N messages
     * @param {number} count - Number of messages to retrieve
     * @returns {Array} Most recent messages
     */
    getRecentMessages(count) {
        return this.messages.slice(-count);
    }
}