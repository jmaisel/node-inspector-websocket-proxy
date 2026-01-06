/**
 * Debugger v2 - Main Entry Point
 *
 * Initializes all debugger components with View-based architecture.
 * This is a complete standalone debugger application.
 */

import { ToolbarController } from './controllers/ToolbarController.js';
import { TabSystemController } from './controllers/TabSystemController.js';
import { ConsoleController } from './controllers/ConsoleController.js';
import { FileTreeController } from './controllers/FileTreeController.js';
import { CallStackController } from './controllers/CallStackController.js';
import { BreakpointController } from './controllers/BreakpointController.js';
import { WatchesController } from './controllers/WatchesController.js';
import { ScopeController } from './controllers/ScopeController.js';

/**
 * DebuggerApp - Main application class
 */
class DebuggerApp {
    constructor() {
        this.controllers = {};
        this.client = null; // Protocol client (InspectorBrowserProxy or BaseDomainController)
        this.isPaused = false;
        this.currentSession = null; // Current debug session info
    }

    /**
     * Initialize the debugger application
     */
    async initialize() {
        console.log('Initializing Debugger v2...');

        try {
            // Initialize toolbar first
            this.controllers.toolbar = new ToolbarController({
                container: 'body', // Will be moved to dock zone after mount
                dockZone: '#toolbar-dock-zone',
                wsUrl: 'ws://localhost:8888'
            });

            // Initialize tab system
            this.controllers.tabSystem = new TabSystemController({
                container: '#tab-system-container'
            });

            // Mount toolbar and tab system first
            await this.controllers.toolbar.initialize();
            await this.controllers.tabSystem.initialize();

            console.log('Toolbar and tabs initialized');

            // Now initialize components that go into tab panes
            const tabSystem = this.controllers.tabSystem;

            // Initialize console in console tab
            this.controllers.console = new ConsoleController({
                container: tabSystem.getPane('console'),
                mode: 'tabbed',
                exposeGlobally: true
            });

            // Initialize file tree
            this.controllers.fileTree = new FileTreeController({
                container: tabSystem.getPane('files')
            });

            // Initialize call stack
            this.controllers.callStack = new CallStackController({
                container: tabSystem.getPane('callstack')
            });

            // Initialize breakpoints
            this.controllers.breakpoints = new BreakpointController({
                container: tabSystem.getPane('breakpoints')
            });

            // Initialize watches
            this.controllers.watches = new WatchesController({
                container: tabSystem.getPane('watches')
            });

            // Initialize scope
            this.controllers.scope = new ScopeController({
                container: tabSystem.getPane('scope')
            });

            // Mount all pane controllers
            await Promise.all([
                this.controllers.console.initialize(),
                this.controllers.fileTree.initialize(),
                this.controllers.callStack.initialize(),
                this.controllers.breakpoints.initialize(),
                this.controllers.watches.initialize(),
                this.controllers.scope.initialize()
            ]);

            console.log('All panes initialized');

            // Setup event handlers
            this.setupEventHandlers();

            console.log('Debugger v2 initialized successfully!');

            // Test log
            if (window.log) {
                window.log('Debugger v2 ready', 'info');
                window.log('Click "Connect" to start debugging', 'event');
            }
        } catch (error) {
            console.error('Initialization error:', error);
            throw error;
        }
    }

    /**
     * Setup cross-component event handlers
     */
    setupEventHandlers() {
        console.log('[DebuggerApp] Setting up event handlers');

        // Toolbar events
        console.log('[DebuggerApp] Registering toolbar connect handler');
        this.controllers.toolbar.on('connect', (wsUrl) => {
            console.log('[DebuggerApp] CONNECT EVENT FIRED! wsUrl:', wsUrl);
            this.connect(wsUrl);
        });

        this.controllers.toolbar.on('disconnect', () => {
            console.log('[DebuggerApp] Disconnect requested');
            this.disconnect();
        });

        this.controllers.toolbar.on('pause', () => {
            console.log('[DebuggerApp] Pause requested');
            this.pause();
        });

        this.controllers.toolbar.on('resume', () => {
            console.log('[DebuggerApp] Resume requested');
            this.resume();
        });

        // File tree events
        this.controllers.fileTree.onFileSelected = (scriptId, url) => {
            console.log('File selected:', scriptId, url);
            window.log?.(`Selected: ${url}`, 'info');
        };

        // Breakpoint events
        this.controllers.breakpoints.on('add', (data) => {
            console.log('Add breakpoint:', data);
            window.log?.(`Setting breakpoint at ${data.url}:${data.lineNumber}`, 'info');
            // TODO: Implement add breakpoint logic
        });

        this.controllers.breakpoints.on('remove', (data) => {
            console.log('Remove breakpoint:', data);
            window.log?.(`Removed breakpoint ${data.id}`, 'info');
            // TODO: Implement remove breakpoint logic
        });

        // Watch events
        this.controllers.watches.on('add', (data) => {
            console.log('Add watch:', data);
            window.log?.(`Watching: ${data.expression}`, 'info');
            // TODO: Implement add watch logic
        });

        // Call stack events
        this.controllers.callStack.onFrameSelected = (index, frame) => {
            console.log('Frame selected:', index, frame);
            window.log?.(`Selected frame ${index}`, 'info');
            // TODO: Implement frame selection logic
        };
    }

    /**
     * Get controller by name
     * @param {string} name - Controller name
     * @returns {Object} Controller instance
     */
    getController(name) {
        return this.controllers[name];
    }

    /**
     * Connect to the debugger
     * @param {string} wsUrl - WebSocket URL (optional - will check for active session)
     */
    async connect(wsUrl) {
        try {
            window.log?.(`Connecting to ${wsUrl}...`, 'info');

            // Initialize the BaseDomainController with the WebSocket URL
            const eventQueue = BaseDomainController.initialize(wsUrl);

            // Subscribe to connection lifecycle events
            eventQueue.queue.subscribe('WebSocket.close', () => {
                window.log?.('Connection closed', 'error');
                this.controllers.toolbar.showConnectionControls();
                this.client = null;
            });

            // Connect to the WebSocket
            eventQueue.connect();

            // Wait for Proxy.ready event
            await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);

                eventQueue.queue.subscribe('Proxy.ready', () => {
                    clearTimeout(timeoutId);
                    window.log?.('Proxy ready', 'info');
                    resolve();
                });

                eventQueue.queue.subscribe('WebSocket.error', (topic, data) => {
                    clearTimeout(timeoutId);
                    reject(new Error('Connection failed'));
                });
            });

            window.log?.('Connected successfully', 'info');

            // Use controller instances from the event queue
            // Create a client-like object for compatibility with existing code
            this.client = {
                debugger: eventQueue.debuggerController,
                runtime: eventQueue.runtimeController,
                console: eventQueue.consoleController,
                disconnect: () => {
                    if (eventQueue.ws) {
                        eventQueue.ws.close();
                    }
                }
            };

            // Enable debugger and runtime
            await this.client.console.enable();
            await this.client.debugger.enable();
            await this.client.runtime.enable();

            // Activate breakpoints (required for breakpoints to work)
            await this.client.debugger.setBreakpointsActive(true);
            window.log?.('Breakpoints activated', 'info');

            // Update UI after successful connection and enable
            window.log?.('Debugger enabled', 'info');
            this.controllers.toolbar.showDebugControls();

        } catch (error) {
            window.log?.(`Connection error: ${error.message}`, 'error');
        }
    }

    /**
     * Disconnect from the debugger
     * (Does NOT stop the debug session - session is managed elsewhere)
     */
    disconnect() {
        console.log('[DebuggerApp] Disconnecting...');

        // Close WebSocket connection only
        if (this.client) {
            this.client.disconnect();
            this.client = null;
        }

        this.isPaused = false;
        this.currentSession = null;
        this.controllers.toolbar.showConnectionControls();
        window.log?.('Disconnected from session', 'info');
    }

    /**
     * Pause execution
     */
    pause() {
        if (this.client && this.client.debugger) {
            console.log('[DebuggerApp] Pausing...');
            window.log?.('Pausing execution...', 'info');
            this.client.debugger.pause();
        } else {
            window.log?.('Not connected to debugger', 'error');
        }
    }

    /**
     * Resume execution
     */
    resume() {
        if (this.client && this.client.debugger) {
            console.log('[DebuggerApp] Resuming...');
            window.log?.('Resuming execution...', 'info');
            this.client.debugger.resume();
        } else {
            window.log?.('Not connected to debugger', 'error');
        }
    }
}

// Initialize app on DOM ready
$(document).ready(async function() {
    const app = new DebuggerApp();
    window.debuggerApp = app; // Expose globally for debugging

    try {
        await app.initialize();
    } catch (error) {
        console.error('Failed to initialize debugger:', error);
    }
});
