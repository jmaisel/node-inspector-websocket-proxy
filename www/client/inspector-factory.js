// ============================================================================
// inspector-factory.js
// Factory for creating inspector controllers
// ============================================================================

/**
 * Factory for creating domain-specific Chrome DevTools Protocol controllers
 * @namespace controllerFactory
 */
const controllerFactory = {
    /**
     * Creates a Runtime domain controller
     * @param {WebSocket} wsConnection - WebSocket connection to the inspector
     * @returns {RuntimeController} Runtime controller instance
     */
    createRuntime: (wsConnection) => new RuntimeController(wsConnection),

    /**
     * Creates a Debugger domain controller
     * @param {WebSocket} wsConnection - WebSocket connection to the inspector
     * @returns {DebuggerController} Debugger controller instance
     */
    createDebugger: (wsConnection) => new DebuggerController(wsConnection),

    /**
     * Creates a Console domain controller
     * @param {WebSocket} wsConnection - WebSocket connection to the inspector
     * @returns {ConsoleController} Console controller instance
     */
    createConsole: (wsConnection) => new ConsoleController(wsConnection),

    /**
     * Creates a Profiler domain controller
     * @param {WebSocket} wsConnection - WebSocket connection to the inspector
     * @returns {ProfilerController} Profiler controller instance
     */
    createProfiler: (wsConnection) => new ProfilerController(wsConnection),

    /**
     * Creates a HeapProfiler domain controller
     * @param {WebSocket} wsConnection - WebSocket connection to the inspector
     * @returns {HeapProfilerController} HeapProfiler controller instance
     */
    createHeapProfiler: (wsConnection) => new HeapProfilerController(wsConnection),

    /**
     * Creates a Schema domain controller
     * @param {WebSocket} wsConnection - WebSocket connection to the inspector
     * @returns {SchemaController} Schema controller instance
     */
    createSchema: (wsConnection) => new SchemaController(wsConnection)
};
