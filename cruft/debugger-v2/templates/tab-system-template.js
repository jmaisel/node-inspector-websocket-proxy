import { escapeHtml } from '../core/ViewUtils.js';

/**
 * Default template for TabSystemView
 * Generates tab navigation and content panes
 *
 * @param {Object} data - Template data
 * @param {string} data.activeTab - Currently active tab ID
 * @param {Array} data.tabs - Array of tab definitions: { id, label, visible }
 * @param {Object} config - View configuration
 * @param {string} instanceId - Unique instance ID
 * @returns {string} HTML string
 */
export function tabSystemTemplate(data, config, instanceId) {
    const { activeTab = 'console', tabs = [] } = data;

    // Default tabs if none provided
    const defaultTabs = [
        { id: 'console', label: 'Console', visible: true },
        { id: 'callstack', label: 'Call Stack', visible: true },
        { id: 'files', label: 'Files', visible: true },
        { id: 'breakpoints', label: 'Breakpoints', visible: true },
        { id: 'watches', label: 'Watches', visible: true },
        { id: 'scope', label: 'Scope', visible: true }
    ];

    const tabList = tabs.length > 0 ? tabs : defaultTabs;

    // Generate tab buttons
    const tabButtons = tabList
        .filter(tab => tab.visible !== false)
        .map(tab => {
            const isActive = tab.id === activeTab;
            const activeClass = isActive ? ' active' : '';
            return `
                <button class="tab-btn${activeClass}"
                        id="${instanceId}-tab-${tab.id}"
                        data-tab="${tab.id}">
                    ${escapeHtml(tab.label)}
                </button>
            `.trim();
        })
        .join('\n                ');

    // Generate tab panes
    const tabPanes = tabList
        .map(tab => {
            const isActive = tab.id === activeTab;
            const activeClass = isActive ? ' active' : '';
            return `
                <div class="tab-pane${activeClass}"
                     id="${instanceId}-pane-${tab.id}">
                </div>
            `.trim();
        })
        .join('\n                ');

    return `
        <div class="tab-system" id="${instanceId}">
            <div class="tab-nav" id="${instanceId}-nav">
                ${tabButtons}
            </div>
            <div class="tab-content" id="${instanceId}-content">
                ${tabPanes}
            </div>
        </div>
    `.trim();
}
