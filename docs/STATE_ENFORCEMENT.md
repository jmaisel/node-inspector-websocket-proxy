# State Enforcement

This document explains how state is enforced to prevent debugger connections without an active project/session.

## The Problem (Before)

❌ **Old behavior:**
- Server auto-starts debugger with hardcoded file on boot
- Client can connect to `ws://localhost:8888` anytime
- No workspace context required
- Debugger exists before project is opened

## The Solution (After)

✅ **New behavior:**
- Server starts WITHOUT debugger
- Workspace MUST be opened first
- Debug session MUST be explicitly started for a specific file
- Client CANNOT connect without active session
- State is enforced on BOTH server and client

## State Enforcement Layers

### Layer 1: Server-Side (No WebSocket Server)

When the server starts, **no WebSocket server exists on port 8888**.

```javascript
// Server starts
node test-server.js
// HTTP server: ✓ Running on 8080
// WebSocket: ✗ NOT running (no debugger session)
```

The WebSocket proxy only comes into existence when:
```javascript
POST /debug/session
{
  "file": "/path/to/file.js"
}
```

This creates a `RemoteDebuggerProxyServer` which spawns:
1. Node.js process with `--inspect` flag
2. WebSocket proxy server on port 8888

**Result:** Client cannot connect to `ws://localhost:8888` because it doesn't exist yet.

### Layer 2: Session API Guard

The session API enforces state:

```javascript
GET /debug/session

// If no session:
{
  "error": "No active session",
  "message": "No debug session is currently running"
}
```

Clients should check this BEFORE attempting to connect.

### Layer 3: Client-Side Guard

The `DebuggerClientGuard` class prevents premature connections:

```javascript
const guard = new DebuggerClientGuard('http://localhost:8080');

// This throws if no session exists
const session = await guard.getActiveSession();

// Only connect after session verification
const debugger = new InspectorBrowserProxy(session.wsUrl, {
    sessionGuard: guard
});
await debugger.connect(); // Checks for session first
```

### Layer 4: InspectorBrowserProxy Guard

The `InspectorBrowserProxy` can optionally enforce session checking:

```javascript
const debugger = new InspectorBrowserProxy('ws://localhost:8888', {
    sessionGuard: guard // Optional but recommended
});

await debugger.connect(); // Checks session if guard provided
```

If a guard is provided, `connect()` will:
1. Check for active session via API
2. Throw error if no session
3. Only proceed with WebSocket connection if session exists

## Code Examples

### Enforced Workflow

```javascript
// 1. Create session guard
const guard = new DebuggerClientGuard('http://localhost:8080');

// 2. Try to connect WITHOUT session (WILL FAIL)
try {
    await guard.getActiveSession();
} catch (error) {
    console.log('Cannot connect:', error.message);
    // Error: No active debug session...
}

// 3. Start session for a file
const session = await guard.startSession('/test/my-script.js');
// Session created, WebSocket server now running

// 4. Now connect (WILL SUCCEED)
const debugger = new InspectorBrowserProxy(session.wsUrl, {
    sessionGuard: guard
});
await debugger.connect(); // ✓ Session exists, connection allowed
await debugger.enable();

// 5. Stop session when done
await guard.stopSession();
// WebSocket server stops, can no longer connect
```

### Without Guard (Legacy/Testing)

If you don't provide a guard, connections are allowed without checking:

```javascript
// Old way (no enforcement)
const debugger = new InspectorBrowserProxy('ws://localhost:8888');
await debugger.connect(); // No session check, will fail if no server
```

This is kept for backward compatibility but **not recommended** for production use.

## State Transitions

```
┌─────────────────────────────────────────────────────────┐
│ Server State                                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [STARTED]                                                │
│  ├─ HTTP Server: Running on 8080                        │
│  ├─ Workspace API: Ready                                │
│  ├─ Session API: Ready                                  │
│  └─ WebSocket Proxy: NOT RUNNING ✗                     │
│                                                          │
│         ↓ POST /debug/session                           │
│                                                          │
│ [SESSION ACTIVE]                                         │
│  ├─ HTTP Server: Running                                │
│  ├─ Workspace API: Ready                                │
│  ├─ Session API: Session created                        │
│  └─ WebSocket Proxy: RUNNING on 8888 ✓                 │
│                                                          │
│         ↓ DELETE /debug/session                         │
│                                                          │
│ [STARTED] (back to initial state)                       │
│  └─ WebSocket Proxy: STOPPED ✗                         │
└─────────────────────────────────────────────────────────┘
```

## Client State Checks

### Check 1: Session Exists?
```javascript
const session = await guard.checkSession();
if (!session) {
    console.log('No session - must start one first');
}
```

### Check 2: Get Active Session (Throws if None)
```javascript
try {
    const session = await guard.getActiveSession();
    // Session exists, can proceed
} catch (error) {
    // No session, cannot connect
}
```

### Check 3: Wait for Session
```javascript
// Useful if session is starting asynchronously
const session = await guard.waitForSession(30000); // 30s timeout
```

## Error Messages

### Client Tries to Connect Without Session

```
🔒 Checking for active debug session...
✗ Cannot connect: No active debug session. Start a session first via POST /debug/session or click Debug on a file.
💡 Start a session first via POST /debug/session or click Debug on a file
```

### Server Response When No Session

```json
{
  "error": "No active session",
  "message": "No debug session is currently running"
}
```

## Testing State Enforcement

See the enforced lifecycle demo:

```bash
node test-server.js

# Open in browser
http://localhost:8080/examples/enforced-lifecycle.html
```

The demo shows:
1. ✓ Check session (fails - no session)
2. ✗ Try connect without session (blocked)
3. ✓ Start session
4. ✓ Try connect with session (allowed)
5. ✓ Stop session
6. ✗ Try connect again (blocked)

## Benefits

### 1. **Prevents Invalid State**
Cannot have a debugger running without knowing what project/file it's debugging.

### 2. **Explicit Workflow**
Forces proper lifecycle: Open Project → Browse Files → Debug Specific File

### 3. **Security**
Prevents unauthorized WebSocket connections to debugger port.

### 4. **Clear Errors**
If connection fails, it's clear why: "No active session"

### 5. **Better UX**
User always knows what file is being debugged (shown in session info).

## Migration from Old Code

### Before (Auto-Start)
```javascript
// Server
const server = new UnifiedTestServer({
    debugScript: './some-file.js' // ❌ Hardcoded
});
await server.start(); // Debugger auto-starts

// Client
const debugger = new InspectorBrowserProxy('ws://localhost:8888');
await debugger.connect(); // No checks
```

### After (On-Demand)
```javascript
// Server
const server = new UnifiedTestServer();
await server.start(); // NO debugger yet

// Client
const guard = new DebuggerClientGuard('http://localhost:8080');
const session = await guard.startSession('/path/to/file.js'); // User choice
const debugger = new InspectorBrowserProxy(session.wsUrl, {
    sessionGuard: guard
});
await debugger.connect(); // Verified
```

## Files

### Server-Side
- `server/debugger-session-api.js` - Session management
- `server/session-guard-middleware.js` - Express middleware guard
- `test-server.js` - Updated to NOT auto-start

### Client-Side
- `client/debugger-client-guard.js` - Client-side session checker
- `client/inspector-browser-proxy.js` - Updated to accept session guard

### Examples
- `examples/enforced-lifecycle.html` - Interactive demo
- `examples/lifecycle-demo.html` - Complete workflow demo

## Summary

**State enforcement ensures the debugger only runs when there's an active project context and an explicitly started session for a specific file.**

This prevents the anti-pattern of having a debugger running for a hardcoded file before the user even opens a project.

The enforcement happens at multiple layers:
1. Server doesn't start WebSocket server until session created
2. Session API returns 404 if no session
3. Client guard checks session before connecting
4. InspectorBrowserProxy optionally verifies session

This makes the lifecycle explicit and prevents invalid states.
