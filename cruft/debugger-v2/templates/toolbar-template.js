import { escapeHtml } from '../core/ViewUtils.js';

/**
 * Default template for ToolbarView
 * Generates toolbar with connection/debug controls and settings
 *
 * @param {Object} data - Template data
 * @param {string} data.wsUrl - WebSocket URL
 * @param {string} data.iconSize - Icon size ('small', 'medium', 'large')
 * @param {boolean} data.showDebugControls - Whether to show debug controls
 * @param {boolean} data.showConnectionControls - Whether to show connection controls
 * @param {boolean} data.showRedockBtn - Whether to show redock button
 * @param {Object} config - View configuration
 * @param {string} instanceId - Unique instance ID
 * @returns {string} HTML string
 */
export function toolbarTemplate(data, config, instanceId) {
    const {
        wsUrl = 'ws://localhost:8888',
        iconSize = 'medium',
        showDebugControls = false,
        showConnectionControls = true,
        showRedockBtn = false
    } = data;

    const connectionDisplay = showConnectionControls ? '' : ' style="display: none;"';
    const debugDisplay = showDebugControls ? '' : ' style="display: none;"';
    const redockDisplay = showRedockBtn ? '' : ' style="display: none;"';

    return `
        <div class="toolbar" id="${instanceId}" data-icon-size="${iconSize}">
            <div class="toolbar-grip" id="${instanceId}-grip" title="Drag to dock">⋮⋮</div>

            <!-- Connection Controls -->
            <div id="${instanceId}-connection-controls" class="toolbar-group"${connectionDisplay}>
                <input type="text" id="${instanceId}-ws-url" class="toolbar-input" value="${escapeHtml(wsUrl)}" placeholder="ws://localhost:8888" title="WebSocket URL">
                <button class="toolbar-btn success" id="${instanceId}-connect-btn">
                    <span class="btn-icon">🔌</span>
                    <span class="btn-label">Connect</span>
                </button>
            </div>

            <!-- Debug Controls -->
            <div id="${instanceId}-debug-controls" class="toolbar-group"${debugDisplay}>
                <button class="toolbar-btn" id="${instanceId}-pause-btn">
                    <span class="btn-icon">⏸</span>
                    <span class="btn-label">Pause</span>
                </button>
                <button class="toolbar-btn" id="${instanceId}-resume-btn" disabled>
                    <span class="btn-icon">▶</span>
                    <span class="btn-label">Resume</span>
                </button>
                <div class="toolbar-divider"></div>
                <button class="toolbar-btn" id="${instanceId}-step-over-btn" disabled>
                    <span class="btn-icon">⤵</span>
                    <span class="btn-label">Over</span>
                </button>
                <button class="toolbar-btn" id="${instanceId}-step-into-btn" disabled>
                    <span class="btn-icon">⤓</span>
                    <span class="btn-label">Into</span>
                </button>
                <button class="toolbar-btn" id="${instanceId}-step-out-btn" disabled>
                    <span class="btn-icon">⤒</span>
                    <span class="btn-label">Out</span>
                </button>
                <div class="toolbar-divider"></div>
                <button class="toolbar-btn danger" id="${instanceId}-disconnect-btn">
                    <span class="btn-icon">✗</span>
                    <span class="btn-label">Disconnect</span>
                </button>
            </div>

            <!-- Settings Controls -->
            <div class="toolbar-group toolbar-settings">
                <div class="toolbar-divider"></div>
                <button class="toolbar-btn small" id="${instanceId}-redock-btn" title="Dock toolbar above tabs"${redockDisplay}>
                    <span class="btn-icon">⇲</span>
                </button>
                <div class="toolbar-divider"></div>
                <button class="toolbar-btn small" id="${instanceId}-settings-btn" title="Settings">
                    <span class="btn-icon">⚙️</span>
                </button>
            </div>
        </div>

        <!-- Settings Panel -->
        <div class="settings-panel" id="${instanceId}-settings-panel" style="display: none;">
            <div class="settings-header">Icon Size</div>
            <div class="settings-options">
                <button class="settings-option-btn" id="${instanceId}-icon-size-small" data-size="small">
                    <span class="btn-icon">S</span>
                    <span class="btn-label">Small</span>
                </button>
                <button class="settings-option-btn" id="${instanceId}-icon-size-medium" data-size="medium">
                    <span class="btn-icon">M</span>
                    <span class="btn-label">Medium</span>
                </button>
                <button class="settings-option-btn" id="${instanceId}-icon-size-large" data-size="large">
                    <span class="btn-icon">L</span>
                    <span class="btn-label">Large</span>
                </button>
            </div>
        </div>
    `.trim();
}
