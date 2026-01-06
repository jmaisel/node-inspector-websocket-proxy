// Import DebuggerUIApplet and helper function
import { DebuggerUIApplet, createDashboardConfig } from './DebuggerUIApplet.js';
import { escapeHtml } from './TemplateRegistry.js';

// =============================================================================
// CUSTOM TEMPLATES
// =============================================================================

/**
 * Custom Toolbar Template - Modern gradient design with text-based buttons
 */
function customToolbarTemplate(data = {}, instanceId = 'toolbar') {
    const {
        wsUrl = 'ws://localhost:8888',
        iconSize = 'medium',
        debugControlsVisible = false
    } = data;

    return {
        toolbar: `
            <div class="toolbar custom-toolbar" id="${instanceId}" data-icon-size="${iconSize}">
                <!-- Connection Controls -->
                <div id="${instanceId}-connection-controls" class="custom-toolbar-group">
                    <span class="custom-toolbar-label">Connection</span>
                    <input type="text" id="${instanceId}-ws-url" class="toolbar-input"
                           value="${escapeHtml(wsUrl)}" placeholder="ws://localhost:8888">
                    <button class="custom-btn success" id="${instanceId}-connect-btn">Connect</button>
                </div>

                <!-- Debug Controls -->
                <div id="${instanceId}-debug-controls" class="custom-toolbar-group"
                     style="display: ${debugControlsVisible ? 'flex' : 'none'};">
                    <span class="custom-toolbar-label">Debug</span>
                    <button class="custom-btn" id="${instanceId}-pause-btn">Pause</button>
                    <button class="custom-btn" id="${instanceId}-resume-btn" disabled>Resume</button>
                    <button class="custom-btn" id="${instanceId}-step-over-btn" disabled>Step Over</button>
                    <button class="custom-btn" id="${instanceId}-step-into-btn" disabled>Step Into</button>
                    <button class="custom-btn" id="${instanceId}-step-out-btn" disabled>Step Out</button>
                    <button class="custom-btn danger" id="${instanceId}-disconnect-btn">Disconnect</button>
                    <button class="custom-btn" id="${instanceId}-settings-btn">⚙️</button>
                </div>
            </div>
        `,

        settingsPanel: `
            <div class="settings-panel custom-settings-panel" id="${instanceId}-settings-panel" style="display: none;">
                <div class="settings-header">⚙️ Toolbar Settings</div>
                <div class="settings-options">
                    <button class="settings-option-btn custom-btn" id="${instanceId}-icon-size-small" data-size="small">
                        Small Buttons
                    </button>
                    <button class="settings-option-btn custom-btn" id="${instanceId}-icon-size-medium" data-size="medium">
                        Medium Buttons
                    </button>
                    <button class="settings-option-btn custom-btn" id="${instanceId}-icon-size-large" data-size="large">
                        Large Buttons
                    </button>
                </div>
            </div>
        `
    };
}

/**
 * Custom File Tree Template - Different labels and emojis
 */
function customFileTreeTemplate(data = {}, instanceId = 'files') {
    return `
        <div class="tab-pane" id="tab-${instanceId}">
            <div id="fileTree">
                <div class="tree-node">
                    <div class="tree-node-header" onclick="toggleTreeNode(this)">
                        <span class="tree-icon">▶</span>
                        <span class="tree-label">🚀 My Project</span>
                    </div>
                    <div class="tree-children" id="projectFiles"></div>
                </div>
                <div class="tree-node">
                    <div class="tree-node-header" onclick="toggleTreeNode(this)">
                        <span class="tree-icon">▶</span>
                        <span class="tree-label">📦 External Packages</span>
                    </div>
                    <div class="tree-children">
                        <div class="tree-node">
                            <div class="tree-node-header" onclick="toggleTreeNode(this)">
                                <span class="tree-icon">▶</span>
                                <span class="tree-label">✅ Production Dependencies</span>
                            </div>
                            <div class="tree-children" id="dependencies"></div>
                        </div>
                        <div class="tree-node">
                            <div class="tree-node-header" onclick="toggleTreeNode(this)">
                                <span class="tree-icon">▶</span>
                                <span class="tree-label">🔧 Development Dependencies</span>
                            </div>
                            <div class="tree-children" id="devDependencies"></div>
                        </div>
                    </div>
                </div>
                <div class="tree-node">
                    <div class="tree-node-header" onclick="toggleTreeNode(this)">
                        <span class="tree-icon">▶</span>
                        <span class="tree-label">⚡ Node.js Core</span>
                    </div>
                    <div class="tree-children" id="nodeInternalFiles"></div>
                </div>
            </div>
        </div>
    `;
}

// =============================================================================
// DASHBOARD APPLICATION - CUSTOM + DEFAULT TEMPLATES
// =============================================================================

console.log('🚀 Initializing Custom Dashboard with DebuggerUIApplet...');
console.log('   🎨 Custom: toolbar, fileTree');
console.log('   📦 Default: console, callStack, breakpoints (auto-applied)');

// Create configuration with ONLY custom templates
// Default templates are automatically applied by the applet!
const config = createDashboardConfig({
    toolbar: customToolbarTemplate,
    fileTree: customFileTreeTemplate
    // No need to import/specify console, callStack, breakpoints - defaults are automatic!
});

// Create and initialize the applet
const applet = new DebuggerUIApplet(config);

// Expose for debugging
window.debuggerApplet = applet;

$(document).ready(function() {
    applet.initialize().then(() => {
        console.log('✅ Custom Dashboard initialized!');
        console.log('   Access applet via window.debuggerApplet');
    });
});