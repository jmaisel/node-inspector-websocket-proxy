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
        this.scriptSources = [];

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

                this.debugger.on("Debugger.scriptParsed", evt => {
                    console.log(evt);
                    this.scriptSources.push(evt);
                })

                resolve(this);
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

    async clearAllBreakpoints() {
        if (!this.debugger) throw new Error('Not connected');

        // This would require tracking breakpoint IDs
        // For now, just clear our local tracking
        this.breakpoints.clear();
        this._log('All breakpoints cleared', 'info');
    }

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

    async clearConsole() {
        if (!this.console) throw new Error('Not connected');
        return await this.console.clearMessages();
    }

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
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InspectorBrowserClient;
}