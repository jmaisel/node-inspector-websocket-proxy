/**
 * Default template for Breakpoints component
 *
 * @param {Object} data - Template data
 * @param {string} data.emptyMessage - Empty state message (default: 'No breakpoints set')
 * @param {string} data.urlPlaceholder - URL input placeholder (default: 'File URL or path')
 * @param {string} data.linePlaceholder - Line input placeholder (default: 'Line #')
 * @param {string} instanceId - Unique instance identifier for DOM elements
 * @returns {string} HTML string for the breakpoints tab pane
 */
export function breakpointsTemplate(data = {}, instanceId = 'breakpoints') {
    const {
        emptyMessage = 'No breakpoints set',
        urlPlaceholder = 'File URL or path',
        linePlaceholder = 'Line #'
    } = data;

    return `
        <div class="tab-pane" id="${instanceId}-tab-pane">
            <div id="${instanceId}-list">
                <div class="empty-state">${emptyMessage}</div>
            </div>
            <div class="add-breakpoint-form">
                <input type="text" class="add-bp-input" id="${instanceId}-url" placeholder="${urlPlaceholder}">
                <input type="number" class="add-bp-input" id="${instanceId}-line" placeholder="${linePlaceholder}" min="1">
                <button class="add-bp-btn" id="${instanceId}-add-btn">Add</button>
            </div>
        </div>
    `;
}

/**
 * Template for a single breakpoint item
 *
 * @param {Object} breakpointData - Breakpoint data
 * @param {string} breakpointData.breakpointId - Breakpoint ID
 * @param {string} breakpointData.fileName - File name
 * @param {string} breakpointData.url - Full URL
 * @param {number} breakpointData.lineNumber - Line number
 * @param {boolean} breakpointData.enabled - Whether breakpoint is enabled
 * @returns {string} HTML string for a single breakpoint item
 */
export function breakpointItemTemplate(breakpointData) {
    const {
        breakpointId,
        fileName,
        url,
        lineNumber,
        enabled
    } = breakpointData;

    const enabledClass = enabled ? 'enabled' : 'disabled';
    const checkboxChecked = enabled ? 'checked' : '';

    return `
        <div class="breakpoint-item ${enabledClass}" data-breakpoint-id="${breakpointId}">
            <input type="checkbox"
                   class="bp-toggle"
                   ${checkboxChecked}
                   data-breakpoint-id="${breakpointId}">
            <div class="bp-info">
                <div class="bp-location" title="${url}">
                    ${fileName}:${lineNumber}
                </div>
            </div>
            <button class="bp-remove-btn"
                    data-breakpoint-id="${breakpointId}"
                    title="Remove breakpoint">×</button>
        </div>
    `;
}