/**
 * ToolbarController - Simple event-driven toolbar
 *
 * Responsibilities:
 * - Render toolbar from template (with TemplateRegistry override support)
 * - Subscribe to connection events for UI updates
 * - Call proxy methods directly for connection/debug actions
 */

import { TemplateRegistry } from '../core/TemplateRegistry.js';
import { toolbarTemplate } from '../templates/toolbar-template.js';

export class ToolbarController {
    constructor(config = {}) {
        this.eventQueue = config.eventQueue;
        this.proxy = config.proxy;  // Direct reference to InspectorBrowserProxy
        this.container = config.container || '#toolbar-dock-zone';  // Changed from dockZone
        this.wsUrl = config.wsUrl || 'ws://localhost:8888';
        this.instanceId = config.instanceId || 'toolbar-' + Date.now();  // Accept from parent

        // State
        this.isConnected = false;
        this.isPaused = false;

        console.log('[ToolbarController] Created');
    }

    /**
     * Initialize - render and setup
     */
    async initialize() {
        console.log('[ToolbarController] Initializing...');

        // Render the template
        this.render();

        // Setup event handlers
        this.setupDOMEventHandlers();

        // Subscribe to queue events for UI updates
        this.subscribeToEvents();

        console.log('[ToolbarController] Initialized');
    }

    /**
     * Render toolbar from template (with TemplateRegistry override support)
     */
    render() {
        // Check TemplateRegistry first, fall back to default template
        const templateFn = TemplateRegistry.get('toolbar') || toolbarTemplate;

        const html = templateFn({
            wsUrl: this.wsUrl,
            iconSize: 'medium',
            showDebugControls: false,
            showConnectionControls: true,
            showRedockBtn: false
        }, {}, this.instanceId);

        // Append to container
        $(this.container).html(html);

        console.log('[ToolbarController] Rendered to', this.container);
    }

    /**
     * Setup DOM event handlers (button clicks)
     */
    setupDOMEventHandlers() {
        // Connection controls
        $(`#${this.instanceId}-connect-btn`).on('click', () => {
            console.log('[ToolbarController] Connect clicked');
            this.handleConnect();
        });

        $(`#${this.instanceId}-disconnect-btn`).on('click', () => {
            console.log('[ToolbarController] Disconnect clicked');
            this.handleDisconnect();
        });

        // Debug controls
        $(`#${this.instanceId}-pause-btn`).on('click', () => {
            console.log('[ToolbarController] Pause clicked');
            this.handlePause();
        });

        $(`#${this.instanceId}-resume-btn`).on('click', () => {
            console.log('[ToolbarController] Resume clicked');
            this.handleResume();
        });

        $(`#${this.instanceId}-step-over-btn`).on('click', () => {
            console.log('[ToolbarController] Step over clicked');
            this.handleStepOver();
        });

        $(`#${this.instanceId}-step-into-btn`).on('click', () => {
            console.log('[ToolbarController] Step into clicked');
            this.handleStepInto();
        });

        $(`#${this.instanceId}-step-out-btn`).on('click', () => {
            console.log('[ToolbarController] Step out clicked');
            this.handleStepOut();
        });

        console.log('[ToolbarController] DOM event handlers setup');
    }

    /**
     * Subscribe to events on the queue for UI updates
     */
    subscribeToEvents() {
        // WebSocket lifecycle events from the proxy
        this.eventQueue.subscribe('WebSocket.open', () => {
            console.log('[ToolbarController] WebSocket opened - enabling domains...');
            this.showConnecting();

            // Controllers are already initialized in DebuggerApplication.initialize()
            // Now just enable the protocol domains (Console, Runtime, Debugger)
            this.proxy.enable().then(() => {
                console.log('[ToolbarController] Proxy ready');
                this.isConnected = true;
                this.showDebugControls();
            }).catch(err => {
                console.error('[ToolbarController] Enable failed:', err);
                this.showConnectionControls();
                alert('Connection failed: ' + err.message);
            });
        });

        this.eventQueue.subscribe('WebSocket.close', () => {
            console.log('[ToolbarController] WebSocket closed');
            this.isConnected = false;
            this.showConnectionControls();
        });

        this.eventQueue.subscribe('WebSocket.error', (topic, data) => {
            console.error('[ToolbarController] WebSocket error:', data);
            this.showConnectionControls();
            alert('Connection error');
        });

        // Debugger pause state changes
        this.eventQueue.subscribe('Debugger.paused', () => {
            console.log('[ToolbarController] Debugger paused');
            this.isPaused = true;
            this.updateDebugButtons();
        });

        this.eventQueue.subscribe('Debugger.resumed', () => {
            console.log('[ToolbarController] Debugger resumed');
            this.isPaused = false;
            this.updateDebugButtons();
        });

        console.log('[ToolbarController] Subscribed to queue events');
    }

    /**
     * Handle connect - call proxy.connect()
     */
    async handleConnect() {
        try {
            console.log('[ToolbarController] Connecting to proxy...');
            this.showConnecting();
            await this.proxy.connect();
        } catch (error) {
            console.error('[ToolbarController] Connect failed:', error);
            this.showConnectionControls();
            alert('Connection failed: ' + error.message);
        }
    }

    /**
     * Handle disconnect - close WebSocket
     */
    handleDisconnect() {
        console.log('[ToolbarController] Disconnecting...');
        if (this.proxy.ws) {
            this.proxy.ws.close();
        }
    }

    /**
     * Handle pause - call debugger controller
     */
    handlePause() {
        if (this.proxy.debuggerController) {
            console.log('[ToolbarController] Calling debugger.pause()');
            this.proxy.debuggerController.pause();
        }
    }

    /**
     * Handle resume - call debugger controller
     */
    handleResume() {
        if (this.proxy.debuggerController) {
            console.log('[ToolbarController] Calling debugger.resume()');
            this.proxy.debuggerController.resume();
        }
    }

    /**
     * Handle step over
     */
    handleStepOver() {
        if (this.proxy.debuggerController) {
            console.log('[ToolbarController] Calling debugger.stepOver()');
            this.proxy.debuggerController.stepOver();
        }
    }

    /**
     * Handle step into
     */
    handleStepInto() {
        if (this.proxy.debuggerController) {
            console.log('[ToolbarController] Calling debugger.stepInto()');
            this.proxy.debuggerController.stepInto();
        }
    }

    /**
     * Handle step out
     */
    handleStepOut() {
        if (this.proxy.debuggerController) {
            console.log('[ToolbarController] Calling debugger.stepOut()');
            this.proxy.debuggerController.stepOut();
        }
    }

    /**
     * Show connection controls, hide debug controls
     */
    showConnectionControls() {
        $(`#${this.instanceId}-connection-controls`).show();
        $(`#${this.instanceId}-debug-controls`).hide();
        $(`#${this.instanceId}-connect-btn`).prop('disabled', false).find('.btn-label').text('Connect');
    }

    /**
     * Show debug controls, hide connection controls
     */
    showDebugControls() {
        $(`#${this.instanceId}-connection-controls`).hide();
        $(`#${this.instanceId}-debug-controls`).show();
        this.updateDebugButtons();
    }

    /**
     * Show connecting state (disable connect button)
     */
    showConnecting() {
        $(`#${this.instanceId}-connect-btn`).prop('disabled', true).find('.btn-label').text('Connecting...');
    }

    /**
     * Update debug button states based on pause state
     */
    updateDebugButtons() {
        if (this.isPaused) {
            // When paused: enable resume and step buttons, disable pause
            $(`#${this.instanceId}-pause-btn`).prop('disabled', true);
            $(`#${this.instanceId}-resume-btn`).prop('disabled', false);
            $(`#${this.instanceId}-step-over-btn`).prop('disabled', false);
            $(`#${this.instanceId}-step-into-btn`).prop('disabled', false);
            $(`#${this.instanceId}-step-out-btn`).prop('disabled', false);
        } else {
            // When running: enable pause, disable resume and step buttons
            $(`#${this.instanceId}-pause-btn`).prop('disabled', false);
            $(`#${this.instanceId}-resume-btn`).prop('disabled', true);
            $(`#${this.instanceId}-step-over-btn`).prop('disabled', true);
            $(`#${this.instanceId}-step-into-btn`).prop('disabled', true);
            $(`#${this.instanceId}-step-out-btn`).prop('disabled', true);
        }
    }
}