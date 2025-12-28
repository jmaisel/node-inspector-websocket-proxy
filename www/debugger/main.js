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
// MAIN APPLICATION CLASS
// =============================================================================

class DebuggerUI {
    constructor() {
        // UI Controllers - all receive 'this' for accessing other controllers
        this.toolbarController = new ToolbarUIController({
            debuggerUI: this,
            instanceId: 'toolbar',
            skipRender: true  // Use existing HTML in index.html
        });
        this.tabNavController = new TabNavigationUIController(this);
        this.consoleController = new ConsoleUIController({
            debuggerUI: this,
            instanceId: 'console',
            skipRender: true  // Use existing HTML in index.html
        });
        this.callStackController = new CallStackUIController({
            debuggerUI: this,
            instanceId: 'callstack',
            skipRender: true  // Use existing HTML in index.html
        });
        this.fileTreeController = new FileTreeUIController(this);
        this.breakpointController = new BreakpointUIController({
            debuggerUI: this,
            instanceId: 'breakpoints',
            skipRender: true  // Use existing HTML in index.html
        });
        this.debuggerController = new DebuggerUIController(this);
    }

    /**
     * Initialize all controllers
     */
    async initialize() {
        // Initialize controllers in dependency order
        this.toolbarController.initialize();
        this.tabNavController.initialize();
        this.consoleController.initialize();
        this.callStackController.initialize();
        await this.fileTreeController.initialize();
        this.breakpointController.initialize();
        this.debuggerController.initialize();
    }
}

const ui = new DebuggerUI();

$(document).ready(function() {
    ui.initialize();
});