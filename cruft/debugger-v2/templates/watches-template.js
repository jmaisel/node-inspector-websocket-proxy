import { escapeHtml } from '../core/ViewUtils.js';

/**
 * Template for WatchesView
 */
export function watchesTemplate(data, config, instanceId) {
    const { watches = [] } = data;

    const watchesHtml = watches.length > 0
        ? watches.map(watch => `
            <div class="watch-item" data-watch-id="${watch.id}">
                <div class="variable-name">${escapeHtml(watch.expression)}</div>
                <div class="variable-value">${escapeHtml(watch.value || 'undefined')}</div>
                <button class="watch-remove-btn" data-watch-id="${watch.id}" title="Remove watch">✕</button>
            </div>
        `.trim()).join('\n                ')
        : '<div class="empty-state">No watches added</div>';

    return `
        <div id="${instanceId}" class="watches-container">
            <div id="${instanceId}-list" class="watches-list">
                ${watchesHtml}
            </div>
            <div class="add-watch-form">
                <input type="text" class="add-watch-input" id="${instanceId}-expression-input" placeholder="Expression to watch">
                <button class="add-watch-btn" id="${instanceId}-add-btn">Add</button>
            </div>
        </div>
    `.trim();
}
