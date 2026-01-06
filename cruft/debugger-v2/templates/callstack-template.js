import { escapeHtml } from '../core/ViewUtils.js';

/**
 * Template for CallStackView
 */
export function callstackTemplate(data, config, instanceId) {
    const { callFrames = [] } = data;

    if (callFrames.length === 0) {
        return `
            <div id="${instanceId}" class="callstack-container">
                <div class="empty-state">Pause execution to see call stack</div>
            </div>
        `.trim();
    }

    const framesHtml = callFrames.map((frame, index) => `
        <div class="list-item${frame.selected ? ' selected' : ''}" data-frame-index="${index}">
            <div class="item-content">
                <div class="function-name">${escapeHtml(frame.functionName || '(anonymous)')}</div>
                <div class="function-location">${escapeHtml(frame.url)}:${frame.line}:${frame.col}</div>
            </div>
        </div>
    `.trim()).join('\n            ');

    return `
        <div id="${instanceId}" class="callstack-container">
            <div id="${instanceId}-frame-list" class="callstack-list">
                ${framesHtml}
            </div>
        </div>
    `.trim();
}
