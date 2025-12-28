// Import TemplateRegistry
import { TemplateRegistry } from './TemplateRegistry.js';

// Import all templates
import { toolbarTemplate } from './templates/toolbar-template.js';
import { consoleTemplate } from './templates/console-template.js';
import { callStackTemplate } from './templates/callstack-template.js';
import { fileTreeTemplate } from './templates/file-tree-template.js';
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
// REGISTER TEMPLATES
// =============================================================================

TemplateRegistry.register('toolbar', toolbarTemplate);
TemplateRegistry.register('console', consoleTemplate);
TemplateRegistry.register('callstack', callStackTemplate);
TemplateRegistry.register('filetree', fileTreeTemplate);
TemplateRegistry.register('breakpoints', breakpointsTemplate);

console.log('✅ Templates registered:', Array.from(TemplateRegistry.templates.keys()));

// =============================================================================
// DASHBOARD APPLICATION CLASS
// =============================================================================

class DashboardDebuggerUI {
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

        // UI Controllers - All use templates and render to specified containers
        this.toolbarController = new ToolbarUIController({
            debuggerUI: this,
            instanceId: 'toolbar',
            skipRender: false,
            zoneSelector: '#toolbarDockZone' // Not used in dashboard mode
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
        console.log('🚀 Initializing Dashboard DebuggerUI with template rendering...');
        console.log('📍 Component render targets:', this.targets);

        // Mount toolbar to specified container
        console.log(`  → Mounting toolbar to: ${this.targets.toolbar}`);
        this.toolbarController.mount(this.targets.toolbar, this.targets.toolbarSettings);
        this.toolbarController.initialize();

        // Mount console to specified container
        console.log(`  → Mounting console to: ${this.targets.console}`);
        this.consoleController.mount(this.targets.console, this.targets.consoleDock);
        this.consoleController.initialize();

        // Mount call stack to specified container
        console.log(`  → Mounting call stack to: ${this.targets.callStack}`);
        this.callStackController.mount(this.targets.callStack);
        this.callStackController.initialize();

        // Mount file tree to specified container
        console.log(`  → Mounting file tree to: ${this.targets.fileTree}`);
        this.fileTreeController.mount(this.targets.fileTree);
        await this.fileTreeController.initialize();

        // Mount breakpoints to specified container
        console.log(`  → Mounting breakpoints to: ${this.targets.breakpoints}`);
        this.breakpointController.mount(this.targets.breakpoints);
        this.breakpointController.initialize();

        // Initialize debugger controller
        this.debuggerController.initialize();

        console.log('✅ Dashboard DebuggerUI initialized!');
        console.log('   All components rendered from templates to their specified containers');
    }
}

const ui = new DashboardDebuggerUI();

$(document).ready(function() {
    ui.initialize();
});