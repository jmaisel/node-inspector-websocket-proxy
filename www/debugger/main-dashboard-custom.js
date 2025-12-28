// Import TemplateRegistry
import { TemplateRegistry, escapeHtml } from './TemplateRegistry.js';

// Import default templates as fallbacks
import { consoleTemplate } from './templates/console-template.js';
import { callStackTemplate } from './templates/callstack-template.js';
import { breakpointsTemplate } from './templates/breakpoints-template.js';

// Import all controller classes
import {
    ToolbarUIController,
    ConsoleUIController,
    DebuggerUIController,
    CallStackUIController,
    FileTreeUIController,
    BreakpointUIController
} from './controllers.js';

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
// REGISTER CUSTOM TEMPLATES
// =============================================================================

console.log('🎨 Registering CUSTOM templates...');

// Register custom templates
TemplateRegistry.register('toolbar', customToolbarTemplate);
TemplateRegistry.register('filetree', customFileTreeTemplate);

// Use default templates for other components
TemplateRegistry.register('console', consoleTemplate);
TemplateRegistry.register('callstack', callStackTemplate);
TemplateRegistry.register('breakpoints', breakpointsTemplate);

console.log('✅ Templates registered:', Array.from(TemplateRegistry.templates.keys()));
console.log('   🎨 Custom: toolbar, filetree');
console.log('   📦 Default: console, callstack, breakpoints');

// =============================================================================
// DASHBOARD APPLICATION CLASS
// =============================================================================

class CustomDashboardDebuggerUI {
    constructor() {
        // Configuration: specify exactly where each component should render
        const componentTargets = {
            toolbar: '#toolbar-container',
            toolbarSettings: '#settings-container',
            console: '#console-container',
            consoleDock: '#console-dock-container',
            callStack: '#callstack-container',
            fileTree: '#files-container',
            breakpoints: '#breakpoints-container'
        };

        // UI Controllers - All use templates (custom or default) and render to specified containers
        this.toolbarController = new ToolbarUIController({
            debuggerUI: this,
            instanceId: 'toolbar',
            skipRender: false,
            zoneSelector: '#toolbarDockZone'
        });

        this.consoleController = new ConsoleUIController({
            debuggerUI: this,
            instanceId: 'console',
            skipRender: false
        });

        this.callStackController = new CallStackUIController({
            debuggerUI: this,
            instanceId: 'callstack',
            skipRender: false
        });

        this.fileTreeController = new FileTreeUIController({
            debuggerUI: this,
            instanceId: 'files',
            skipRender: false
        });

        this.breakpointController = new BreakpointUIController({
            debuggerUI: this,
            instanceId: 'breakpoints',
            skipRender: false
        });

        this.debuggerController = new DebuggerUIController(this);

        // Store targets for reference
        this.targets = componentTargets;
    }

    /**
     * Initialize all controllers
     */
    async initialize() {
        console.log('🚀 Initializing Custom Dashboard with custom templates...');
        console.log('📍 Component render targets:', this.targets);

        // Mount toolbar to specified container (using CUSTOM template)
        console.log(`  → 🎨 Mounting toolbar (CUSTOM TEMPLATE) to: ${this.targets.toolbar}`);
        this.toolbarController.mount(this.targets.toolbar, this.targets.toolbarSettings);
        this.toolbarController.initialize();

        // Mount console to specified container (using default template)
        console.log(`  → 📦 Mounting console (default template) to: ${this.targets.console}`);
        this.consoleController.mount(this.targets.console, this.targets.consoleDock);
        this.consoleController.initialize();

        // Mount call stack to specified container (using default template)
        console.log(`  → 📦 Mounting call stack (default template) to: ${this.targets.callStack}`);
        this.callStackController.mount(this.targets.callStack);
        this.callStackController.initialize();

        // Mount file tree to specified container (using CUSTOM template)
        console.log(`  → 🎨 Mounting file tree (CUSTOM TEMPLATE) to: ${this.targets.fileTree}`);
        this.fileTreeController.mount(this.targets.fileTree);
        await this.fileTreeController.initialize();

        // Mount breakpoints to specified container (using default template)
        console.log(`  → 📦 Mounting breakpoints (default template) to: ${this.targets.breakpoints}`);
        this.breakpointController.mount(this.targets.breakpoints);
        this.breakpointController.initialize();

        // Initialize debugger controller
        this.debuggerController.initialize();

        console.log('✅ Custom Dashboard DebuggerUI initialized!');
        console.log('   🎨 Custom templates active for: toolbar, file tree');
        console.log('   📦 Default templates used for: console, call stack, breakpoints');
    }
}

const ui = new CustomDashboardDebuggerUI();

$(document).ready(function() {
    ui.initialize();
});