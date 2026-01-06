import { escapeHtml } from '../core/ViewUtils.js';

/**
 * Template for BreakpointListView
 */
export function breakpointListTemplate(data, config, instanceId) {
    const { breakpoints = [] } = data;

    const breakpointsHtml = breakpoints.length > 0
        ? breakpoints.map(bp => `
            <div class="breakpoint-item${bp.enabled ? ' enabled' : ' disabled'}" data-breakpoint-id="${bp.id}">
                <input type="checkbox" class="bp-toggle" data-breakpoint-id="${bp.id}" ${bp.enabled ? 'checked' : ''}>
                <div class="bp-info">
                    <div class="bp-location">${escapeHtml(bp.fileName)}:${bp.lineNumber}</div>
                </div>
                <button class="bp-remove-btn" data-breakpoint-id="${bp.id}" title="Remove breakpoint">✕</button>
            </div>
        `.trim()).join('\n                ')
        : '<div class="empty-state">No breakpoints set</div>';

    return `
        <div id="${instanceId}" class="breakpoint-container">
            <div id="${instanceId}-list" class="breakpoint-list">
                ${breakpointsHtml}
            </div>
            <div class="add-breakpoint-form">
                <input type="text" class="add-bp-input" id="${instanceId}-url-input" placeholder="File URL or path">
                <input type="number" class="add-bp-input" id="${instanceId}-line-input" placeholder="Line #" min="1">
                <button class="add-bp-btn" id="${instanceId}-add-btn">Add</button>
            </div>
        </div>
    `.trim();
}
