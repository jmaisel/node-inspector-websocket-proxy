import { escapeHtml, formatTimestamp } from '../core/ViewUtils.js';

/**
 * Default template for ConsoleView
 * Generates console with search, log entries, and optional dockable floating panel
 *
 * @param {Object} data - Template data
 * @param {string} data.mode - 'tabbed' or 'floating'
 * @param {boolean} data.searchExpanded - Whether search is expanded
 * @param {Array} data.logEntries - Array of log entries: { timestamp, message, type }
 * @param {boolean} data.showRedockPlaceholder - Whether to show redock placeholder in tab
 * @param {Object} config - View configuration
 * @param {string} instanceId - Unique instance ID
 * @returns {string} HTML string
 */
export function consoleTemplate(data, config, instanceId) {
    const {
        mode = 'tabbed',
        searchExpanded = false,
        logEntries = [],
        showRedockPlaceholder = false
    } = data;

    const searchClass = searchExpanded ? '' : ' collapsed';

    // Generate log entry HTML
    const logHtml = logEntries.length > 0
        ? logEntries.map(entry => {
            const type = entry.type || 'info';
            const timestamp = entry.timestamp || formatTimestamp();
            return `<div class="log-entry ${type}">[${timestamp}] ${escapeHtml(entry.message)}</div>`;
        }).join('\n                    ')
        : '<div class="empty-state">No console output</div>';

    // Tabbed mode template
    if (mode === 'tabbed') {
        const placeholderDisplay = showRedockPlaceholder ? '' : ' style="display: none;"';

        return `
            <div class="console-tab-container" id="${instanceId}">
                <div class="console-redock-placeholder"${placeholderDisplay}>
                    <button class="console-redock-large-btn" id="${instanceId}-redock-large-btn" title="Re-dock console to this tab">
                        <span class="redock-icon">⇲</span>
                        <span class="redock-label">Re-dock Console</span>
                    </button>
                </div>
                <div class="console-container">
                    <div class="console-search-wrapper${searchClass}" id="${instanceId}-search-wrapper">
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
                    <div id="${instanceId}-log-content" class="console-content">
                        ${logHtml}
                    </div>
                </div>
            </div>
        `.trim();
    }

    // Floating mode template
    return `
        <div class="console-dock docked" id="${instanceId}">
            <div class="console-dock-header" id="${instanceId}-dock-grip">
                <span class="console-dock-title">📜 Console</span>
                <div class="console-dock-controls">
                    <button class="console-dock-btn" id="${instanceId}-redock-btn" title="Re-dock to tab panel">⇲</button>
                </div>
            </div>
            <div class="console-search-wrapper${searchClass}" id="${instanceId}-search-wrapper-dock">
                <button class="console-search-toggle" id="${instanceId}-search-toggle-dock" title="Toggle search">🔍</button>
                <div class="console-search">
                    <input type="text" id="${instanceId}-search-input-dock" class="search-input" placeholder="Search console...">
                    <label class="search-option">
                        <input type="checkbox" id="${instanceId}-search-regex-dock"> Regex
                    </label>
                    <button id="${instanceId}-clear-search-dock" class="search-clear-btn" title="Clear search">✕</button>
                </div>
            </div>
            <div id="${instanceId}-log-content-dock" class="console-dock-content">
                ${logHtml}
            </div>
        </div>
    `.trim();
}
