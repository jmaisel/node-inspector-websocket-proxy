// ============================================================================
// Command Constants
// ============================================================================

// ============================================================================
// Simple EventEmitter for Browser
// ============================================================================

class EventEmitter {
    constructor() {
        this._events = {};
    }

    on(event, listener) {
        if (!this._events[event]) {
            this._events[event] = [];
        }
        this._events[event].push(listener);
        return this;
    }

    off(event, listener) {
        if (!this._events[event]) return this;
        this._events[event] = this._events[event].filter(l => l !== listener);
        return this;
    }

    emit(event, ...args) {
        if (!this._events[event]) return false;
        this._events[event].forEach(listener => {
            try {
                listener(...args);
            } catch (err) {
                console.error('Event listener error:', err);
            }
        });
        return true;
    }

    once(event, listener) {
        const onceWrapper = (...args) => {
            listener(...args);
            this.off(event, onceWrapper);
        };
        this.on(event, onceWrapper);
        return this;
    }

    removeAllListeners(event) {
        if (event) {
            delete this._events[event];
        } else {
            this._events = {};
        }
        return this;
    }
}

// Runtime Domain Commands
const RUNTIME_COMMANDS = {
    ENABLE: 'enable',
    DISABLE: 'disable',
    EVALUATE: 'evaluate',
    GET_PROPERTIES: 'getProperties',
    CALL_FUNCTION_ON: 'callFunctionOn',
    RUN_IF_WAITING_FOR_DEBUGGER: 'runIfWaitingForDebugger',
    RELEASE_OBJECT: 'releaseObject',
    RELEASE_OBJECT_GROUP: 'releaseObjectGroup',
    GET_HEAP_USAGE: 'getHeapUsage',
    COMPILE_SCRIPT: 'compileScript',
    RUN_SCRIPT: 'runScript'
};

const RUNTIME_EVENTS = {
    CONSOLE_API_CALLED: 'consoleAPICalled',
    EXCEPTION_THROWN: 'exceptionThrown',
    EXCEPTION_REVOKED: 'exceptionRevoked',
    EXECUTION_CONTEXT_CREATED: 'executionContextCreated',
    EXECUTION_CONTEXT_DESTROYED: 'executionContextDestroyed',
    EXECUTION_CONTEXTS_CLEARED: 'executionContextsCleared',
    INSPECT_REQUESTED: 'inspectRequested'
};

// Debugger Domain Commands
const DEBUGGER_COMMANDS = {
    ENABLE: 'enable',
    DISABLE: 'disable',
    PAUSE: 'pause',
    RESUME: 'resume',
    STEP_OVER: 'stepOver',
    STEP_INTO: 'stepInto',
    STEP_OUT: 'stepOut',
    SET_BREAKPOINT_BY_URL: 'setBreakpointByUrl',
    SET_BREAKPOINT: 'setBreakpoint',
    REMOVE_BREAKPOINT: 'removeBreakpoint',
    SET_BREAKPOINTS_ACTIVE: 'setBreakpointsActive',
    SET_PAUSE_ON_EXCEPTIONS: 'setPauseOnExceptions',
    GET_SCRIPT_SOURCE: 'getScriptSource',
    CONTINUE_TO_LOCATION: 'continueToLocation',
    SET_VARIABLE_VALUE: 'setVariableValue',
    SET_SCRIPT_SOURCE: 'setScriptSource',
    RESTART_FRAME: 'restartFrame',
    SET_ASYNC_CALL_STACK_DEPTH: 'setAsyncCallStackDepth',
    SET_BLACKBOX_PATTERNS: 'setBlackboxPatterns',
    SET_SKIP_ALL_PAUSES: 'setSkipAllPauses'
};

const DEBUGGER_EVENTS = {
    SCRIPT_PARSED: 'scriptParsed',
    SCRIPT_FAILED_TO_PARSE: 'scriptFailedToParse',
    PAUSED: 'paused',
    RESUMED: 'resumed',
    BREAKPOINT_RESOLVED: 'breakpointResolved'
};

// Console Domain Commands
const CONSOLE_COMMANDS = {
    ENABLE: 'enable',
    DISABLE: 'disable',
    CLEAR_MESSAGES: 'clearMessages'
};

const CONSOLE_EVENTS = {
    MESSAGE_ADDED: 'messageAdded'
};

// Profiler Domain Commands
const PROFILER_COMMANDS = {
    ENABLE: 'enable',
    DISABLE: 'disable',
    START: 'start',
    STOP: 'stop',
    SET_SAMPLING_INTERVAL: 'setSamplingInterval',
    START_PRECISE_COVERAGE: 'startPreciseCoverage',
    STOP_PRECISE_COVERAGE: 'stopPreciseCoverage',
    TAKE_PRECISE_COVERAGE: 'takePreciseCoverage',
    GET_BEST_EFFORT_COVERAGE: 'getBestEffortCoverage'
};

const PROFILER_EVENTS = {
    CONSOLE_PROFILE_STARTED: 'consoleProfileStarted',
    CONSOLE_PROFILE_FINISHED: 'consoleProfileFinished'
};

// HeapProfiler Domain Commands
const HEAP_PROFILER_COMMANDS = {
    ENABLE: 'enable',
    DISABLE: 'disable',
    TAKE_HEAP_SNAPSHOT: 'takeHeapSnapshot',
    START_TRACKING_HEAP_OBJECTS: 'startTrackingHeapObjects',
    STOP_TRACKING_HEAP_OBJECTS: 'stopTrackingHeapObjects',
    COLLECT_GARBAGE: 'collectGarbage',
    GET_OBJECT_BY_HEAP_OBJECT_ID: 'getObjectByHeapObjectId',
    GET_HEAP_OBJECT_ID: 'getHeapObjectId',
    START_SAMPLING: 'startSampling',
    STOP_SAMPLING: 'stopSampling',
    ADD_INSPECTED_HEAP_OBJECT: 'addInspectedHeapObject'
};

const HEAP_PROFILER_EVENTS = {
    ADD_HEAP_SNAPSHOT_CHUNK: 'addHeapSnapshotChunk',
    HEAP_STATS_UPDATE: 'heapStatsUpdate',
    LAST_SEEN_OBJECT_ID: 'lastSeenObjectId',
    REPORT_HEAP_SNAPSHOT_PROGRESS: 'reportHeapSnapshotProgress',
    RESET_PROFILES: 'resetProfiles'
};

// Schema Domain Commands
const SCHEMA_COMMANDS = {
    GET_DOMAINS: 'getDomains'
};

// ============================================================================
// Command Hierarchies (Immutable)
// ============================================================================

// Debugger execution control hierarchy
const DEBUGGER_EXECUTION_COMMANDS = Object.freeze({
    PAUSE: DEBUGGER_COMMANDS.PAUSE,
    RESUME: DEBUGGER_COMMANDS.RESUME,
    STEP_OVER: DEBUGGER_COMMANDS.STEP_OVER,
    STEP_INTO: DEBUGGER_COMMANDS.STEP_INTO,
    STEP_OUT: DEBUGGER_COMMANDS.STEP_OUT,
    CONTINUE_TO_LOCATION: DEBUGGER_COMMANDS.CONTINUE_TO_LOCATION,
    RESTART_FRAME: DEBUGGER_COMMANDS.RESTART_FRAME
});

const DEBUGGER_STEP_COMMANDS = Object.freeze({
    STEP_OVER: DEBUGGER_COMMANDS.STEP_OVER,
    STEP_INTO: DEBUGGER_COMMANDS.STEP_INTO,
    STEP_OUT: DEBUGGER_COMMANDS.STEP_OUT
});

const DEBUGGER_BREAKPOINT_COMMANDS = Object.freeze({
    SET_BREAKPOINT_BY_URL: DEBUGGER_COMMANDS.SET_BREAKPOINT_BY_URL,
    SET_BREAKPOINT: DEBUGGER_COMMANDS.SET_BREAKPOINT,
    REMOVE_BREAKPOINT: DEBUGGER_COMMANDS.REMOVE_BREAKPOINT,
    SET_BREAKPOINTS_ACTIVE: DEBUGGER_COMMANDS.SET_BREAKPOINTS_ACTIVE
});

const DEBUGGER_SCRIPT_COMMANDS = Object.freeze({
    GET_SCRIPT_SOURCE: DEBUGGER_COMMANDS.GET_SCRIPT_SOURCE,
    SET_SCRIPT_SOURCE: DEBUGGER_COMMANDS.SET_SCRIPT_SOURCE
});

// Runtime evaluation hierarchy
const RUNTIME_EVALUATION_COMMANDS = Object.freeze({
    EVALUATE: RUNTIME_COMMANDS.EVALUATE,
    CALL_FUNCTION_ON: RUNTIME_COMMANDS.CALL_FUNCTION_ON,
    COMPILE_SCRIPT: RUNTIME_COMMANDS.COMPILE_SCRIPT,
    RUN_SCRIPT: RUNTIME_COMMANDS.RUN_SCRIPT
});

const RUNTIME_OBJECT_COMMANDS = Object.freeze({
    GET_PROPERTIES: RUNTIME_COMMANDS.GET_PROPERTIES,
    RELEASE_OBJECT: RUNTIME_COMMANDS.RELEASE_OBJECT,
    RELEASE_OBJECT_GROUP: RUNTIME_COMMANDS.RELEASE_OBJECT_GROUP
});

// Profiler coverage hierarchy
const PROFILER_COVERAGE_COMMANDS = Object.freeze({
    START_PRECISE_COVERAGE: PROFILER_COMMANDS.START_PRECISE_COVERAGE,
    STOP_PRECISE_COVERAGE: PROFILER_COMMANDS.STOP_PRECISE_COVERAGE,
    TAKE_PRECISE_COVERAGE: PROFILER_COMMANDS.TAKE_PRECISE_COVERAGE,
    GET_BEST_EFFORT_COVERAGE: PROFILER_COMMANDS.GET_BEST_EFFORT_COVERAGE
});

const PROFILER_SAMPLING_COMMANDS = Object.freeze({
    START: PROFILER_COMMANDS.START,
    STOP: PROFILER_COMMANDS.STOP,
    SET_SAMPLING_INTERVAL: PROFILER_COMMANDS.SET_SAMPLING_INTERVAL
});

// HeapProfiler tracking hierarchy
const HEAP_PROFILER_TRACKING_COMMANDS = Object.freeze({
    START_TRACKING_HEAP_OBJECTS: HEAP_PROFILER_COMMANDS.START_TRACKING_HEAP_OBJECTS,
    STOP_TRACKING_HEAP_OBJECTS: HEAP_PROFILER_COMMANDS.STOP_TRACKING_HEAP_OBJECTS
});

const HEAP_PROFILER_SAMPLING_COMMANDS = Object.freeze({
    START_SAMPLING: HEAP_PROFILER_COMMANDS.START_SAMPLING,
    STOP_SAMPLING: HEAP_PROFILER_COMMANDS.STOP_SAMPLING
});

const HEAP_PROFILER_SNAPSHOT_COMMANDS = Object.freeze({
    TAKE_HEAP_SNAPSHOT: HEAP_PROFILER_COMMANDS.TAKE_HEAP_SNAPSHOT,
    ADD_INSPECTED_HEAP_OBJECT: HEAP_PROFILER_COMMANDS.ADD_INSPECTED_HEAP_OBJECT
});

const HEAP_PROFILER_OBJECT_COMMANDS = Object.freeze({
    GET_OBJECT_BY_HEAP_OBJECT_ID: HEAP_PROFILER_COMMANDS.GET_OBJECT_BY_HEAP_OBJECT_ID,
    GET_HEAP_OBJECT_ID: HEAP_PROFILER_COMMANDS.GET_HEAP_OBJECT_ID
});

// ============================================================================
// Domain Registry
// ============================================================================

const DOMAIN_REGISTRY = {
    RUNTIME: {
        name: 'Runtime',
        commands: RUNTIME_COMMANDS,
        events: RUNTIME_EVENTS,
        hierarchies: {
            evaluation: RUNTIME_EVALUATION_COMMANDS,
            objects: RUNTIME_OBJECT_COMMANDS
        }
    },
    DEBUGGER: {
        name: 'Debugger',
        commands: DEBUGGER_COMMANDS,
        events: DEBUGGER_EVENTS,
        hierarchies: {
            execution: DEBUGGER_EXECUTION_COMMANDS,
            stepping: DEBUGGER_STEP_COMMANDS,
            breakpoints: DEBUGGER_BREAKPOINT_COMMANDS,
            scripts: DEBUGGER_SCRIPT_COMMANDS
        }
    },
    CONSOLE: {
        name: 'Console',
        commands: CONSOLE_COMMANDS,
        events: CONSOLE_EVENTS,
        hierarchies: {}
    },
    PROFILER: {
        name: 'Profiler',
        commands: PROFILER_COMMANDS,
        events: PROFILER_EVENTS,
        hierarchies: {
            coverage: PROFILER_COVERAGE_COMMANDS,
            sampling: PROFILER_SAMPLING_COMMANDS
        }
    },
    HEAP_PROFILER: {
        name: 'HeapProfiler',
        commands: HEAP_PROFILER_COMMANDS,
        events: HEAP_PROFILER_EVENTS,
        hierarchies: {
            tracking: HEAP_PROFILER_TRACKING_COMMANDS,
            sampling: HEAP_PROFILER_SAMPLING_COMMANDS,
            snapshots: HEAP_PROFILER_SNAPSHOT_COMMANDS,
            objects: HEAP_PROFILER_OBJECT_COMMANDS
        }
    },
    SCHEMA: {
        name: 'Schema',
        commands: SCHEMA_COMMANDS,
        events: {},
        hierarchies: {}
    }
};

// ============================================================================
// Utility Functions
// ============================================================================

function getAllCommands(domain) {
    return Object.values(DOMAIN_REGISTRY[domain]?.commands || {});
}

function getAllEvents(domain) {
    return Object.values(DOMAIN_REGISTRY[domain]?.events || {});
}

function getCommandHierarchy(domain, hierarchyName) {
    return DOMAIN_REGISTRY[domain]?.hierarchies[hierarchyName] || {};
}

function isValidCommand(domain, command) {
    const commands = DOMAIN_REGISTRY[domain]?.commands;
    return commands ? Object.values(commands).includes(command) : false;
}

function isValidEvent(domain, event) {
    const events = DOMAIN_REGISTRY[domain]?.events;
    return events ? Object.values(events).includes(event) : false;
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
    // Individual domain commands
    RUNTIME_COMMANDS,
    RUNTIME_EVENTS,
    DEBUGGER_COMMANDS,
    DEBUGGER_EVENTS,
    CONSOLE_COMMANDS,
    CONSOLE_EVENTS,
    PROFILER_COMMANDS,
    PROFILER_EVENTS,
    HEAP_PROFILER_COMMANDS,
    HEAP_PROFILER_EVENTS,
    SCHEMA_COMMANDS,

    // Hierarchies (immutable objects)
    DEBUGGER_EXECUTION_COMMANDS,
    DEBUGGER_STEP_COMMANDS,
    DEBUGGER_BREAKPOINT_COMMANDS,
    DEBUGGER_SCRIPT_COMMANDS,
    RUNTIME_EVALUATION_COMMANDS,
    RUNTIME_OBJECT_COMMANDS,
    PROFILER_COVERAGE_COMMANDS,
    PROFILER_SAMPLING_COMMANDS,
    HEAP_PROFILER_TRACKING_COMMANDS,
    HEAP_PROFILER_SAMPLING_COMMANDS,
    HEAP_PROFILER_SNAPSHOT_COMMANDS,
    HEAP_PROFILER_OBJECT_COMMANDS,

    // Registry
    DOMAIN_REGISTRY,

    // Utilities
    getAllCommands,
    getAllEvents,
    getCommandHierarchy,
    isValidCommand,
    isValidEvent
};