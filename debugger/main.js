// Import all controller classes
import {
    ToolbarUIController,
    TabNavigationUIController,
    ConsoleUIController,
    DebuggerUIController,
    CallStackUIController,
    FileTreeUIController
} from './controllers.js';

// =============================================================================
// GLOBAL STATE - Organized by Domain
// =============================================================================

// UI Controllers (global references for event handlers)
// Attached to window for cross-module access
window.fileTreeController = null;
window.consoleController = null;
window.debuggerController = null;
window.callStackController = null;

class DebuggerUI{
    constructor() {
    }

    async main(){
        // Toolbar initialization
        const toolbarController = new ToolbarUIController();
        toolbarController.initialize();

        // Tab navigation initialization
        const tabNavController = new TabNavigationUIController();
        tabNavController.initialize();

        // Console initialization
        window.consoleController = new ConsoleUIController();
        window.consoleController.initialize();

        // Debugger initialization
        window.debuggerController = new DebuggerUIController();
        window.debuggerController.initialize();

        // Call Stack initialization
        window.callStackController = new CallStackUIController();
        window.callStackController.initialize();

        // File tree initialization
        window.fileTreeController = new FileTreeUIController();
        await window.fileTreeController.initialize();
    }
}

const ui = new DebuggerUI();

$(document).ready(function() {
    ui.main();
});