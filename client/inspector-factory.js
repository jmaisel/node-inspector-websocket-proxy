// ============================================================================
// inspector-factory.js
// Factory for creating inspector controllers
// ============================================================================

// Controller factory for creating domain-specific controllers
const controllerFactory = {
    createRuntime: (wsConnection) => new RuntimeController(wsConnection),
    createDebugger: (wsConnection) => new DebuggerController(wsConnection),
    createConsole: (wsConnection) => new ConsoleController(wsConnection),
    createProfiler: (wsConnection) => new ProfilerController(wsConnection),
    createHeapProfiler: (wsConnection) => new HeapProfilerController(wsConnection),
    createSchema: (wsConnection) => new SchemaController(wsConnection)
};
