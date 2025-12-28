import { escapeHtml } from '../TemplateRegistry.js';

/**
 * Default template for Toolbar component
 *
 * Generates:
 * 1. Main toolbar with connection/debug controls
 * 2. Settings panel
 *
 * @param {Object} data - Template data
 * @param {string} data.wsUrl - WebSocket URL (default: 'ws://localhost:8888')
 * @param {string} data.iconSize - Icon size ('small', 'medium', 'large') (default: 'medium')
 * @param {boolean} data.debugControlsVisible - Show debug controls (default: false)
 * @param {string} instanceId - Unique instance identifier for DOM elements
 * @returns {Object} Object with toolbar and settingsPanel HTML strings
 */
export function toolbarTemplate(data = {}, instanceId = 'toolbar') {
    const {
        wsUrl = 'ws://localhost:8888',
        iconSize = 'medium',
        debugControlsVisible = false
    } = data;

    return {
        // Main toolbar HTML
        toolbar: `
            <div class="toolbar" id="${instanceId}" data-icon-size="${iconSize}">
                <div class="toolbar-grip" id="${instanceId}-grip" title="Drag to dock">⋮⋮</div>

                <!-- Connection Controls -->
                <div id="${instanceId}-connection-controls" class="toolbar-group">
                    <input type="text" id="${instanceId}-ws-url" class="toolbar-input" value="${escapeHtml(wsUrl)}" placeholder="ws://localhost:8888" title="WebSocket URL">
                    <button class="toolbar-btn success" id="${instanceId}-connect-btn">
                        <span class="btn-icon">🔌</span>
                        <span class="btn-label">Connect</span>
                    </button>
                </div>

                <!-- Debug Controls -->
                <div id="${instanceId}-debug-controls" class="toolbar-group" style="display: ${debugControlsVisible ? 'flex' : 'none'};">
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
                    <button class="toolbar-btn small" id="${instanceId}-redock-btn" title="Dock toolbar above tabs" style="display: none;">
                        <span class="btn-icon">⇲</span>
                    </button>
                    <div class="toolbar-divider"></div>
                    <button class="toolbar-btn small" id="${instanceId}-settings-btn" title="Settings">
                        <span class="btn-icon">⚙️</span>
                    </button>
                </div>
            </div>
        `,

        // Settings panel HTML
        settingsPanel: `
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
        `
    };
}