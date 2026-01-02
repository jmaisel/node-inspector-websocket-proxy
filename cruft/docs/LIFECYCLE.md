# Complete Debugger Lifecycle

This document describes the proper lifecycle for the workspace and debugger system.

## Core Principle

**Project (Workspace) MUST exist BEFORE debugger session can start.**

The debugger session is explicitly started for a specific file from the workspace, not auto-started on server boot.

## Lifecycle Workflow

```
1. Server Starts
   ↓
2. Client Opens/Creates Project (Workspace Handshake)
   ↓
3. Client Browses Project Files
   ↓
4. User Right-Clicks File → "Debug"
   ↓
5. Client Starts Debug Session via API (for that specific file)
   ↓
6. Debugger Proxy Spawns with Target File
   ↓
7. Client Connects to Debugger WebSocket
   ↓
8. Debugging Happens
   ↓
9. User Stops Session
   ↓
10. Can Debug Different File (back to step 4)
```

## API Endpoints & Flow

### Step 1: Server Start

```bash
node start-workspace-server.js
```

Server starts but **NO debugger is running yet**. This is intentional.

### Step 2: Workspace Handshake

**Client establishes workspace context:**

```javascript
GET /workspace/info
```

Response:
```json
{
  "workspaceRoot": "/home/user/project",
  "exists": true,
  "type": "directory",
  "modified": "2025-12-24T10:00:00Z",
  "apiVersion": "1.0",
  "features": {
    "upload": true,
    "download": true,
    "zip": true
  }
}
```

This handshake:
- Confirms workspace location
- Verifies server and client agree on project directory
- Returns workspace capabilities

### Step 3: Browse Files

**Client lists workspace files:**

```javascript
GET /project/
GET /project/src/
GET /project/src/index.js
```

User navigates the file tree, exploring the project.

### Step 4: User Initiates Debug

**User right-clicks a .js file → "Debug"**

Client UI shows "Debug" action on JavaScript files in the workspace browser.

### Step 5: Start Debug Session

**Client starts debug session via API:**

```javascript
POST /debug/session
Content-Type: application/json

{
  "file": "/src/api-server.js"
}
```

Response:
```json
{
  "success": true,
  "session": {
    "sessionId": "session-1",
    "targetFile": "/src/api-server.js",
    "wsUrl": "ws://localhost:8888",
    "inspectPort": 9229,
    "proxyPort": 8888,
    "status": "running"
  }
}
```

**What happens internally:**
1. API validates file is within workspace (security)
2. Stops any existing session (only one at a time)
3. Creates `RemoteDebuggerProxyServer` with target file
4. Spawns Node.js process: `node --inspect=9229 /full/path/to/file.js`
5. Proxy server starts on port 8888
6. Returns session info to client

### Step 6: Connect to Debugger

**Client connects to debugger WebSocket:**

```javascript
const ws = new WebSocket('ws://localhost:8888');

// Use Chrome DevTools Protocol
ws.send(JSON.stringify({
  id: 1,
  method: 'Debugger.enable',
  params: {}
}));
```

### Step 7: Debug

Client uses CDP commands:
- Set breakpoints
- Step through code
- Inspect variables
- View call stack
- etc.

### Step 8: Stop Session

**When done debugging:**

```javascript
DELETE /debug/session/session-1
```

Or to stop current session:

```javascript
DELETE /debug/session
```

**What happens:**
1. Proxy server stops
2. Node.js process is killed
3. WebSocket closes
4. Session marked as stopped

### Step 9: Debug Different File

User can now right-click a different file and start a new session.

The cycle repeats from step 4.

## Code Examples

### Complete Client Flow

```javascript
// 1. Initialize workspace browser
const browser = new WorkspaceBrowserController({
    apiUrl: 'http://localhost:8080/project',
    containerSelector: '#workspace-browser',
    showDebugAction: true,

    // 2. Workspace handshake happens automatically
    onWorkspaceChange: (info) => {
        console.log('Workspace:', info.workspaceRoot);
    },

    // 3. User clicks "Debug" on a file
    onDebugFile: async (filePath) => {
        // 4. Start debug session
        const response = await fetch('http://localhost:8080/debug/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: filePath })
        });

        const { session } = await response.json();

        // 5. Connect to debugger
        const debugger = BaseDomainController.initialize(session.wsUrl);
        await debugger.enable();

        // 6. Now debugging!
        console.log('Debug session active:', session.sessionId);
    }
});

await browser.initialize();
```

### Stop Session

```javascript
async function stopDebugSession(sessionId) {
    await fetch(`http://localhost:8080/debug/session/${sessionId}`, {
        method: 'DELETE'
    });
    console.log('Session stopped');
}
```

## Important Notes

### 1. No Auto-Start

❌ **Old behavior (WRONG):**
```javascript
// Server starts → Debugger auto-starts with hardcoded file
const server = new UnifiedTestServer({ debugScript: './some-file.js' });
await server.start(); // Debugger starts automatically
```

✅ **New behavior (CORRECT):**
```javascript
// Server starts → NO debugger running
const server = new WorkspaceServer();
await server.start(); // Only HTTP server starts

// Later, client explicitly starts debug session
POST /debug/session { "file": "/path/to/file.js" }
```

### 2. One Session at a Time

Currently, only **one debug session** can be active at a time.

Starting a new session automatically stops the previous one.

### 3. File Must Be in Workspace

The file to debug **MUST** be within the workspace:

✅ Valid:
```json
{ "file": "/src/api-server.js" }
{ "file": "/test/my-test.js" }
```

❌ Invalid (path traversal):
```json
{ "file": "/../../../etc/passwd" }
```

Security layer validates all paths.

### 4. Session State

Get current session status:

```javascript
GET /debug/session

// Response if session active:
{
  "sessionId": "session-1",
  "targetFile": "/src/api-server.js",
  "startedAt": "2025-12-24T10:30:00Z",
  "status": "running",
  "wsUrl": "ws://localhost:8888"
}

// Response if no session:
{
  "error": "No active session",
  "message": "No debug session is currently running"
}
```

### 5. Right-Click Context Menu

To implement "right-click → Debug" in your UI:

```javascript
fileElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    // Show context menu with "Debug" option
    showContextMenu([
        {
            label: '▶️ Debug',
            action: () => startDebugSession(filePath)
        },
        {
            label: '👁️ View',
            action: () => openFile(filePath)
        }
    ]);
});
```

Or use the built-in Debug button in `WorkspaceBrowserController` (shown by default).

## Demo

See it in action:

```bash
# Start server
node start-workspace-server.js

# Open in browser
http://localhost:8080/examples/lifecycle-demo.html
```

The demo shows the complete workflow with visual step indicators.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Client (Browser)                                            │
│                                                              │
│ 1. WorkspaceBrowserController                               │
│    ├─ Handshake: GET /workspace/info                        │
│    ├─ Browse: GET /project/*                                │
│    └─ User clicks "Debug" → onDebugFile(path)              │
│                                                              │
│ 2. Debugger Session Start                                   │
│    └─ POST /debug/session { file: path }                    │
│                                                              │
│ 3. Debugger Connection                                      │
│    └─ WebSocket connect: ws://localhost:8888               │
│                                                              │
│ 4. Chrome DevTools Protocol                                 │
│    └─ Send CDP commands (Debugger.enable, etc.)            │
│                                                              │
│ 5. Stop Session                                             │
│    └─ DELETE /debug/session                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Server (Node.js)                                            │
│                                                              │
│ 1. Workspace API (/project, /workspace)                    │
│    ├─ workspace-security.js (path validation)              │
│    ├─ workspace-api.js (REST endpoints)                     │
│    └─ zip-handler.js (ZIP operations)                       │
│                                                              │
│ 2. Debugger Session API (/debug)                           │
│    ├─ debugger-session-api.js (session management)         │
│    └─ DebuggerSessionManager                                │
│        └─ Manages RemoteDebuggerProxyServer instances       │
│                                                              │
│ 3. RemoteDebuggerProxyServer (created on-demand)           │
│    ├─ Spawns: node --inspect=9229 <target-file>            │
│    ├─ WebSocket Proxy on port 8888                          │
│    └─ Forwards CDP between client and Node inspector       │
└─────────────────────────────────────────────────────────────┘
```

## Summary

The key insight is that **the project comes first**, not the debugger.

The workflow mirrors real development:
1. You open a project
2. You browse files
3. You choose a file to debug
4. You start debugging that file
5. When done, you can debug a different file

This is much more natural than having a debugger session auto-start for a hardcoded file before you even know what you want to debug.
