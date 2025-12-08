const inspector = require('inspector');
const { fork } = require('child_process');

/**
 * Wrapper for Node.js built-in Inspector API
 * Provides a simplified interface for debugging Node.js processes
 */
class InspectorWrapper {
    constructor() {
        this.session = null;
        this.debuggerProcess = null;
        this.debuggerUrl = null;
    }

    /**
     * Opens the inspector on the specified port
     * @param {number} port - Port to bind inspector to (default: 9229)
     * @param {string} host - Host to bind to (default: '127.0.0.1')
     * @param {boolean} wait - Whether to wait for debugger to attach (default: false)
     * @param {object} options - Additional options
     * @param {string} options.script - Path to script to fork and debug
     * @param {boolean} options.breakOnStart - Whether to break on start (default: true)
     * @returns {Promise} Resolves when inspector is opened
     */
    async open(port = 9229, host = '127.0.0.1', wait = false, options = {}) {
        if (options.script) {
            return this._forkDebuggerProcess(port, host, options);
        }

        inspector.open(port, host, wait);
        return Promise.resolve();
    }

    /**
     * Forks a child process for debugging
     * @private
     */
    async _forkDebuggerProcess(port, host, options) {
        if (this.debuggerProcess) {
            throw new Error('Debugger process is already running');
        }

        const breakOnStart = options.breakOnStart !== false;
        const inspectFlag = breakOnStart ? `--inspect-brk=${host}:${port}` : `--inspect=${host}:${port}`;

        this.debuggerProcess = fork(options.script, [], {
            execArgv: [inspectFlag],
            stdio: 'inherit'
        });

        // Wait for the debugger URL to be available
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for debugger URL'));
            }, 5000);

            // The debugger URL can be constructed from the known port
            this.debuggerUrl = `ws://${host}:${port}`;

            // Wait a bit for the process to start
            setTimeout(() => {
                clearTimeout(timeout);
                resolve();
            }, 100);
        });

        // Handle process exit
        this.debuggerProcess.on('exit', (code) => {
            this.debuggerProcess = null;
            this.debuggerUrl = null;
        });

        return Promise.resolve();
    }

    /**
     * Closes the inspector
     */
    close() {
        if (this.session) {
            this.disconnect();
        }

        if (this.debuggerProcess) {
            this.debuggerProcess.kill();
            this.debuggerProcess = null;
            this.debuggerUrl = null;
        }

        if (inspector.url()) {
            inspector.close();
        }
    }

    /**
     * Deletes the inspector (alias for close with process cleanup)
     */
    delete() {
        this.close();
    }

    /**
     * Gets the WebSocket URL for the inspector
     * @returns {string|undefined} WebSocket URL or undefined if not active
     */
    url() {
        if (this.debuggerUrl) {
            return this.debuggerUrl;
        }
        return inspector.url();
    }

    /**
     * Checks if the inspector is active
     * @returns {boolean} True if inspector is active
     */
    isActive() {
        return inspector.url() !== undefined || this.debuggerUrl !== null;
    }

    /**
     * Creates a new inspector session
     * @returns {inspector.Session} The inspector session
     */
    connect() {
        if (this.session) {
            this.disconnect();
        }

        this.session = new inspector.Session();
        this.session.connect();
        return this.session;
    }

    /**
     * Disconnects the current inspector session
     */
    disconnect() {
        if (this.session) {
            try {
                this.session.disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }
            this.session = null;
        }
    }

    /**
     * Posts a command to the inspector session
     * @param {string} method - Inspector protocol method
     * @param {object} params - Method parameters
     * @returns {Promise} Promise that resolves with the result
     */
    post(method, params = {}) {
        if (!this.session) {
            return Promise.reject(new Error('No active session. Call connect() first.'));
        }

        return new Promise((resolve, reject) => {
            this.session.post(method, params, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    /**
     * Gets the forked debugger process
     * @returns {ChildProcess|null} The debugger process or null
     */
    getDebuggerProcess() {
        return this.debuggerProcess;
    }

    // ========================================================================
    // High-Level Debugger Methods
    // ========================================================================

    /**
     * Enables the Debugger domain
     * @returns {Promise}
     */
    enableDebugger() {
        return this.post('Debugger.enable');
    }

    /**
     * Disables the Debugger domain
     * @returns {Promise}
     */
    disableDebugger() {
        return this.post('Debugger.disable');
    }

    /**
     * Sets a breakpoint by URL
     * @param {string} url - URL of the script
     * @param {number} lineNumber - Line number (0-based)
     * @param {number} columnNumber - Column number (optional)
     * @param {string} condition - Breakpoint condition (optional)
     * @returns {Promise}
     */
    setBreakpointByUrl(url, lineNumber, columnNumber, condition) {
        const params = {
            url,
            lineNumber,
            columnNumber: columnNumber || 0,
            condition: condition || ''
        };
        return this.post('Debugger.setBreakpointByUrl', params);
    }

    /**
     * Removes a breakpoint
     * @param {string} breakpointId - Breakpoint ID
     * @returns {Promise}
     */
    removeBreakpoint(breakpointId) {
        return this.post('Debugger.removeBreakpoint', { breakpointId });
    }

    /**
     * Pauses script execution
     * @returns {Promise}
     */
    pause() {
        return this.post('Debugger.pause');
    }

    /**
     * Resumes script execution
     * @param {boolean} terminateOnResume - Whether to terminate on resume
     * @returns {Promise}
     */
    resume(terminateOnResume) {
        const params = terminateOnResume ? { terminateOnResume: true } : {};
        return this.post('Debugger.resume', params);
    }

    /**
     * Steps over to the next line
     * @returns {Promise}
     */
    stepOver() {
        return this.post('Debugger.stepOver');
    }

    /**
     * Steps into a function call
     * @param {boolean} breakOnAsyncCall - Whether to break on async calls
     * @returns {Promise}
     */
    stepInto(breakOnAsyncCall) {
        const params = breakOnAsyncCall ? { breakOnAsyncCall: true } : {};
        return this.post('Debugger.stepInto', params);
    }

    /**
     * Steps out of the current function
     * @returns {Promise}
     */
    stepOut() {
        return this.post('Debugger.stepOut');
    }

    /**
     * Sets pause on exceptions state
     * @param {string} state - 'none', 'uncaught', or 'all'
     * @returns {Promise}
     */
    setPauseOnExceptions(state) {
        return this.post('Debugger.setPauseOnExceptions', { state });
    }

    /**
     * Gets possible breakpoints
     * @param {object} start - Start location
     * @returns {Promise}
     */
    getPossibleBreakpoints(start) {
        return this.post('Debugger.getPossibleBreakpoints', { start });
    }

    /**
     * Evaluates expression on a call frame
     * @param {string} expression - Expression to evaluate
     * @param {string} callFrameId - Call frame ID
     * @returns {Promise}
     */
    evaluateOnCallFrame(expression, callFrameId) {
        return this.post('Debugger.evaluateOnCallFrame', { expression, callFrameId });
    }

    /**
     * Sets variable value
     * @param {number} scopeNumber - Scope number
     * @param {string} variableName - Variable name
     * @param {object} newValue - New value
     * @param {string} callFrameId - Call frame ID
     * @returns {Promise}
     */
    setVariableValue(scopeNumber, variableName, newValue, callFrameId) {
        return this.post('Debugger.setVariableValue', {
            scopeNumber,
            variableName,
            newValue,
            callFrameId
        });
    }

    /**
     * Restarts a frame
     * @param {string} callFrameId - Call frame ID
     * @returns {Promise}
     */
    restartFrame(callFrameId) {
        return this.post('Debugger.restartFrame', { callFrameId });
    }

    // ========================================================================
    // Runtime Methods
    // ========================================================================

    /**
     * Enables the Runtime domain
     * @returns {Promise}
     */
    enableRuntime() {
        return this.post('Runtime.enable');
    }

    /**
     * Disables the Runtime domain
     * @returns {Promise}
     */
    disableRuntime() {
        return this.post('Runtime.disable');
    }

    /**
     * Evaluates an expression
     * @param {string} expression - Expression to evaluate
     * @param {object} options - Evaluation options
     * @returns {Promise}
     */
    evaluate(expression, options = {}) {
        return this.post('Runtime.evaluate', {
            expression,
            ...options
        });
    }

    /**
     * Gets object properties
     * @param {string} objectId - Object ID
     * @param {boolean} ownProperties - Whether to get only own properties
     * @returns {Promise}
     */
    getProperties(objectId, ownProperties = true) {
        return this.post('Runtime.getProperties', {
            objectId,
            ownProperties
        });
    }

    /**
     * Calls a function on an object
     * @param {string} functionDeclaration - Function declaration
     * @param {string} objectId - Object ID
     * @param {array} args - Function arguments
     * @returns {Promise}
     */
    callFunctionOn(functionDeclaration, objectId, args = []) {
        return this.post('Runtime.callFunctionOn', {
            functionDeclaration,
            objectId,
            arguments: args
        });
    }
}

module.exports = InspectorWrapper;
