// Import DebuggerUIApplet and helper function
import { DebuggerUIApplet, createDashboardConfig } from './DebuggerUIApplet.js';

// =============================================================================
// DASHBOARD APPLICATION - ALL DEFAULT TEMPLATES (NO IMPORTS NEEDED!)
// =============================================================================

console.log('🚀 Initializing Dashboard with DebuggerUIApplet...');
console.log('   All components use default templates (auto-applied)');

// Create configuration - defaults are automatic, no template imports needed!
const config = createDashboardConfig();

// Create and initialize the applet
const applet = new DebuggerUIApplet(config);

// Expose for debugging
window.debuggerApplet = applet;

$(document).ready(function() {
    applet.initialize().then(() => {
        console.log('✅ Dashboard initialized!');
        console.log('   Access applet via window.debuggerApplet');
    });
});