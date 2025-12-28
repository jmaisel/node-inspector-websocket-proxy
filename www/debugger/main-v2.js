// Import TemplateRegistry
import { TemplateRegistry } from './TemplateRegistry.js';

// Import all templates
import { toolbarTemplate } from './templates/toolbar-template.js';
import { tabNavigationTemplate } from './templates/tab-navigation-template.js';
import { consoleTemplate } from './templates/console-template.js';
import { callStackTemplate } from './templates/callstack-template.js';
import { fileTreeTemplate } from './templates/file-tree-template.js';
import { breakpointsTemplate } from './templates/breakpoints-template.js';

// Import all controller classes
import {
    ToolbarUIController,
    TabNavigationUIController,
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
TemplateRegistry.register('tab-navigation', tabNavigationTemplate);
TemplateRegistry.register('console', consoleTemplate);
TemplateRegistry.register('callstack', callStackTemplate);
TemplateRegistry.register('filetree', fileTreeTemplate);
TemplateRegistry.register('breakpoints', breakpointsTemplate);

console.log('✅ Templates registered:', Array.from(TemplateRegistry.templates.keys()));

// =============================================================================
// MAIN APPLICATION CLASS
// =============================================================================

class DebuggerUI {
    constructor() {
        // UI Controllers - Components will render themselves from templates
        this.toolbarController = new ToolbarUIController({
            debuggerUI: this,
            instanceId: 'toolbar',
            skipRender: false,  // Let it render from template
            zoneSelector: '#toolbarDockZone'
        });

        // Tab Navigation with programmatic tabs
        this.tabNavController = new TabNavigationUIController({
            debuggerUI: this,
            instanceId: 'tab-nav',
            skipRender: false,  // Let it render from template
            tabs: [
                { name: 'console', label: 'Console', paneId: 'console-tab-pane' },
                { name: 'callstack', label: 'Call Stack', paneId: 'callstack-tab-pane' },
                { name: 'files', label: 'Files', paneId: 'tab-files' },
                { name: 'breakpoints', label: 'Breakpoints', paneId: 'breakpoints-tab-pane' },
                // { name: 'watches', label: 'Watches', paneId: 'tab-watches' },
                { name: 'scope', label: 'Scope', paneId: 'tab-scope' }
            ]
        });

        this.consoleController = new ConsoleUIController({
            debuggerUI: this,
            instanceId: 'console',
            skipRender: false  // Let it render from template
        });

        this.callStackController = new CallStackUIController({
            debuggerUI: this,
            instanceId: 'callstack',
            skipRender: false  // Let it render from template
        });

        this.fileTreeController = new FileTreeUIController({
            debuggerUI: this,
            instanceId: 'files',
            skipRender: false  // Let it render from template
        });

        this.breakpointController = new BreakpointUIController({
            debuggerUI: this,
            instanceId: 'breakpoints',
            skipRender: false  // Let it render from template
        });

        this.debuggerController = new DebuggerUIController(this);
    }

    /**
     * Initialize all controllers
     */
    async initialize() {
        console.log('🚀 Initializing DebuggerUI v2 with template rendering...');

        // Mount toolbar (renders from template)
        this.toolbarController.mount('#toolbar-container', '#settings-container');
        this.toolbarController.initialize();

        // Mount tab navigation (renders from template)
        this.tabNavController.mount('#content');
        this.tabNavController.initialize();

        // Mount console (renders from template)
        this.consoleController.mount('#tab-content-container', '#console-dock-container');
        this.consoleController.initialize();

        // Mount call stack (renders from template)
        this.callStackController.mount('#tab-content-container');
        this.callStackController.initialize();

        // Mount file tree (renders from template)
        this.fileTreeController.mount('#tab-content-container');
        await this.fileTreeController.initialize();

        // Mount breakpoints (renders from template)
        this.breakpointController.mount('#tab-content-container');
        this.breakpointController.initialize();

        // Initialize debugger controller
        this.debuggerController.initialize();

        console.log('✅ DebuggerUI v2 initialized - all components rendered from templates!');
    }
}

const ui = new DebuggerUI();

$(document).ready(function() {
    ui.initialize();
});