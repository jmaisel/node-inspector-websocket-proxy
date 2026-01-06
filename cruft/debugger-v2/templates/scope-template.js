import { escapeHtml } from '../core/ViewUtils.js';

/**
 * Template for ScopeView
 */
export function scopeTemplate(data, config, instanceId) {
    const { scopes = [] } = data;

    if (scopes.length === 0) {
        return `
            <div id="${instanceId}" class="scope-container">
                <div class="empty-state">No scope information available</div>
            </div>
        `.trim();
    }

    const scopesHtml = scopes.map(scope => {
        const varsHtml = scope.variables.map(v => `
            <div class="variable-item">
                <span class="variable-name">${escapeHtml(v.name)}</span>:
                <span class="variable-value">${escapeHtml(v.value)}</span>
            </div>
        `.trim()).join('\n                    ');

        return `
            <div class="scope-section">
                <div class="scope-header">${escapeHtml(scope.type)}</div>
                <div class="scope-variables">
                    ${varsHtml}
                </div>
            </div>
        `.trim();
    }).join('\n            ');

    return `
        <div id="${instanceId}" class="scope-container">
            <div id="${instanceId}-scopes" class="scope-list">
                ${scopesHtml}
            </div>
        </div>
    `.trim();
}
