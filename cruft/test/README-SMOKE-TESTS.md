# Debugger Smoke Tests

Comprehensive integration tests for the debugger wrapper system.

## Overview

These smoke tests verify the complete debugging workflow from workspace setup through debug session management to client connection and protocol operations.

## Test Files

- **websocket-protocol-event-queue-smoke.html** - Main smoke test suite with full workflow coverage
- **websocket-smoke-simple.html** - Simple connection tests (legacy)
- **diagnostic-test.html** - Interactive diagnostic tool

## Running the Tests

### Prerequisites

1. Server must be running:
   ```bash
   node start-server.js
   ```

2. Open the smoke tests in a browser:
   ```
   http://localhost:8080/test/websocket-protocol-event-queue-smoke.html
   ```

### What the Tests Do

The smoke tests automatically:

1. **Setup Phase** (before all tests):
   - Copy test fixtures to workspace (`test-fixtures/`)
   - Start a debug session for `steppable-script.js`
   - Wait for debugger to be ready

2. **Test Execution**:
   - Connect to WebSocket proxy
   - Enable Chrome DevTools Protocol domains
   - Test pause/resume operations
   - Test step commands (stepOver, stepInto, stepOut)
   - Test console output capture
   - Verify all protocol commands work correctly

3. **Cleanup Phase** (after all tests):
   - Stop the debug session
   - Release all resources

## Test Suites

### Basic Connection Tests
- Connect, enable domains, and disconnect
- Receive console output

### Pause and Resume Tests
- Pause and resume execution
- Receive console messages during pause
- Verify state transitions

### Step Command Tests
- stepOver - step to next line
- stepInto - step into function calls
- stepOut - step out of current function
- Comprehensive multi-step sequences

### Full User Session Tests
- Complete end-to-end workflow
- Simulates real debugging session
- Tests all operations in sequence

## Test Architecture

```
┌─────────────────────────────────────────┐
│   Smoke Test Page (Browser)             │
│                                          │
│  ┌─────────────────────────────────┐   │
│  │  Setup (before hooks)            │   │
│  │  - Copy test files               │   │
│  │  - Start debug session           │   │
│  └──────────────┬───────────────────┘   │
│                 │                        │
│  ┌──────────────▼───────────────────┐   │
│  │  Test Cases                       │   │
│  │  - Connect to ws://localhost:8888│   │
│  │  - Send CDP commands              │   │
│  │  - Verify responses               │   │
│  └──────────────┬───────────────────┘   │
│                 │                        │
│  ┌──────────────▼───────────────────┐   │
│  │  Cleanup (after hooks)            │   │
│  │  - Stop debug session             │   │
│  └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
                  │
                  │ HTTP/WebSocket
                  ▼
┌─────────────────────────────────────────┐
│   Server (localhost:8080)                │
│                                          │
│  ┌───────────────────────────────────┐  │
│  │  Workspace API                     │  │
│  │  POST /api/projects/copy-test-files│  │
│  └───────────────────────────────────┘  │
│                                          │
│  ┌───────────────────────────────────┐  │
│  │  Debug Session API                 │  │
│  │  POST /debug/session               │  │
│  │  DELETE /debug/session/:id         │  │
│  └───────────────────────────────────┘  │
│                                          │
│  ┌───────────────────────────────────┐  │
│  │  WebSocket Proxy (8888)            │  │
│  │  - Proxies to Node --inspect       │  │
│  │  - Chrome DevTools Protocol        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                  │
                  │ --inspect protocol
                  ▼
┌─────────────────────────────────────────┐
│   Node.js Debug Target                   │
│   steppable-script.js                    │
│   - Running with --inspect               │
│   - Generates console output             │
│   - Loops continuously for testing       │
└─────────────────────────────────────────┘
```

## Key Features

### Automatic Workspace Setup
- Tests no longer require manual setup
- Workspace is created and populated automatically
- Test fixtures copied from `/test` to `/workspace/test-fixtures`

### State Management
- Debug session persists across test cases
- Clean state reset between individual tests
- Proper cleanup after all tests complete

### Error Handling
- Detailed console logging
- Clear error messages
- Timeout handling for async operations

## Test File: steppable-script.js

The test target file runs an infinite loop that:
- Generates console output every 2 seconds
- Calls various functions for testing step operations
- Provides predictable execution for debugging tests

## Troubleshooting

### Tests Fail to Start
- Ensure server is running on port 8080
- Check that workspace directory is writable
- Verify no other debug sessions are active

### Tests Timeout
- Increase timeout in test configuration
- Check network connectivity to localhost
- Verify debug target is running correctly

### Connection Refused
- Confirm WebSocket proxy is on port 8888
- Check that debug session was created successfully
- Verify firewall isn't blocking connections

## Expected Output

When all tests pass, you should see:
- ✓ All test suites passing (green)
- Console logs showing each operation
- Summary statistics at the end
- No error messages in console

Example success output:
```
=== Setting up test environment ===
✓ Debug session ready: session-1
✓ File: test-fixtures/fixtures/steppable-script.js
✓ WebSocket: ws://localhost:8888

=== Starting tests ===
  Basic Connection Tests
    ✓ should connect, enable domains, and disconnect
    ✓ should connect, receive console output, and disconnect

  Pause and Resume Tests
    ✓ should connect, pause, resume, and disconnect
    ✓ should connect, pause, receive console during pause, resume, and disconnect

  Step Command Tests
    ✓ should connect, pause, stepOver, and disconnect
    ✓ should connect, pause, stepInto, stepOut, and disconnect
    ✓ should connect, pause, execute all step commands in sequence, and disconnect

  Full User Session Tests
    ✓ should simulate complete debugging session

  8 passing (35s)

=== Cleaning up test environment ===
✓ Debug session cleaned up
```

## Related Documentation

- `/docs/WORKSPACE_API.md` - Workspace API documentation
- `/docs/LIFECYCLE.md` - Debug session lifecycle
- `/examples/test-debug-workflow.html` - Interactive test workflow
- `/examples/workspace-browser-demo.html` - File browser with debug button