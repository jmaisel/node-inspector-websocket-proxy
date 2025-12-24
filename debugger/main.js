// =============================================================================
// GLOBAL STATE - Organized by Domain
// =============================================================================

// UI Controllers (global references for event handlers)
let fileTreeController = null;
let consoleController = null;
let debuggerController = null;
let callStackController = null;

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
        consoleController = new ConsoleUIController();
        consoleController.initialize();

        // Debugger initialization
        debuggerController = new DebuggerUIController();
        debuggerController.initialize();

        // Call Stack initialization
        callStackController = new CallStackUIController();
        callStackController.initialize();

        // File tree initialization
        fileTreeController = new FileTreeUIController();
        await fileTreeController.initialize();
    }
}

const ui = new DebuggerUI();

$(document).ready(function() {
    ui.main();
});