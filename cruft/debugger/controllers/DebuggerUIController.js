import { BaseUIController } from './BaseUIController.js';

/**
 * DebuggerUIController - Manages debugger connection, control, and protocol events
 */
export class DebuggerUIController extends BaseUIController {
    constructor() {
        super();
        this.client = null;
        this.isPaused = false;
        this.scriptMap = new Map(); // scriptId -> url mapping
        this.currentCallFrames = [];
    }

    /**
     * Update connection status display
     * @param {string} text - Status text
     * @param {string} state - Status state ('connected', 'paused', 'disconnected')
     */
    updateStatus(text, state) {
        $('#statusText').text(text);
        $('#statusIndicator').removeClass('connected paused').addClass(state);
    }

    /**
     * Update debug control button states based on pause status
     */
    updateControls() {
        $('#pauseBtn').prop('disabled', this.isPaused);
        $('#resumeBtn, #stepOverBtn, #stepIntoBtn, #stepOutBtn').prop('disabled', !this.isPaused);
    }

    /**
     * Connect to the debugger
     */
    async connect() {
        try {
            const wsUrl = $('#wsUrl').val();
            log(`Connecting to ${wsUrl}...`, 'info');

            // Initialize the BaseDomainController with the WebSocket URL
            const eventQueue = BaseDomainController.initialize(wsUrl);

            // Subscribe to connection lifecycle events
            eventQueue.queue.subscribe('WebSocket.close', () => {
                log('Connection closed', 'error');
                this.updateStatus('Disconnected', 'disconnected');
                $('#debugControls').hide();
                $('#connectionControls').show();
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
                    log('Proxy ready', 'info');
                    resolve();
                });

                eventQueue.queue.subscribe('WebSocket.error', (topic, data) => {
                    clearTimeout(timeoutId);
                    reject(new Error('Connection failed'));
                });
            });

            log('Connected successfully', 'info');
            this.updateStatus('Connected', 'connected');

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

            // Setup protocol event handlers
            this.setupProtocolEvents();

            // Enable debugger and runtime
            await this.client.console.enable();
            await this.client.debugger.enable();
            await this.client.runtime.enable();

            // Activate breakpoints (required for breakpoints to work)
            await this.client.debugger.setBreakpointsActive(true);
            log('Breakpoints activated', 'info');

            // Update UI after successful connection and enable
            log('Debugger enabled', 'info');
            $('#connectionControls').hide();
            $('#debugControls').show();
            this.updateControls();

        } catch (error) {
            log(`Connection error: ${error.message}`, 'error');
            this.updateStatus('Connection Failed', 'disconnected');
        }
    }

    /**
     * Disconnect from the debugger
     */
    disconnect() {
        if (this.client) {
            this.client.disconnect();
            this.client = null;
        }

        this.isPaused = false;
        this.currentCallFrames = [];
        this.scriptMap.clear();

        $('#debugControls').hide();
        $('#connectionControls').show();

        // Clear console using controller
        if (consoleController) {
            consoleController.clearConsole();
        }

        // Clear file tree
        $('#projectFiles').empty();
        $('#dependencies').empty();
        $('#devDependencies').empty();
        $('#nodeInternalFiles').empty();

        this.updateStatus('Disconnected', 'disconnected');

        // Clear call stack (uses global function for now)
        if (window.renderCallStack) {
            window.renderCallStack([]);
        }
    }

    /**
     * Setup protocol event handlers
     */
    setupProtocolEvents() {
        // Debugger events
        this.client.debugger.on('Debugger.paused', async (event) => {
            console.log('Debugger.paused event:', event);
            console.log('Call frames received:', event.callFrames?.length);

            log(`Paused: ${event.reason}`, 'event');
            this.isPaused = true;
            this.currentCallFrames = event.callFrames || [];
            this.updateStatus('Paused', 'paused');
            this.updateControls();

            // Switch to Call Stack tab to show where we paused
            $('.tab-btn[data-tab="callstack"]').click();

            // Render call stack (uses global function for now)
            if (window.renderCallStack) {
                await window.renderCallStack(event.callFrames);
            }
        });

        this.client.debugger.on('Debugger.resumed', () => {
            log('Resumed execution', 'event');
            this.isPaused = false;
            this.currentCallFrames = [];
            this.updateStatus('Running', 'connected');
            this.updateControls();

            // Clear call stack and scope
            if (window.renderCallStack) {
                window.renderCallStack([]);
            }
            $('#scopeVariables').html('<div class="empty-state">No scope information available</div>');
        });

        var that = this;
        this.client.debugger.on('Debugger.scriptParsed', function(event){
            // Store scriptId -> url mapping
            if (event.scriptId && event.url) {
                that.scriptMap.set(event.scriptId, event.url);
            }

            // Add to file tree
            if (event.scriptId && event.url && fileTreeController) {
                fileTreeController.addScriptToFileTree(event.scriptId, event.url);
            }

            // Log non-node_modules scripts
            if (event.url && !event.url.includes('node_modules')) {
                log(`Script parsed: ${event.url}`, 'info');
            }
        });

        this.client.debugger.on('Debugger.breakpointResolved', (event) => {
            log(`Breakpoint resolved: ${event.breakpointId} at line ${event.location.lineNumber}`, 'info');
            console.log('Breakpoint resolved event:', event);

            // Update breakpoint controller if available
            if (window.breakpointController) {
                window.breakpointController.handleBreakpointResolved(event);
            }
        });

        // Runtime events
        this.client.runtime.on('Runtime.consoleAPICalled', (event) => {
            const args = event.args?.map(arg => arg.value ?? arg.description).join(' ') || '';
            log(`console.${event.type}: ${args}`, event.type === 'error' ? 'error' : 'info');
        });

        this.client.runtime.on('Runtime.exceptionThrown', (event) => {
            const msg = event.exceptionDetails?.exception?.description || 'Unknown error';
            log(`Exception: ${msg}`, 'error');
        });
    }

    /**
     * Pause debugger execution
     */
    pause() {
        if (this.client) {
            this.client.debugger.pause();
        }
    }

    /**
     * Resume debugger execution
     */
    resume() {
        if (this.client) {
            this.client.debugger.resume();
        }
    }

    /**
     * Step over current line
     */
    stepOver() {
        if (this.client) {
            this.client.debugger.stepOver();
            $('.tab-btn[data-tab="callstack"]').click();
        }
    }

    /**
     * Step into function call
     */
    stepInto() {
        if (this.client) {
            this.client.debugger.stepInto();
            $('.tab-btn[data-tab="callstack"]').click();
        }
    }

    /**
     * Step out of current function
     */
    stepOut() {
        if (this.client) {
            this.client.debugger.stepOut();
            $('.tab-btn[data-tab="callstack"]').click();
        }
    }

    /**
     * Setup event handlers for debugger controls
     */
    setupEventHandlers() {
        // Connection handlers
        $('#connectBtn').click(() => this.connect());
        $('#disconnectBtn').click(() => this.disconnect());

        // Control button handlers
        $('#pauseBtn').click(() => this.pause());
        $('#resumeBtn').click(() => this.resume());
        $('#stepOverBtn').click(() => this.stepOver());
        $('#stepIntoBtn').click(() => this.stepInto());
        $('#stepOutBtn').click(() => this.stepOut());
    }

    /**
     * Initialize the debugger controller
     */
    initialize() {
        this.setupEventHandlers();
    }
}