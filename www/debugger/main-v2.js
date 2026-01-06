// Import DebuggerUIApplet and helper function
import { DebuggerUIApplet, createTabbedConfig } from './DebuggerUIApplet.js';

// =============================================================================
// MAIN APPLICATION - TABBED UI WITH DEFAULT TEMPLATES
// =============================================================================

console.log('🚀 Initializing Tabbed UI with DebuggerUIApplet...');
console.log('   All components use default templates (auto-applied)');

// Define custom tab configuration
const tabs = [
    { name: 'console', label: 'Console', paneId: 'console-tab-pane' },
    { name: 'callstack', label: 'Call Stack', paneId: 'callstack-tab-pane' },
    { name: 'files', label: 'Files', paneId: 'tab-files' },
    { name: 'breakpoints', label: 'Breakpoints', paneId: 'breakpoints-tab-pane' },
    { name: 'scope', label: 'Scope', paneId: 'tab-scope' }
];

// Create configuration - defaults are automatic, no template imports needed!
const config = createTabbedConfig({}, tabs);

// Create and initialize the applet
const applet = new DebuggerUIApplet(config);

// Expose for debugging
window.debuggerApplet = applet;

$(document).ready(function() {
    applet.initialize().then(() => {
        console.log('✅ Tabbed UI initialized!');
        console.log('   Access applet via window.debuggerApplet');
    });
});