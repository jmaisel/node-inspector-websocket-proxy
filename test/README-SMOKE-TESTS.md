# WebsocketProtocolEventQueue Smoke Tests

These smoke tests simulate actual user debugging sessions to verify the WebsocketProtocolEventQueue works correctly.

## Test Coverage

The tests cover the MVP functionality:

### Basic Connection Tests
- ✅ Connect, enable domains, and disconnect
- ✅ Connect, receive console output from timer, and disconnect

### Pause and Resume Tests
- ✅ Connect, pause, resume, and disconnect
- ✅ Connect, pause, receive console output during pause, resume, and disconnect

### Step Command Tests
- ✅ Connect, pause, stepOver, and disconnect
- ✅ Connect, pause, stepInto, stepOut, and disconnect
- ✅ Connect, pause, execute all step commands in sequence, and disconnect

### Full User Session Tests
- ✅ Complete debugging session: connect, console, pause, step multiple times, resume, disconnect

## Running the Tests

### Quick Start

1. **Start the unified test server** (single command):
   ```bash
   npm start
   # or
   npm run dev
   # or
   node start-server.js
   ```

   This starts BOTH servers:
   - HTTP server on port 8080 (serves test files)
   - WebSocket proxy on port 8888 (debugging protocol)
   - Debug script: `test/fixtures/steppable-script.js`

2. **Open the home page** in your browser:
   ```
   http://localhost:8080
   ```

   This landing page provides links to all tests and tools.

### Run Tests in Browser

**Option 1: Via Home Page**
1. Navigate to `http://localhost:8080`
2. Click "Run Smoke Tests →"

**Option 2: Direct URL**
1. Open `http://localhost:8080/test/websocket-protocol-event-queue-smoke.html`
2. The tests will automatically run and display results using Mocha's HTML reporter
3. Open the browser console (F12) to see detailed test execution logs

### Understanding the Test Output

- **Green checkmarks**: Tests passed
- **Red X**: Tests failed (with error details)
- **Console logs**: Detailed execution flow including:
  - WebSocket connection status
  - Domain enablement
  - Console messages received from the debugged script
  - Pause/resume operations
  - Step command execution
  - Call stack information

## Test Fixture

The tests use `test/fixtures/steppable-script.js` which contains:
- Multiple functions with different call patterns
- Nested function calls (for testing stepInto/stepOut)
- Loops (for testing stepOver)
- Timer-based execution (to allow time for debugging)
- Console output at various points

## Next Steps

After these MVP tests pass, additional test scenarios to add:

- Breakpoint tests (setBreakpoint, removeBreakpoint, conditional breakpoints)
- Watch expression tests
- Variable inspection tests
- Call stack navigation tests
- Script source retrieval tests
- Error handling tests

## Troubleshooting

### "Event timeout" errors
- Make sure the unified server is running: `npm start`
- Check that the test fixture script is executing (you should see console output)
- Increase timeout values if tests are flaky

### "WebSocket connection failed"
- Verify servers are running: `curl http://localhost:8080/health`
- Check for port conflicts: `lsof -i :8888` and `lsof -i :8080`
- Restart the server: Kill all processes and restart with `npm start`

### Port conflicts
If you get "EADDRINUSE" errors:
```bash
# Kill processes on test ports
lsof -ti:8888 | xargs kill -9
lsof -ti:8080 | xargs kill -9
lsof -ti:9229 | xargs kill -9

# Then restart
npm start
```

### Tests hang or don't complete
- Check browser console for JavaScript errors
- Make sure all domains are enabled before sending commands
- Verify the test fixture is running correctly in the server logs
- Check server status: `curl http://localhost:8080/health`