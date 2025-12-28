import { escapeHtml } from '../TemplateRegistry.js';

/**
 * Default template for Console component
 *
 * Generates two views:
 * 1. In-tab console (embedded in tab panel)
 * 2. Dockable console (floating panel)
 *
 * @param {Object} data - Template data
 * @param {boolean} data.showRedockPlaceholder - Whether to show redock placeholder
 * @param {Array} data.logEntries - Array of log entries (optional, for initial state)
 * @param {string} instanceId - Unique instance identifier for DOM elements
 * @returns {string} HTML string
 */
export function consoleTemplate(data = {}, instanceId = 'console') {
    const {
        showRedockPlaceholder = false,
        logEntries = []
    } = data;

    const logHtml = logEntries.length > 0
        ? logEntries.map(entry =>
            `<div class="log-entry ${entry.type}">[${entry.timestamp}] ${escapeHtml(entry.message)}</div>`
          ).join('')
        : '<div class="empty-state">No console output</div>';

    return {
        // In-tab console HTML
        tabPane: `
            <div class="tab-pane active" id="${instanceId}-tab-pane">
                <div class="console-redock-placeholder" style="display: ${showRedockPlaceholder ? 'flex' : 'none'}">
                    <button class="console-redock-large-btn" id="${instanceId}-redock-large-btn" title="Re-dock console to this tab">
                        <span class="redock-icon">⇲</span>
                        <span class="redock-label">Re-dock Console</span>
                    </button>
                </div>
                <div class="console-container" style="display: ${showRedockPlaceholder ? 'none' : 'flex'}">
                    <div class="console-search-wrapper collapsed">
                        <button class="console-search-toggle" id="${instanceId}-search-toggle" title="Toggle search">🔍</button>
                        <div class="console-search">
                            <input type="text" id="${instanceId}-search-input" class="search-input" placeholder="Search console...">
                            <label class="search-option">
                                <input type="checkbox" id="${instanceId}-search-regex"> Regex
                            </label>
                            <button id="${instanceId}-clear-search" class="search-clear-btn" title="Clear search">✕</button>
                        </div>
                    </div>
                    <div class="console-controls">
                        <button class="console-control-btn" id="${instanceId}-undock-btn" title="Undock console">⇱</button>
                    </div>
                    <div id="${instanceId}-log" class="console-content">
                        ${logHtml}
                    </div>
                </div>
            </div>
        `,

        // Dockable console panel HTML
        dockPanel: `
            <div class="console-dock docked" id="${instanceId}-dock" style="display: none;">
                <div class="console-dock-header" id="${instanceId}-dock-grip">
                    <span class="console-dock-title">📜 Console</span>
                    <div class="console-dock-controls">
                        <button class="console-dock-btn" id="${instanceId}-redock-btn" title="Re-dock to tab panel">⇲</button>
                    </div>
                </div>
                <div class="console-search-wrapper collapsed">
                    <button class="console-search-toggle" id="${instanceId}-search-toggle-dock" title="Toggle search">🔍</button>
                    <div class="console-search">
                        <input type="text" id="${instanceId}-search-input-dock" class="search-input" placeholder="Search console...">
                        <label class="search-option">
                            <input type="checkbox" id="${instanceId}-search-regex-dock"> Regex
                        </label>
                        <button id="${instanceId}-clear-search-dock" class="search-clear-btn" title="Clear search">✕</button>
                    </div>
                </div>
                <div id="${instanceId}-log-dock" class="console-dock-content">
                    ${logHtml}
                </div>
            </div>
        `
    };
}

/**
 * Template for a single log entry
 *
 * @param {Object} logData - Log entry data
 * @param {string} logData.timestamp - Timestamp of the log entry
 * @param {string} logData.message - Log message
 * @param {string} logData.type - Log type ('info', 'error', 'event', etc.)
 * @returns {string} HTML string for a single log entry
 */
export function logEntryTemplate(logData) {
    const { timestamp, message, type } = logData;
    return `<div class="log-entry ${type}">[${timestamp}] ${message}</div>`;
}