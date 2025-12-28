/**
 * Default template for Tab Navigation component
 *
 * @param {Object} data - Template data
 * @param {Array} data.tabs - Array of tab objects with {name, label, active}
 * @param {string} instanceId - Unique instance identifier for DOM elements
 * @returns {string} HTML string for the tab navigation
 */
export function tabNavigationTemplate(data = {}, instanceId = 'tab-nav') {
    const { tabs = [] } = data;

    const tabButtons = tabs.map(tab => {
        const activeClass = tab.active ? 'active' : '';
        return `<button class="tab-btn ${activeClass}" data-tab="${tab.name}">${tab.label}</button>`;
    }).join('\n            ');

    return `
        <div class="tab-nav" id="${instanceId}">
            ${tabButtons}
        </div>
    `;
}