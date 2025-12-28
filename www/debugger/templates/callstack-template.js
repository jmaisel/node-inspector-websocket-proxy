/**
 * Default template for Call Stack component
 *
 * @param {Object} data - Template data
 * @param {string} data.emptyMessage - Empty state message (default: 'Pause execution to see call stack')
 * @param {string} instanceId - Unique instance identifier for DOM elements
 * @returns {string} HTML string for the call stack tab pane
 */
export function callStackTemplate(data = {}, instanceId = 'callstack') {
    const {
        emptyMessage = 'Pause execution to see call stack'
    } = data;

    return `
        <div class="tab-pane" id="${instanceId}-tab-pane">
            <div id="${instanceId}">
                <div class="empty-state">${emptyMessage}</div>
            </div>
        </div>
    `;
}

/**
 * Template for a single call stack frame
 *
 * @param {Object} frameData - Frame data
 * @param {number} frameData.index - Frame index
 * @param {string} frameData.functionName - Function name
 * @param {string} frameData.displayPath - Display path for the file
 * @param {string} frameData.url - Full URL of the file
 * @param {number|string} frameData.line - Line number
 * @param {number|string} frameData.col - Column number
 * @param {Object|null} frameData.sourceInfo - Source code info (optional)
 * @param {number} frameData.sourceInfo.lineNumber - Source line number
 * @param {string} frameData.sourceInfo.highlighted - Highlighted source code
 * @returns {string} HTML string for a single call stack frame
 */
export function callStackFrameTemplate(frameData) {
    const {
        index,
        functionName,
        displayPath,
        url,
        line,
        col,
        sourceInfo = null
    } = frameData;

    const selectedClass = index === 0 ? 'selected' : '';

    let html = `
        <div class="list-item ${selectedClass}" onclick="selectCallFrame(${index})">
            <div class="item-content">
                <div class="function-name">${functionName}</div>
                <div class="function-location" title="${url}">${displayPath}:${line}:${col}</div>
    `;

    // For the active frame (index 0), show source code preview if available
    if (sourceInfo) {
        html += `
                <div class="frame-code-preview">
                    <span class="code-line-number">${sourceInfo.lineNumber}</span>
                    <code class="code-line">${sourceInfo.highlighted}</code>
                </div>
        `;
    }

    html += `
            </div>
        </div>
    `;

    return html;
}

/**
 * Template for scope type header
 *
 * @param {string} scopeType - The scope type (e.g., 'local', 'closure', 'global')
 * @returns {string} HTML string for scope type header
 */
export function scopeTypeHeaderTemplate(scopeType) {
    return `<div style="margin-top: 8px; color: var(--text-secondary); font-weight: 600; font-size: var(--font-xs);">${scopeType.toUpperCase()}</div>`;
}

/**
 * Template for a single scope variable
 *
 * @param {Object} variableData - Variable data
 * @param {string} variableData.name - Variable name
 * @param {*} variableData.value - Variable value
 * @returns {string} HTML string for a single variable
 */
export function scopeVariableTemplate(variableData) {
    const { name, value } = variableData;

    return `
        <div class="variable-item">
            <span class="variable-name">${name}:</span>
            <span class="variable-value">${value}</span>
        </div>
    `;
}