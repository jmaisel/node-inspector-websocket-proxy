// ============================================================================
// Abstract Base Controller
// ============================================================================

/**
 * Base class for Chrome DevTools Protocol domain controllers
 * Handles command sending, response handling, and event routing via static WebsocketProtocolEventQueue
 * @extends EventEmitter
 */
class BaseDomainController extends EventEmitter {
    /**
     * Static WebsocketProtocolEventQueue instance shared by all controllers
     * @static
     * @type {WebsocketProtocolEventQueue}
     */
    static eventQueue = null;

    /**
     * Initializes the static WebSocket connection and event queue
     * Must be called before creating any controller instances
     * @static
     * @param {string} wsUrl - WebSocket URL (e.g., 'ws://localhost:8888')
     * @returns {WebsocketProtocolEventQueue} The initialized event queue
     */
    static initialize(wsUrl) {
        if (BaseDomainController.eventQueue) {
            console.warn('BaseDomainController already initialized. Returning existing event queue.');
            return BaseDomainController.eventQueue;
        }
        BaseDomainController.eventQueue = new WebsocketProtocolEventQueue(wsUrl);
        return BaseDomainController.eventQueue;
    }

    /**
     * Gets the static event queue instance
     * @static
     * @returns {WebsocketProtocolEventQueue} The event queue
     * @throws {Error} If event queue not initialized
     */
    static getEventQueue() {
        if (!BaseDomainController.eventQueue) {
            throw new Error('BaseDomainController not initialized. Call BaseDomainController.initialize(wsUrl) first.');
        }
        return BaseDomainController.eventQueue;
    }

    /**
     * Creates a base domain controller
     * @param {string} domain - Protocol domain name (e.g., 'Runtime', 'Debugger')
     * @param {Object} commandConstants - Command constants for this domain
     * @param {Object} eventConstants - Event constants for this domain
     */
    constructor(domain, commandConstants, eventConstants) {
        super();
        this.domain = domain;
        this.commandConstants = commandConstants;
        this.eventConstants = eventConstants;
    }

    /**
     * Sends a command to the inspector via the static event queue and returns a promise
     * @param {string} method - Method name (without domain prefix)
     * @param {Object} [params={}] - Method parameters
     * @returns {Promise} Resolves with command result or rejects on error/timeout
     */
    send(method, params = {}) {

        console.log("send:", method, params);

        const queue = BaseDomainController.getEventQueue();
        const fullMethod = `${this.domain}.${method}`;

        return new Promise((resolve, reject) => {
            // Send command and get the ID
            const commandId = queue.send(fullMethod, params);

            // Set up timeout
            const timeout = setTimeout(() => {
                queue.queue.unsubscribe(subscriptionId);
                reject(new Error(`Command timeout: ${fullMethod}`));
            }, 30000); // 30 second timeout

            // Subscribe to the response for this specific command ID
            const responsePattern = `^response:${commandId}$`;
            const subscriptionId = queue.queue.subscribe(responsePattern, (topic, message) => {
                // Clear timeout and unsubscribe
                clearTimeout(timeout);
                queue.queue.unsubscribe(subscriptionId);

                if (message.error) {
                    reject(new Error(`${message.error.message} (code: ${message.error.code})`));
                } else {
                    resolve(message.result);
                }
            });
        });
    }

    /**
     * Subscribes to domain events using regex patterns
     * @param {string|RegExp} eventPattern - Event pattern to match (e.g., 'Debugger.paused' or /^Debugger\./)
     * @param {Function} callback - Callback function (topic, message) => void
     * @returns {number} Subscription ID for unsubscribing
     */
    subscribeToEvent(eventPattern, callback) {
        const queue = BaseDomainController.getEventQueue();
        return queue.queue.subscribe(eventPattern, callback);
    }

    /**
     * Unsubscribes from an event
     * @param {number} subscriptionId - The subscription ID returned from subscribeToEvent()
     * @returns {boolean} True if unsubscribed successfully
     */
    unsubscribeFromEvent(subscriptionId) {
        const queue = BaseDomainController.getEventQueue();
        return queue.queue.unsubscribe(subscriptionId);
    }
}

// ============================================================================
// Runtime Controller
// ============================================================================

/**
 * Controller for the Runtime domain
 * Handles JavaScript execution, evaluation, and object inspection
 * @extends BaseDomainController
 */
class RuntimeController extends BaseDomainController {
    /**
     * Creates a Runtime controller
     */
    constructor() {
        super('Runtime', RUNTIME_COMMANDS, RUNTIME_EVENTS);
    }

    enable() {
        return this.send(RUNTIME_COMMANDS.ENABLE);
    }

    disable() {
        return this.send(RUNTIME_COMMANDS.DISABLE);
    }

    evaluate(expression, options = {}) {
        return this.send(RUNTIME_COMMANDS.EVALUATE, {
            expression,
            returnByValue: options.returnByValue !== false,
            awaitPromise: options.awaitPromise || false,
            ...options
        });
    }

    getProperties(objectId, ownProperties = true) {
        return this.send(RUNTIME_COMMANDS.GET_PROPERTIES, {
            objectId,
            ownProperties
        });
    }

    callFunctionOn(objectId, functionDeclaration, args = []) {
        return this.send(RUNTIME_COMMANDS.CALL_FUNCTION_ON, {
            objectId,
            functionDeclaration,
            arguments: args
        });
    }

    runIfWaitingForDebugger() {
        return this.send(RUNTIME_COMMANDS.RUN_IF_WAITING_FOR_DEBUGGER);
    }

    releaseObject(objectId) {
        return this.send(RUNTIME_COMMANDS.RELEASE_OBJECT, { objectId });
    }

    releaseObjectGroup(objectGroup) {
        return this.send(RUNTIME_COMMANDS.RELEASE_OBJECT_GROUP, { objectGroup });
    }

    getHeapUsage() {
        return this.send(RUNTIME_COMMANDS.GET_HEAP_USAGE);
    }

    compileScript(expression, sourceURL, persistScript) {
        return this.send(RUNTIME_COMMANDS.COMPILE_SCRIPT, {
            expression,
            sourceURL,
            persistScript
        });
    }

    runScript(scriptId, executionContextId, options = {}) {
        return this.send(RUNTIME_COMMANDS.RUN_SCRIPT, {
            scriptId,
            executionContextId,
            ...options
        });
    }
}

// ============================================================================
// Debugger Controller
// ============================================================================

/**
 * Controller for the Debugger domain
 * Handles script debugging, breakpoints, stepping, and execution control
 * @extends BaseDomainController
 */
class DebuggerController extends BaseDomainController {
    /**
     * Creates a Debugger controller
     */
    constructor() {
        super('Debugger', DEBUGGER_COMMANDS, DEBUGGER_EVENTS);
    }

    enable() {
        return this.send(DEBUGGER_COMMANDS.ENABLE);
    }

    disable() {
        return this.send(DEBUGGER_COMMANDS.DISABLE);
    }

    pause() {
        return this.send(DEBUGGER_COMMANDS.PAUSE);
    }

    resume() {
        return this.send(DEBUGGER_COMMANDS.RESUME);
    }

    stepOver() {
        return this.send(DEBUGGER_COMMANDS.STEP_OVER);
    }

    stepInto() {
        return this.send(DEBUGGER_COMMANDS.STEP_INTO);
    }

    stepOut() {
        return this.send(DEBUGGER_COMMANDS.STEP_OUT);
    }

    setBreakpointByUrl(lineNumber, url, options = {}) {
        return this.send(DEBUGGER_COMMANDS.SET_BREAKPOINT_BY_URL, {
            lineNumber,
            url,
            columnNumber: options.columnNumber || 0,
            condition: options.condition || ''
        });
    }

    setBreakpoint(location) {
        return this.send(DEBUGGER_COMMANDS.SET_BREAKPOINT, { location });
    }

    removeBreakpoint(breakpointId) {
        return this.send(DEBUGGER_COMMANDS.REMOVE_BREAKPOINT, { breakpointId });
    }

    setBreakpointsActive(active = true) {
        return this.send(DEBUGGER_COMMANDS.SET_BREAKPOINTS_ACTIVE, { active });
    }

    setPauseOnExceptions(state = 'none') {
        return this.send(DEBUGGER_COMMANDS.SET_PAUSE_ON_EXCEPTIONS, { state });
    }

    getScriptSource(scriptId) {
        return this.send(DEBUGGER_COMMANDS.GET_SCRIPT_SOURCE, { scriptId });
    }

    continueToLocation(location) {
        return this.send(DEBUGGER_COMMANDS.CONTINUE_TO_LOCATION, { location });
    }

    setVariableValue(scopeNumber, variableName, newValue, callFrameId) {
        return this.send(DEBUGGER_COMMANDS.SET_VARIABLE_VALUE, {
            scopeNumber,
            variableName,
            newValue,
            callFrameId
        });
    }

    setScriptSource(scriptId, scriptSource) {
        return this.send(DEBUGGER_COMMANDS.SET_SCRIPT_SOURCE, { scriptId, scriptSource });
    }

    restartFrame(callFrameId) {
        return this.send(DEBUGGER_COMMANDS.RESTART_FRAME, { callFrameId });
    }

    setAsyncCallStackDepth(maxDepth) {
        return this.send(DEBUGGER_COMMANDS.SET_ASYNC_CALL_STACK_DEPTH, { maxDepth });
    }

    setBlackboxPatterns(patterns) {
        return this.send(DEBUGGER_COMMANDS.SET_BLACKBOX_PATTERNS, { patterns });
    }

    setSkipAllPauses(skip) {
        return this.send(DEBUGGER_COMMANDS.SET_SKIP_ALL_PAUSES, { skip });
    }
}

// ============================================================================
// Console Controller
// ============================================================================

/**
 * Controller for the Console domain
 * Handles console message collection and clearing
 * @extends BaseDomainController
 */
class ConsoleController extends BaseDomainController {
    /**
     * Creates a Console controller
     */
    constructor() {
        super('Console', CONSOLE_COMMANDS, CONSOLE_EVENTS);
    }

    enable() {
        return this.send(CONSOLE_COMMANDS.ENABLE);
    }

    disable() {
        return this.send(CONSOLE_COMMANDS.DISABLE);
    }

    clearMessages() {
        return this.send(CONSOLE_COMMANDS.CLEAR_MESSAGES);
    }
}

// ============================================================================
// Profiler Controller
// ============================================================================

/**
 * Controller for the Profiler domain
 * Handles CPU profiling and code coverage
 * @extends BaseDomainController
 */
class ProfilerController extends BaseDomainController {
    /**
     * Creates a Profiler controller
     */
    constructor() {
        super('Profiler', PROFILER_COMMANDS, PROFILER_EVENTS);
    }

    enable() {
        return this.send(PROFILER_COMMANDS.ENABLE);
    }

    disable() {
        return this.send(PROFILER_COMMANDS.DISABLE);
    }

    start() {
        return this.send(PROFILER_COMMANDS.START);
    }

    stop() {
        return this.send(PROFILER_COMMANDS.STOP);
    }

    setSamplingInterval(interval) {
        return this.send(PROFILER_COMMANDS.SET_SAMPLING_INTERVAL, { interval });
    }

    startPreciseCoverage(options = {}) {
        return this.send(PROFILER_COMMANDS.START_PRECISE_COVERAGE, {
            callCount: options.callCount || false,
            detailed: options.detailed || false
        });
    }

    stopPreciseCoverage() {
        return this.send(PROFILER_COMMANDS.STOP_PRECISE_COVERAGE);
    }

    takePreciseCoverage() {
        return this.send(PROFILER_COMMANDS.TAKE_PRECISE_COVERAGE);
    }

    getBestEffortCoverage() {
        return this.send(PROFILER_COMMANDS.GET_BEST_EFFORT_COVERAGE);
    }
}

// ============================================================================
// HeapProfiler Controller
// ============================================================================

/**
 * Controller for the HeapProfiler domain
 * Handles heap profiling, memory snapshots, and garbage collection
 * @extends BaseDomainController
 */
class HeapProfilerController extends BaseDomainController {
    /**
     * Creates a HeapProfiler controller
     */
    constructor() {
        super('HeapProfiler', HEAP_PROFILER_COMMANDS, HEAP_PROFILER_EVENTS);
    }

    enable() {
        return this.send(HEAP_PROFILER_COMMANDS.ENABLE);
    }

    disable() {
        return this.send(HEAP_PROFILER_COMMANDS.DISABLE);
    }

    takeHeapSnapshot(reportProgress = true) {
        return this.send(HEAP_PROFILER_COMMANDS.TAKE_HEAP_SNAPSHOT, { reportProgress });
    }

    startTrackingHeapObjects(trackAllocations = false) {
        return this.send(HEAP_PROFILER_COMMANDS.START_TRACKING_HEAP_OBJECTS, { trackAllocations });
    }

    stopTrackingHeapObjects(reportProgress = true) {
        return this.send(HEAP_PROFILER_COMMANDS.STOP_TRACKING_HEAP_OBJECTS, { reportProgress });
    }

    collectGarbage() {
        return this.send(HEAP_PROFILER_COMMANDS.COLLECT_GARBAGE);
    }

    getObjectByHeapObjectId(objectId) {
        return this.send(HEAP_PROFILER_COMMANDS.GET_OBJECT_BY_HEAP_OBJECT_ID, { objectId });
    }

    getHeapObjectId(objectId) {
        return this.send(HEAP_PROFILER_COMMANDS.GET_HEAP_OBJECT_ID, { objectId });
    }

    startSampling(samplingInterval) {
        return this.send(HEAP_PROFILER_COMMANDS.START_SAMPLING, { samplingInterval });
    }

    stopSampling() {
        return this.send(HEAP_PROFILER_COMMANDS.STOP_SAMPLING);
    }

    addInspectedHeapObject(heapObjectId) {
        return this.send(HEAP_PROFILER_COMMANDS.ADD_INSPECTED_HEAP_OBJECT, { heapObjectId });
    }
}

// ============================================================================
// Schema Controller
// ============================================================================

/**
 * Controller for the Schema domain
 * Provides information about the available protocol domains
 * @extends BaseDomainController
 */
class SchemaController extends BaseDomainController {
    /**
     * Creates a Schema controller
     */
    constructor() {
        super('Schema', SCHEMA_COMMANDS, {});
    }

    getDomains() {
        return this.send(SCHEMA_COMMANDS.GET_DOMAINS);
    }
}

// // ============================================================================
// // Exports
// // ============================================================================
// module.exports = {
//     BaseDomainController,
//     RuntimeController,
//     DebuggerController,
//     ConsoleController,
//     ProfilerController,
//     HeapProfilerController,
//     SchemaController
// };