// const EventEmitter = require('events');

// const {
//     RUNTIME_COMMANDS,
//     RUNTIME_EVENTS,
//     DEBUGGER_COMMANDS,
//     DEBUGGER_EVENTS,
//     CONSOLE_COMMANDS,
//     CONSOLE_EVENTS,
//     PROFILER_COMMANDS,
//     PROFILER_EVENTS,
//     HEAP_PROFILER_COMMANDS,
//     HEAP_PROFILER_EVENTS,
//     SCHEMA_COMMANDS
// } = require('./inspector-constants');

// Shared ID generator for all controllers
let globalCommandId = 1;

// ============================================================================
// Abstract Base Controller
// ============================================================================

/**
 * Base class for Chrome DevTools Protocol domain controllers
 * Handles command sending, response handling, and event routing
 * @extends EventEmitter
 */
class BaseDomainController extends EventEmitter {
    /**
     * Creates a base domain controller
     * @param {WebSocket} wsConnection - WebSocket connection to the inspector
     * @param {string} domain - Protocol domain name (e.g., 'Runtime', 'Debugger')
     * @param {Object} commandConstants - Command constants for this domain
     * @param {Object} eventConstants - Event constants for this domain
     */
    constructor(wsConnection, domain, commandConstants, eventConstants) {
        super();
        this.ws = wsConnection;
        this.domain = domain;
        this.commandConstants = commandConstants;
        this.eventConstants = eventConstants;
        this.pendingCommands = new Map();
    }

    /**
     * Generates a unique numeric command ID using shared global counter
     * @returns {number} Unique command ID
     * @private
     */
    generateId() {
        return globalCommandId++;
    }

    /**
     * Sends a command to the inspector and returns a promise
     * @param {string} method - Method name (without domain prefix)
     * @param {Object} [params={}] - Method parameters
     * @returns {Promise} Resolves with command result or rejects on error/timeout
     */
    send(method, params = {}) {
        const id = this.generateId();
        const command = JSON.stringify({ id, method: `${this.domain}.${method}`, params });

        return new Promise((resolve, reject) => {

            this.pendingCommands.set(id, { resolve, reject, method : `${this.domain}.${method}` });

            if (this.ws && this.ws.readyState === 1) {
                console.log("sending command:", command);
                this.ws.send(command);
            } else {
                reject(new Error('WebSocket not connected'));
            }
        });
    }

    /**
     * Routes incoming messages to appropriate handlers
     * Handles both command responses and domain events
     * @param {Object} message - Incoming WebSocket message
     */
    handleMessage(message) {

        // console.log('handleMessage', message);

        const { id, method, result, params, error } = message;

        // Handle command responses (check if this controller has a pending command with this ID)
        if (id !== undefined && this.pendingCommands.has(id)) {

            console.log("response id:", id, this.pendingCommands.has(id));

            const { resolve, reject, method: commandMethod } = this.pendingCommands.get(id);

            this.pendingCommands.delete(id);

            if (error) {
                reject(new Error(error.message || 'Command failed'));
            } else {
                // Call domain-specific response handler if it exists
                const spec  = commandMethod.split(".");
                const category = spec[0];
                const eventName = spec[1];
                const handlerName = `handle${this.toPascalCase(eventName)}Response`;

                console.log(`trying to call handler ${handlerName} in ${this.domain} with id ${id}`, message);

                const processedResult = this[handlerName] ? this[handlerName](result) : result;
                console.log("emitting", spec, processedResult, id);
                this.emit(method, processedResult);
                resolve(processedResult);
            }
        }

        // Handle events (method matches our domain)
        if (method && method.startsWith(`${this.domain}.`)) {
            const spec  = method.split(".");
            const category = spec[0];
            const eventName = spec[1];
            const handlerName = `handle${this.toPascalCase(eventName)}Event`;
            console.log(`calling method handler for category ${category} method ${method}`);
            console.log("emitting", method);

            // Call domain-specific event handler if it exists, then emit
            if (this[handlerName]) {
                const processedEvent = this[handlerName](params);
                this.emit(method, processedEvent);
            } else {
                this.emit(method, params);
            }
        }
    }

    /**
     * Converts string to PascalCase
     * @param {string} str - String to convert
     * @returns {string} PascalCase string
     * @private
     */
    toPascalCase(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Gets list of all available commands for this domain
     * @returns {string[]} Array of command names
     */
    getCommandList() {
        return Object.values(this.commandConstants);
    }

    /**
     * Gets list of all available events for this domain
     * @returns {string[]} Array of event names
     */
    getEventList() {
        return Object.values(this.eventConstants);
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
     * @param {WebSocket} wsConnection - WebSocket connection to the inspector
     */
    constructor(wsConnection) {
        super(wsConnection, 'Runtime', RUNTIME_COMMANDS, RUNTIME_EVENTS);
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

    // Response Handlers
    handleEnableResponse(result) {
        return { success: true };
    }

    handleEvaluateResponse(result) {
        return {
            success: !result.exceptionDetails,
            result: result.result,
            value: result.result?.value,
            type: result.result?.type,
            objectId: result.result?.objectId,
            exception: result.exceptionDetails
        };
    }

    handleGetPropertiesResponse(result) {
        return {
            properties: result.result.map(prop => ({
                name: prop.name,
                value: prop.value?.value,
                type: prop.value?.type,
                objectId: prop.value?.objectId,
                writable: prop.writable,
                configurable: prop.configurable,
                enumerable: prop.enumerable
            })),
            internalProperties: result.internalProperties || []
        };
    }

    handleCallFunctionOnResponse(result) {
        return {
            success: !result.exceptionDetails,
            result: result.result,
            value: result.result?.value,
            exception: result.exceptionDetails
        };
    }

    handleGetHeapUsageResponse(result) {
        return {
            usedSize: result.usedSize,
            totalSize: result.totalSize
        };
    }

    handleCompileScriptResponse(result) {
        return {
            scriptId: result.scriptId,
            exceptionDetails: result.exceptionDetails
        };
    }

    handleRunScriptResponse(result) {
        return {
            result: result.result,
            exceptionDetails: result.exceptionDetails
        };
    }

    // Event Handlers
    handleConsoleAPICalledEvent(params) {
        return {
            type: params.type,
            args: params.args.map(arg => ({
                type: arg.type,
                value: arg.value,
                description: arg.description
            })),
            stackTrace: params.stackTrace,
            timestamp: params.timestamp
        };
    }

    handleExceptionThrownEvent(params) {
        return {
            timestamp: params.timestamp,
            exception: params.exceptionDetails
        };
    }

    handleExceptionRevokedEvent(params) {
        return {
            reason: params.reason,
            exceptionId: params.exceptionId
        };
    }

    handleExecutionContextCreatedEvent(params) {
        return {
            contextId: params.context.id,
            name: params.context.name,
            origin: params.context.origin
        };
    }

    handleExecutionContextDestroyedEvent(params) {
        return {
            executionContextId: params.executionContextId
        };
    }

    handleExecutionContextsClearedEvent(params) {
        return {};
    }

    handleInspectRequestedEvent(params) {
        return {
            object: params.object,
            hints: params.hints
        };
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
     * @param {WebSocket} wsConnection - WebSocket connection to the inspector
     */
    constructor(wsConnection) {
        super(wsConnection, 'Debugger', DEBUGGER_COMMANDS, DEBUGGER_EVENTS);
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

    // Response Handlers
    handleEnableResponse(result) {
        return {
            success: true,
            debuggerId: result.debuggerId
        };
    }

    handleSetBreakpointByUrlResponse(result) {
        return {
            breakpointId: result.breakpointId,
            locations: result.locations.map(loc => ({
                scriptId: loc.scriptId,
                lineNumber: loc.lineNumber,
                columnNumber: loc.columnNumber
            }))
        };
    }

    handleSetBreakpointResponse(result) {
        return {
            breakpointId: result.breakpointId,
            actualLocation: result.actualLocation
        };
    }

    handleGetScriptSourceResponse(result) {
        return {
            scriptSource: result.scriptSource,
            bytecode: result.bytecode
        };
    }

    handleSetScriptSourceResponse(result) {
        return {
            success: !result.exceptionDetails,
            callFrames: result.callFrames,
            stackChanged: result.stackChanged,
            exception: result.exceptionDetails
        };
    }

    handleRestartFrameResponse(result) {
        return {
            callFrames: result.callFrames,
            asyncStackTrace: result.asyncStackTrace
        };
    }

    // Event Handlers
    handleScriptParsedEvent(params) {
        return {
            scriptId: params.scriptId,
            url: params.url,
            startLine: params.startLine,
            startColumn: params.startColumn,
            endLine: params.endLine,
            endColumn: params.endColumn,
            executionContextId: params.executionContextId,
            hash: params.hash,
            isModule: params.isModule
        };
    }

    handleScriptFailedToParseEvent(params) {
        return {
            scriptId: params.scriptId,
            url: params.url,
            errorMessage: params.errorMessage
        };
    }

    handlePausedEvent(params) {
        return {
            reason: params.reason,
            data: params.data,
            callFrames: params.callFrames.map(frame => ({
                callFrameId: frame.callFrameId,
                functionName: frame.functionName,
                location: frame.location,
                url: frame.url,
                scopeChain: frame.scopeChain,
                this: frame.this
            })),
            hitBreakpoints: params.hitBreakpoints,
            asyncStackTrace: params.asyncStackTrace
        };
    }

    handleResumedEvent(params) {
        return {};
    }

    handleBreakpointResolvedEvent(params) {
        return {
            breakpointId: params.breakpointId,
            location: params.location
        };
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
     * @param {WebSocket} wsConnection - WebSocket connection to the inspector
     */
    constructor(wsConnection) {
        super(wsConnection, 'Console', CONSOLE_COMMANDS, CONSOLE_EVENTS);
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

    // Response Handlers
    handleEnableResponse(result) {
        return { success: true };
    }

    handleDisableResponse(result) {
        return { success: true };
    }

    handleClearMessagesResponse(result) {
        return { success: true };
    }

    // Event Handlers
    handleMessageAddedEvent(params) {
        return {
            source: params.message.source,
            level: params.message.level,
            text: params.message.text,
            url: params.message.url,
            line: params.message.line,
            column: params.message.column
        };
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
     * @param {WebSocket} wsConnection - WebSocket connection to the inspector
     */
    constructor(wsConnection) {
        super(wsConnection, 'Profiler', PROFILER_COMMANDS, PROFILER_EVENTS);
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

    // Response Handlers
    handleEnableResponse(result) {
        return { success: true };
    }

    handleDisableResponse(result) {
        return { success: true };
    }

    handleStartResponse(result) {
        return { success: true };
    }

    handleStopResponse(result) {
        return {
            profile: {
                nodes: result.profile.nodes,
                startTime: result.profile.startTime,
                endTime: result.profile.endTime,
                samples: result.profile.samples,
                timeDeltas: result.profile.timeDeltas
            }
        };
    }

    handleSetSamplingIntervalResponse(result) {
        return { success: true };
    }

    handleStartPreciseCoverageResponse(result) {
        return {
            timestamp: result.timestamp
        };
    }

    handleStopPreciseCoverageResponse(result) {
        return { success: true };
    }

    handleTakePreciseCoverageResponse(result) {
        return {
            coverage: result.result.map(script => ({
                scriptId: script.scriptId,
                url: script.url,
                functions: script.functions
            })),
            timestamp: result.timestamp
        };
    }

    handleGetBestEffortCoverageResponse(result) {
        return {
            coverage: result.result.map(script => ({
                scriptId: script.scriptId,
                url: script.url,
                functions: script.functions
            }))
        };
    }

    // Event Handlers
    handleConsoleProfileStartedEvent(params) {
        return {
            id: params.id,
            location: params.location,
            title: params.title
        };
    }

    handleConsoleProfileFinishedEvent(params) {
        return {
            id: params.id,
            location: params.location,
            profile: params.profile,
            title: params.title
        };
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
     * @param {WebSocket} wsConnection - WebSocket connection to the inspector
     */
    constructor(wsConnection) {
        super(wsConnection, 'HeapProfiler', HEAP_PROFILER_COMMANDS, HEAP_PROFILER_EVENTS);
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

    // Response Handlers
    handleEnableResponse(result) {
        return { success: true };
    }

    handleDisableResponse(result) {
        return { success: true };
    }

    handleTakeHeapSnapshotResponse(result) {
        return { success: true };
    }

    handleStartTrackingHeapObjectsResponse(result) {
        return { success: true };
    }

    handleStopTrackingHeapObjectsResponse(result) {
        return { success: true };
    }

    handleCollectGarbageResponse(result) {
        return { success: true };
    }

    handleGetObjectByHeapObjectIdResponse(result) {
        return {
            object: result.result
        };
    }

    handleGetHeapObjectIdResponse(result) {
        return {
            heapSnapshotObjectId: result.heapSnapshotObjectId
        };
    }

    handleStartSamplingResponse(result) {
        return { success: true };
    }

    handleStopSamplingResponse(result) {
        return {
            profile: {
                head: result.profile.head,
                samples: result.profile.samples
            }
        };
    }

    handleAddInspectedHeapObjectResponse(result) {
        return { success: true };
    }

    // Event Handlers
    handleAddHeapSnapshotChunkEvent(params) {
        return {
            chunk: params.chunk
        };
    }

    handleHeapStatsUpdateEvent(params) {
        return {
            statsUpdate: params.statsUpdate
        };
    }

    handleLastSeenObjectIdEvent(params) {
        return {
            lastSeenObjectId: params.lastSeenObjectId,
            timestamp: params.timestamp
        };
    }

    handleReportHeapSnapshotProgressEvent(params) {
        return {
            done: params.done,
            total: params.total,
            finished: params.finished
        };
    }

    handleResetProfilesEvent(params) {
        return {};
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
     * @param {WebSocket} wsConnection - WebSocket connection to the inspector
     */
    constructor(wsConnection) {
        super(wsConnection, 'Schema', SCHEMA_COMMANDS, {});
    }

    getDomains() {
        return this.send(SCHEMA_COMMANDS.GET_DOMAINS);
    }

    // Response Handlers
    handleGetDomainsResponse(result) {
        return {
            domains: result.domains.map(domain => ({
                name: domain.name,
                version: domain.version
            }))
        };
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