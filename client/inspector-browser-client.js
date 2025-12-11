// ============================================================================
// inspector-browser-client.js
// Browser-specific wrapper for the Chrome DevTools Protocol
// ============================================================================

class InspectorBrowserClient {
    constructor(url, options = {}) {
        this.url    = url;
        this.ws = null;
        this.options = {
            autoReconnect: false || options.autoReconnect,
            reconnectDelay: options.reconnectDelay || 5000,
            onStatusChange: options.onStatusChange || null,
            onLog: options.onLog || null,
            ...options
        };

        // Controller instances (will be initialized when connected)
        this.runtime = null;
        this.debugger = null;
        this.console = null;
        this.profiler = null;
        this.heapProfiler = null;
        this.schema = null;
        this.controllers = [];

        this.breakpoints = new Map(); // url -> Set of line numbers
        this.watches = new Map(); // variable -> expression
    }

    // ========================================================================
    // Connection Management
    // ========================================================================

    connect() {

        console.log("connect()");

        return new Promise((resolve, reject) => {

            console.log("opening WebSocket to", this.url);

            this.ws = new WebSocket(this.url);
            console.log("==>" + this.ws.readyState);

            this.ws.onopen = () => {
                this._updateStatus('Connected', 'green');
                this._log('Connection established to WebSocket.', 'info');

                // Create all controllers using the factory
                this.runtime = controllerFactory.createRuntime(this.ws);
                this.debugger = controllerFactory.createDebugger(this.ws);
                this.console = controllerFactory.createConsole(this.ws);
                this.profiler = controllerFactory.createProfiler(this.ws);
                this.heapProfiler = controllerFactory.createHeapProfiler(this.ws);
                this.schema = controllerFactory.createSchema(this.ws);

                // Store in array for easy iteration
                this.controllers = [
                    this.runtime,
                    this.debugger,
                    this.console,
                    this.profiler,
                    this.heapProfiler,
                    this.schema
                ];

                // Set up event listeners
                this._setupEventListeners();

                // Initialize all controllers
                this._initialize()
                    .then(() => resolve(this))
                    .catch(reject);
            };

            this.ws.onclose = () => {
                this._updateStatus('Disconnected', 'red');
                this._log('Connection closed.', 'error');

                // if (this.options.autoReconnect) {
                //     setTimeout(() => this.connect(), this.options.reconnectDelay);
                // }
            };

            this.ws.onerror = (error) => {
                this._updateStatus('Error', 'red');
                this._log(`WebSocket Error: ${error.message}`, 'error');
                reject(error);
            };

            this.ws.onmessage = (event) => {

                // console.log("onmessage", event);

                try {
                    const message = JSON.parse(event.data);

                    // Route to all controllers
                    this.controllers.forEach(controller => {
                        controller.handleMessage(message);
                    });

                    this._log(`Received: ${event.data.substring(0, 100)}...`, 'received');
                } catch (err) {
                    this._log(`Parse error: ${err.message}`, 'error');
                }
            };
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.runtime = null;
            this.debugger = null;
            this.console = null;
            this.profiler = null;
            this.heapProfiler = null;
            this.schema = null;
            this.controllers = [];
        }
    }

    isConnected() {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    async _initialize() {
        // Enable the main domains we'll be using
        // await this.runtime.enable();
        // await this.debugger.enable();
        // await this.console.enable();

        this._log('Inspector client initialized', 'info');
    }

    // ========================================================================
    // Event Listeners Setup
    // ========================================================================

    _setupEventListeners() {
        // Debugger events
        this.debugger.on('paused', (data) => {
            this._log(`Paused: ${data.reason}`, 'event');
            this.emit('paused', data);
        });

        this.debugger.on('resumed', () => {
            this._log('Resumed', 'event');
            this.emit('resumed');
        });

        this.debugger.on('scriptParsed', (data) => {
            this._log(`Script parsed: ${data.url}`, 'event');
            this.emit('scriptParsed', data);
        });

        this.debugger.on('breakpointResolved', (data) => {
            this._log(`Breakpoint resolved: ${data.breakpointId}`, 'event');
            this.emit('breakpointResolved', data);
        });

        // Runtime events
        this.runtime.on('consoleAPICalled', (data) => {
            this._log(`Console ${data.type}: ${JSON.stringify(data.args)}`, 'console');
            this.emit('console', data);
        });

        this.runtime.on('exceptionThrown', (data) => {
            this._log(`Exception: ${data.exception}`, 'error');
            this.emit('exception', data);
        });

        this.runtime.on('executionContextCreated', (data) => {
            this._log(`Context created: ${data.name}`, 'event');
            this.emit('contextCreated', data);
        });
    }

    // ========================================================================
    // High-Level Debugger API
    // ========================================================================
    // async enable(){
    //     if (!this.debugger) throw new Error('Not connected');
    //     return await this.debugger.enable();
    // }

    // async disable(){
    //     if (!this.debugger) throw new Error('Not connected');
    //     return await this.debugger.enable();
    // }

    // async pause() {
    //     if (!this.debugger) throw new Error('Not connected');
    //     return await this.debugger.pause();
    // }

    // async resume() {
    //     if (!this.debugger) throw new Error('Not connected');
    //     return await this.debugger.resume();
    // }

    async stepOver() {
        if (!this.debugger) throw new Error('Not connected');
        return await this.debugger.stepOver();
    }

    async stepInto() {
        if (!this.debugger) throw new Error('Not connected');
        return await this.debugger.stepInto();
    }

    async stepOut() {
        if (!this.debugger) throw new Error('Not connected');
        return await this.debugger.stepOut();
    }

    async setBreakpoint(url, line, options = {}) {
        if (!this.debugger) throw new Error('Not connected');

        const result = await this.debugger.setBreakpointByUrl(line, url, options);

        // Track breakpoint locally
        if (!this.breakpoints.has(url)) {
            this.breakpoints.set(url, new Set());
        }
        this.breakpoints.get(url).add(line);

        this._log(`Breakpoint set: ${url}:${line}`, 'info');
        return result;
    }

    async clearBreakpoint(breakpointId) {
        if (!this.debugger) throw new Error('Not connected');

        const result = await this.debugger.removeBreakpoint(breakpointId);
        this._log(`Breakpoint cleared: ${breakpointId}`, 'info');
        return result;
    }

    async clearAllBreakpoints() {
        if (!this.debugger) throw new Error('Not connected');

        // This would require tracking breakpoint IDs
        // For now, just clear our local tracking
        this.breakpoints.clear();
        this._log('All breakpoints cleared', 'info');
    }

    async setBreakpointsActive(active = true) {
        if (!this.debugger) throw new Error('Not connected');
        return await this.debugger.setBreakpointsActive(active);
    }

    async setPauseOnExceptions(state = 'none') {
        if (!this.debugger) throw new Error('Not connected');
        return await this.debugger.setPauseOnExceptions(state);
    }

    // ========================================================================
    // Evaluation API
    // ========================================================================

    async evaluate(expression, options = {}) {
        if (!this.runtime) throw new Error('Not connected');

        const result = await this.runtime.evaluate(expression, options);
        this._log(`Evaluated: ${expression} = ${result.value}`, 'info');
        return result;
    }

    async getProperties(objectId, ownProperties = true) {
        if (!this.runtime) throw new Error('Not connected');
        return await this.runtime.getProperties(objectId, ownProperties);
    }

    async getScriptSource(scriptId) {
        if (!this.debugger) throw new Error('Not connected');
        return await this.debugger.getScriptSource(scriptId);
    }

    // ========================================================================
    // Watch Expressions
    // ========================================================================

    async watch(variable, expression = null) {
        const expr = expression || variable;
        this.watches.set(variable, expr);
        this._log(`Watching: ${variable} (${expr})`, 'info');

        // Evaluate immediately if paused
        try {
            const result = await this.eval(expr);
            return result;
        } catch (err) {
            this._log(`Watch evaluation failed: ${err.message}`, 'error');
            return null;
        }
    }

    unwatch(variable) {
        const removed = this.watches.delete(variable);
        if (removed) {
            this._log(`Unwatched: ${variable}`, 'info');
        }
        return removed;
    }

    unwatchAll() {
        const count = this.watches.size;
        this.watches.clear();
        this._log(`Cleared ${count} watch expressions`, 'info');
    }

    async evaluateWatches() {
        const results = {};

        for (const [variable, expression] of this.watches.entries()) {
            try {
                const result = await this.eval(expression);
                results[variable] = result;
            } catch (err) {
                results[variable] = { error: err.message };
            }
        }

        return results;
    }

    // ========================================================================
    // Console API
    // ========================================================================

    async clearConsole() {
        if (!this.console) throw new Error('Not connected');
        return await this.console.clearMessages();
    }

    // ========================================================================
    // Profiling API
    // ========================================================================

    async startProfiling() {
        if (!this.profiler) throw new Error('Not connected');
        await this.profiler.enable();
        return await this.profiler.start();
    }

    async stopProfiling() {
        if (!this.profiler) throw new Error('Not connected');
        return await this.profiler.stop();
    }

    async takeHeapSnapshot() {
        if (!this.heapProfiler) throw new Error('Not connected');
        await this.heapProfiler.enable();
        return await this.heapProfiler.takeHeapSnapshot();
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    _updateStatus(text, color) {
        if (this.options.onStatusChange) {
            this.options.onStatusChange(text, color);
        }
    }

    _log(message, type = 'info') {
        if (this.options.onLog) {
            this.options.onLog(message, type);
        }
    }

    // Simple event emitter pattern
    on(event, handler) {
        if (!this._eventHandlers) this._eventHandlers = {};
        if (!this._eventHandlers[event]) this._eventHandlers[event] = [];
        this._eventHandlers[event].push(handler);
    }

    off(event, handler) {
        if (!this._eventHandlers || !this._eventHandlers[event]) return;
        this._eventHandlers[event] = this._eventHandlers[event].filter(h => h !== handler);
    }

    emit(event, data) {
        if (!this._eventHandlers || !this._eventHandlers[event]) return;
        this._eventHandlers[event].forEach(handler => {
            try {
                handler(data);
            } catch (err) {
                console.error('Event handler error:', err);
            }
        });
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InspectorBrowserClient;
}