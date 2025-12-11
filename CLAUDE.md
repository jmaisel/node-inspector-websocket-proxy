# Chrome DevTools Protocol Commands Reference

This document maps the WebSocket JSON commands to their corresponding controller functions in the debugger wrapper.

## Command Format

All commands sent over the WebSocket follow this format:

```json
{
  "id": <unique_number>,
  "method": "<Domain>.<command>",
  "params": { ... }
}
```

## Debugger Domain

Controls script execution, breakpoints, and stepping.

| JSON Command | Controller Function | Description | Example Params |
|-------------|-------------------|-------------|----------------|
| `{"id": 1, "method": "Debugger.enable", "params": {}}` | `debugger.enable()` | Enables debugger for the page | `{}` |
| `{"id": 2, "method": "Debugger.disable", "params": {}}` | `debugger.disable()` | Disables debugger | `{}` |
| `{"id": 3, "method": "Debugger.pause", "params": {}}` | `debugger.pause()` | Pauses script execution | `{}` |
| `{"id": 4, "method": "Debugger.resume", "params": {}}` | `debugger.resume()` | Resumes script execution | `{}` |
| `{"id": 5, "method": "Debugger.stepOver", "params": {}}` | `debugger.stepOver()` | Steps over next statement | `{}` |
| `{"id": 6, "method": "Debugger.stepInto", "params": {}}` | `debugger.stepInto()` | Steps into next function call | `{}` |
| `{"id": 7, "method": "Debugger.stepOut", "params": {}}` | `debugger.stepOut()` | Steps out of current function | `{}` |
| `{"id": 8, "method": "Debugger.setBreakpointByUrl", "params": {...}}` | `debugger.setBreakpointByUrl(lineNumber, url, options)` | Sets breakpoint by URL | `{"lineNumber": 10, "url": "file:///script.js", "columnNumber": 0, "condition": ""}` |
| `{"id": 9, "method": "Debugger.setBreakpoint", "params": {...}}` | `debugger.setBreakpoint(location)` | Sets breakpoint by location | `{"location": {"scriptId": "123", "lineNumber": 10}}` |
| `{"id": 10, "method": "Debugger.removeBreakpoint", "params": {...}}` | `debugger.removeBreakpoint(breakpointId)` | Removes a breakpoint | `{"breakpointId": "1:10:0:file.js"}` |
| `{"id": 11, "method": "Debugger.setBreakpointsActive", "params": {...}}` | `debugger.setBreakpointsActive(active)` | Activates/deactivates all breakpoints | `{"active": true}` |
| `{"id": 12, "method": "Debugger.setPauseOnExceptions", "params": {...}}` | `debugger.setPauseOnExceptions(state)` | Sets pause on exceptions mode | `{"state": "none|uncaught|all"}` |
| `{"id": 13, "method": "Debugger.getScriptSource", "params": {...}}` | `debugger.getScriptSource(scriptId)` | Gets source code of a script | `{"scriptId": "123"}` |
| `{"id": 14, "method": "Debugger.continueToLocation", "params": {...}}` | `debugger.continueToLocation(location)` | Continues execution to location | `{"location": {"scriptId": "123", "lineNumber": 20}}` |
| `{"id": 15, "method": "Debugger.setVariableValue", "params": {...}}` | `debugger.setVariableValue(...)` | Sets variable value | `{"scopeNumber": 0, "variableName": "x", "newValue": {"value": 42}, "callFrameId": "..."}` |
| `{"id": 16, "method": "Debugger.setScriptSource", "params": {...}}` | `debugger.setScriptSource(scriptId, source)` | Modifies script source | `{"scriptId": "123", "scriptSource": "console.log('new');"}` |
| `{"id": 17, "method": "Debugger.restartFrame", "params": {...}}` | `debugger.restartFrame(callFrameId)` | Restarts call frame | `{"callFrameId": "frame123"}` |
| `{"id": 18, "method": "Debugger.setAsyncCallStackDepth", "params": {...}}` | `debugger.setAsyncCallStackDepth(depth)` | Sets async stack trace depth | `{"maxDepth": 32}` |
| `{"id": 19, "method": "Debugger.setBlackboxPatterns", "params": {...}}` | `debugger.setBlackboxPatterns(patterns)` | Sets patterns to blackbox | `{"patterns": ["node_modules/**"]}` |
| `{"id": 20, "method": "Debugger.setSkipAllPauses", "params": {...}}` | `debugger.setSkipAllPauses(skip)` | Skips all pauses | `{"skip": false}` |

### Debugger Events

Events that the debugger sends to the client:

| Event Method | Handler | Description |
|-------------|---------|-------------|
| `Debugger.scriptParsed` | `handleScriptParsedEvent` | Fired when script is parsed |
| `Debugger.scriptFailedToParse` | `handleScriptFailedToParseEvent` | Fired when script fails to parse |
| `Debugger.paused` | `handlePausedEvent` | Fired when script execution is paused |
| `Debugger.resumed` | `handleResumedEvent` | Fired when script execution is resumed |
| `Debugger.breakpointResolved` | `handleBreakpointResolvedEvent` | Fired when breakpoint is resolved |

## Runtime Domain

Controls JavaScript runtime, evaluation, and object inspection.

| JSON Command | Controller Function | Description | Example Params |
|-------------|-------------------|-------------|----------------|
| `{"id": 30, "method": "Runtime.enable", "params": {}}` | `runtime.enable()` | Enables runtime events | `{}` |
| `{"id": 31, "method": "Runtime.disable", "params": {}}` | `runtime.disable()` | Disables runtime events | `{}` |
| `{"id": 32, "method": "Runtime.evaluate", "params": {...}}` | `runtime.evaluate(expression, options)` | Evaluates expression | `{"expression": "2+2", "returnByValue": true}` |
| `{"id": 33, "method": "Runtime.getProperties", "params": {...}}` | `runtime.getProperties(objectId, ownProperties)` | Gets object properties | `{"objectId": "obj123", "ownProperties": true}` |
| `{"id": 34, "method": "Runtime.callFunctionOn", "params": {...}}` | `runtime.callFunctionOn(objectId, func, args)` | Calls function on object | `{"objectId": "obj123", "functionDeclaration": "function(){...}"}` |
| `{"id": 35, "method": "Runtime.runIfWaitingForDebugger", "params": {}}` | `runtime.runIfWaitingForDebugger()` | Runs if waiting for debugger | `{}` |
| `{"id": 36, "method": "Runtime.releaseObject", "params": {...}}` | `runtime.releaseObject(objectId)` | Releases remote object | `{"objectId": "obj123"}` |
| `{"id": 37, "method": "Runtime.releaseObjectGroup", "params": {...}}` | `runtime.releaseObjectGroup(group)` | Releases object group | `{"objectGroup": "console"}` |
| `{"id": 38, "method": "Runtime.getHeapUsage", "params": {}}` | `runtime.getHeapUsage()` | Gets heap memory usage | `{}` |
| `{"id": 39, "method": "Runtime.compileScript", "params": {...}}` | `runtime.compileScript(expr, url, persist)` | Compiles script | `{"expression": "...", "sourceURL": "test.js", "persistScript": true}` |
| `{"id": 40, "method": "Runtime.runScript", "params": {...}}` | `runtime.runScript(scriptId, contextId, opts)` | Runs compiled script | `{"scriptId": "123", "executionContextId": 1}` |

### Runtime Events

| Event Method | Handler | Description |
|-------------|---------|-------------|
| `Runtime.consoleAPICalled` | `handleConsoleAPICalledEvent` | Fired when console API is called |
| `Runtime.exceptionThrown` | `handleExceptionThrownEvent` | Fired when exception is thrown |
| `Runtime.exceptionRevoked` | `handleExceptionRevokedEvent` | Fired when exception is revoked |
| `Runtime.executionContextCreated` | `handleExecutionContextCreatedEvent` | Fired when execution context is created |
| `Runtime.executionContextDestroyed` | `handleExecutionContextDestroyedEvent` | Fired when execution context is destroyed |
| `Runtime.executionContextsCleared` | `handleExecutionContextsClearedEvent` | Fired when all contexts are cleared |
| `Runtime.inspectRequested` | `handleInspectRequestedEvent` | Fired when object inspection is requested |

## Console Domain

Controls console message handling.

| JSON Command | Controller Function | Description | Example Params |
|-------------|-------------------|-------------|----------------|
| `{"id": 50, "method": "Console.enable", "params": {}}` | `console.enable()` | Enables console events | `{}` |
| `{"id": 51, "method": "Console.disable", "params": {}}` | `console.disable()` | Disables console events | `{}` |
| `{"id": 52, "method": "Console.clearMessages", "params": {}}` | `console.clearMessages()` | Clears console messages | `{}` |

### Console Events

| Event Method | Handler | Description |
|-------------|---------|-------------|
| `Console.messageAdded` | `handleMessageAddedEvent` | Fired when console message is added |

## Profiler Domain

Controls CPU profiling and code coverage.

| JSON Command | Controller Function | Description | Example Params |
|-------------|-------------------|-------------|----------------|
| `{"id": 60, "method": "Profiler.enable", "params": {}}` | `profiler.enable()` | Enables profiler | `{}` |
| `{"id": 61, "method": "Profiler.disable", "params": {}}` | `profiler.disable()` | Disables profiler | `{}` |
| `{"id": 62, "method": "Profiler.start", "params": {}}` | `profiler.start()` | Starts profiling | `{}` |
| `{"id": 63, "method": "Profiler.stop", "params": {}}` | `profiler.stop()` | Stops profiling | `{}` |
| `{"id": 64, "method": "Profiler.setSamplingInterval", "params": {...}}` | `profiler.setSamplingInterval(interval)` | Sets sampling interval | `{"interval": 1000}` |
| `{"id": 65, "method": "Profiler.startPreciseCoverage", "params": {...}}` | `profiler.startPreciseCoverage(options)` | Starts precise coverage | `{"callCount": true, "detailed": true}` |
| `{"id": 66, "method": "Profiler.stopPreciseCoverage", "params": {}}` | `profiler.stopPreciseCoverage()` | Stops precise coverage | `{}` |
| `{"id": 67, "method": "Profiler.takePreciseCoverage", "params": {}}` | `profiler.takePreciseCoverage()` | Takes coverage snapshot | `{}` |
| `{"id": 68, "method": "Profiler.getBestEffortCoverage", "params": {}}` | `profiler.getBestEffortCoverage()` | Gets best effort coverage | `{}` |

### Profiler Events

| Event Method | Handler | Description |
|-------------|---------|-------------|
| `Profiler.consoleProfileStarted` | `handleConsoleProfileStartedEvent` | Fired when console profile starts |
| `Profiler.consoleProfileFinished` | `handleConsoleProfileFinishedEvent` | Fired when console profile finishes |

## HeapProfiler Domain

Controls heap profiling and memory snapshots.

| JSON Command | Controller Function | Description | Example Params |
|-------------|-------------------|-------------|----------------|
| `{"id": 70, "method": "HeapProfiler.enable", "params": {}}` | `heapProfiler.enable()` | Enables heap profiler | `{}` |
| `{"id": 71, "method": "HeapProfiler.disable", "params": {}}` | `heapProfiler.disable()` | Disables heap profiler | `{}` |
| `{"id": 72, "method": "HeapProfiler.takeHeapSnapshot", "params": {...}}` | `heapProfiler.takeHeapSnapshot(reportProgress)` | Takes heap snapshot | `{"reportProgress": true}` |
| `{"id": 73, "method": "HeapProfiler.startTrackingHeapObjects", "params": {...}}` | `heapProfiler.startTrackingHeapObjects(track)` | Starts tracking heap objects | `{"trackAllocations": true}` |
| `{"id": 74, "method": "HeapProfiler.stopTrackingHeapObjects", "params": {...}}` | `heapProfiler.stopTrackingHeapObjects(report)` | Stops tracking heap objects | `{"reportProgress": true}` |
| `{"id": 75, "method": "HeapProfiler.collectGarbage", "params": {}}` | `heapProfiler.collectGarbage()` | Forces garbage collection | `{}` |
| `{"id": 76, "method": "HeapProfiler.getObjectByHeapObjectId", "params": {...}}` | `heapProfiler.getObjectByHeapObjectId(id)` | Gets object by heap ID | `{"objectId": "heap123"}` |
| `{"id": 77, "method": "HeapProfiler.getHeapObjectId", "params": {...}}` | `heapProfiler.getHeapObjectId(objectId)` | Gets heap ID for object | `{"objectId": "obj123"}` |
| `{"id": 78, "method": "HeapProfiler.startSampling", "params": {...}}` | `heapProfiler.startSampling(interval)` | Starts heap sampling | `{"samplingInterval": 32768}` |
| `{"id": 79, "method": "HeapProfiler.stopSampling", "params": {}}` | `heapProfiler.stopSampling()` | Stops heap sampling | `{}` |
| `{"id": 80, "method": "HeapProfiler.addInspectedHeapObject", "params": {...}}` | `heapProfiler.addInspectedHeapObject(id)` | Adds heap object to inspect | `{"heapObjectId": "heap123"}` |

### HeapProfiler Events

| Event Method | Handler | Description |
|-------------|---------|-------------|
| `HeapProfiler.addHeapSnapshotChunk` | `handleAddHeapSnapshotChunkEvent` | Fired for each snapshot chunk |
| `HeapProfiler.heapStatsUpdate` | `handleHeapStatsUpdateEvent` | Fired when heap stats are updated |
| `HeapProfiler.lastSeenObjectId` | `handleLastSeenObjectIdEvent` | Fired for last seen object ID |
| `HeapProfiler.reportHeapSnapshotProgress` | `handleReportHeapSnapshotProgressEvent` | Reports snapshot progress |
| `HeapProfiler.resetProfiles` | `handleResetProfilesEvent` | Fired when profiles are reset |

## Schema Domain

Provides protocol schema information.

| JSON Command | Controller Function | Description | Example Params |
|-------------|-------------------|-------------|----------------|
| `{"id": 90, "method": "Schema.getDomains", "params": {}}` | `schema.getDomains()` | Gets available protocol domains | `{}` |

## Usage Examples

### Example 1: Enable debugger and set a breakpoint

```javascript
// 1. Enable the debugger
ws.send(JSON.stringify({
  "id": 1,
  "method": "Debugger.enable",
  "params": {}
}));

// 2. Set a breakpoint at line 10 of script.js
ws.send(JSON.stringify({
  "id": 2,
  "method": "Debugger.setBreakpointByUrl",
  "params": {
    "lineNumber": 10,
    "url": "file:///path/to/script.js",
    "columnNumber": 0,
    "condition": ""
  }
}));
```

### Example 2: Evaluate an expression

```javascript
// Enable runtime
ws.send(JSON.stringify({
  "id": 1,
  "method": "Runtime.enable",
  "params": {}
}));

// Evaluate expression
ws.send(JSON.stringify({
  "id": 2,
  "method": "Runtime.evaluate",
  "params": {
    "expression": "console.log('Hello from debugger')",
    "returnByValue": true
  }
}));
```

### Example 3: Step through code

```javascript
// Pause execution
ws.send(JSON.stringify({
  "id": 1,
  "method": "Debugger.pause",
  "params": {}
}));

// Step over
ws.send(JSON.stringify({
  "id": 2,
  "method": "Debugger.stepOver",
  "params": {}
}));

// Resume
ws.send(JSON.stringify({
  "id": 3,
  "method": "Debugger.resume",
  "params": {}
}));
```

## Response Format

Responses from the debugger follow this format:

```json
{
  "id": <matching_request_id>,
  "result": { ... }
}
```

Or for errors:

```json
{
  "id": <matching_request_id>,
  "error": {
    "code": <error_code>,
    "message": "<error_message>"
  }
}
```

## Event Format

Events from the debugger (unsolicited messages) follow this format:

```json
{
  "method": "<Domain>.<event>",
  "params": { ... }
}
```

Note: Events do not have an `id` field, as they are not responses to requests.

## Files

- `debugger-commands.json` - Complete collection of example commands
- `client/inspector-constants.js` - Command and event constant definitions
- `client/inspector-controllers.js` - Controller implementations
- `inspector-proxy-factory.js` - WebSocket proxy server
