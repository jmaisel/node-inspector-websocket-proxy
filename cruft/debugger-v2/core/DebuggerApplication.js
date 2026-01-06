/**
 * DebuggerApplication - Main Entry Point (Embeddable)
 *
 * Fully embeddable debugger UI with template override support.
 * Can be instantiated multiple times on the same page.
 *
 * Usage:
 *   const app = new DebuggerApplication({
 *       container: '#debugger-root',
 *       wsUrl: 'ws://localhost:8888'
 *   });
 *   await app.initialize();
 */

import { ToolbarController } from '../controllers/ToolbarController.js';
import { TabSystemController } from '../controllers/TabSystemController.js';
import { ConsoleController } from '../controllers/ConsoleController.js';
import { FileTreeController } from '../controllers/FileTreeController.js';
import { CallStackController } from '../controllers/CallStackController.js';
import { BreakpointController } from '../controllers/BreakpointController.js';
import { WatchesController } from '../controllers/WatchesController.js';
import { ScopeController } from '../controllers/ScopeController.js';

class DebuggerApplication {
    /**
     * Create a new DebuggerApplication instance
     * @param {Object} config - Configuration object
     * @param {string} config.container - Main container selector (required)
     * @param {string} config.wsUrl - WebSocket URL (default: 'ws://localhost:8888')
     * @param {Object} config.options - Optional configuration
     * @param {string} config.options.instanceId - Custom instance ID (auto-generated if not provided)
     * @param {boolean} config.options.autoConnect - Auto-connect on initialize (default: false)
     * @param {Object} config.options.containers - Custom container selectors per component
     */
    constructor({ container, wsUrl = 'ws://localhost:8888', options = {} }) {
        // Validate required parameters
        if (!container) {
            throw new Error('DebuggerApplication requires a container selector');
        }

        this.container = container;
        this.wsUrl = wsUrl;
        this.options = options;

        // Generate unique instance ID for DOM scoping
        this.instanceId = options.instanceId ||
            `debugger-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Use InspectorBrowserProxy - it manages its own lifecycle and has a queue
        this.proxy = new InspectorBrowserProxy(wsUrl);
        this.eventQueue = this.proxy.queue;  // Use the proxy's queue

        // Controllers will be created in initialize()
        this.controllers = {};

        console.log(`[DebuggerApplication:${this.instanceId}] Created with container: ${container}`);
    }

    /**
     * Get container selector for a specific component
     * @param {string} componentName - Component name (e.g., 'toolbar', 'tabs')
     * @returns {string} Container selector
     */
    getContainerSelector(componentName) {
        // Check for custom container override
        if (this.options.containers && this.options.containers[componentName]) {
            return this.options.containers[componentName];
        }

        // Default: scope under main container with data attribute
        return `${this.container} [data-debugger-${componentName}]`;
    }

    /**
     * Initialize the application and all controllers
     */
    async initialize() {
        console.log(`[DebuggerApplication:${this.instanceId}] Initializing...`);

        // Set the static eventQueue for BaseDomainController BEFORE creating controller instances
        // This is required for domain controllers to work properly
        // BaseDomainController is loaded via script tag, so access it from window
        if (typeof window !== 'undefined' && window.BaseDomainController) {
            window.BaseDomainController.eventQueue = this.proxy;
        }

        // Initialize proxy controllers (protocol domain controllers)
        this.proxy.initControllers();

        // Create UI controllers with proper dependencies
        // Order matters: create controllers before passing references

        // 1. Toolbar (connection/debug controls)
        this.controllers.toolbar = new ToolbarController({
            eventQueue: this.eventQueue,
            proxy: this.proxy,
            container: this.getContainerSelector('toolbar'),
            instanceId: `${this.instanceId}-toolbar`,
            wsUrl: this.wsUrl
        });

        // 2. Tab System (must be created before ConsoleController)
        this.controllers.tabs = new TabSystemController({
            eventQueue: this.eventQueue,
            proxy: this.proxy,
            container: this.getContainerSelector('tabs'),
            instanceId: `${this.instanceId}-tabs`
        });

        // 3. Console (needs reference to TabSystemController)
        this.controllers.console = new ConsoleController({
            eventQueue: this.eventQueue,
            proxy: this.proxy,
            container: this.getContainerSelector('console'),
            instanceId: `${this.instanceId}-console`,
            tabSystem: this.controllers.tabs
        });

        // 4. File Tree
        this.controllers.fileTree = new FileTreeController({
            eventQueue: this.eventQueue,
            proxy: this.proxy,
            container: this.getContainerSelector('files'),
            instanceId: `${this.instanceId}-files`
        });

        // 5. Call Stack
        this.controllers.callStack = new CallStackController({
            eventQueue: this.eventQueue,
            proxy: this.proxy,
            container: this.getContainerSelector('callstack'),
            instanceId: `${this.instanceId}-callstack`
        });

        // 6. Breakpoints
        this.controllers.breakpoints = new BreakpointController({
            eventQueue: this.eventQueue,
            proxy: this.proxy,
            container: this.getContainerSelector('breakpoints'),
            instanceId: `${this.instanceId}-breakpoints`
        });

        // 7. Watches
        this.controllers.watches = new WatchesController({
            eventQueue: this.eventQueue,
            proxy: this.proxy,
            container: this.getContainerSelector('watches'),
            instanceId: `${this.instanceId}-watches`
        });

        // 8. Scope
        this.controllers.scope = new ScopeController({
            eventQueue: this.eventQueue,
            proxy: this.proxy,
            container: this.getContainerSelector('scope'),
            instanceId: `${this.instanceId}-scope`
        });

        // Wire up cross-controller dependencies
        // FileTreeController needs BreakpointController for breakpoint shortcuts
        this.controllers.fileTree.breakpointController = this.controllers.breakpoints;

        // Initialize all controllers
        await this.controllers.toolbar.initialize();
        await this.controllers.tabs.initialize();
        await this.controllers.console.initialize();
        await this.controllers.fileTree.initialize();
        await this.controllers.callStack.initialize();
        await this.controllers.breakpoints.initialize();
        await this.controllers.watches.initialize();
        await this.controllers.scope.initialize();

        console.log(`[DebuggerApplication:${this.instanceId}] Initialized successfully with all 8 controllers`);

        // Auto-connect if configured
        if (this.options.autoConnect) {
            console.log(`[DebuggerApplication:${this.instanceId}] Auto-connecting...`);
            await this.connect();
        }

        return this;
    }

    /**
     * Connect to the debug target
     */
    async connect() {
        console.log(`[DebuggerApplication:${this.instanceId}] Connecting...`);
        await this.proxy.connect();
    }

    /**
     * Disconnect from the debug target
     */
    disconnect() {
        console.log(`[DebuggerApplication:${this.instanceId}] Disconnecting...`);
        if (this.proxy.ws) {
            this.proxy.ws.close();
        }
    }

    /**
     * Get a specific controller by name
     * @param {string} name - Controller name (e.g., 'toolbar', 'console')
     * @returns {Object|undefined} The controller instance or undefined
     */
    getController(name) {
        return this.controllers[name];
    }

    /**
     * Get the event queue (proxy's queue)
     * @returns {Object} Event queue
     */
    getEventQueue() {
        return this.eventQueue;
    }

    /**
     * Get the proxy
     * @returns {Object} InspectorBrowserProxy instance
     */
    getProxy() {
        return this.proxy;
    }

    /**
     * Destroy the application and cleanup resources
     */
    destroy() {
        console.log(`[DebuggerApplication:${this.instanceId}] Destroying...`);

        // Disconnect if connected
        this.disconnect();

        // TODO: Add controller cleanup when controllers implement destroy()
        // Object.values(this.controllers).forEach(controller => {
        //     if (controller.destroy) {
        //         controller.destroy();
        //     }
        // });

        // Clear references
        this.controllers = {};
        this.proxy = null;
        this.eventQueue = null;

        console.log(`[DebuggerApplication:${this.instanceId}] Destroyed`);
    }
}

export { DebuggerApplication };