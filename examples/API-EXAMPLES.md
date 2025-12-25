# Workspace API Examples

This document shows examples of using the Workspace API to upload/create projects and start debug sessions.

## Table of Contents

1. [Check Workspace Info](#1-check-workspace-info)
2. [Upload Project (ZIP)](#2-upload-project-zip)
3. [Browse Files](#3-browse-files)
4. [Download Files](#4-download-files)
5. [Start Debug Session](#5-start-debug-session)
6. [Stop Debug Session](#6-stop-debug-session)

---

## 1. Check Workspace Info

Perform a handshake to get workspace information and capabilities.

### Request

```bash
curl http://localhost:8080/workspace/info
```

### Response

```json
{
  "workspaceRoot": "/home/user/workspace",
  "exists": true,
  "type": "directory",
  "modified": "2024-01-15T10:30:00.000Z",
  "apiVersion": "1.0",
  "features": {
    "upload": true,
    "download": true,
    "zip": true
  }
}
```

---

## 2. Upload Project (ZIP)

Upload a ZIP file containing your project. The ZIP will be extracted to the specified path.

### Request

```bash
# Upload to workspace root
curl -X POST \
  -H "X-Workspace-API-Key: dev-key-123" \
  -H "Content-Type: application/zip" \
  --data-binary @my-project.zip \
  http://localhost:8080/project/

# Upload to a specific subdirectory
curl -X POST \
  -H "X-Workspace-API-Key: dev-key-123" \
  -H "Content-Type: application/zip" \
  --data-binary @my-project.zip \
  http://localhost:8080/project/my-project
```

### Response

```json
{
  "success": true,
  "message": "ZIP extracted successfully",
  "targetPath": "/home/user/workspace",
  "filesExtracted": 15,
  "totalSize": 45678,
  "files": [
    "index.js",
    "package.json",
    "test/test.js",
    "src/main.js"
  ]
}
```

### Notes

- Requires API key authentication (header: `X-Workspace-API-Key`)
- Content-Type must be `application/zip`
- The ZIP contents will be extracted to the target path
- You can use PUT, POST, or PATCH methods

---

## 3. Browse Files

List files and directories in the workspace.

### Request

```bash
# List root directory
curl http://localhost:8080/project/

# List specific directory
curl http://localhost:8080/project/src

# List with authentication (for consistency)
curl -H "X-Workspace-API-Key: dev-key-123" \
  http://localhost:8080/project/
```

### Response (Directory Listing)

```json
{
  "path": "/",
  "type": "directory",
  "contents": [
    {
      "name": "index.js",
      "type": "file",
      "size": 1234,
      "modified": "2024-01-15T10:30:00.000Z"
    },
    {
      "name": "src",
      "type": "directory",
      "size": 4096,
      "modified": "2024-01-15T10:25:00.000Z"
    },
    {
      "name": "package.json",
      "type": "file",
      "size": 567,
      "modified": "2024-01-15T10:20:00.000Z"
    }
  ]
}
```

---

## 4. Download Files

Download a file or get its contents.

### Request

```bash
# Get file contents (text)
curl http://localhost:8080/project/index.js

# Download file as ZIP
curl -H "Accept: application/zip" \
  http://localhost:8080/project/index.js \
  -o index.js.zip

# Download entire directory as ZIP
curl -H "Accept: application/zip" \
  http://localhost:8080/project/src \
  -o src.zip
```

### Response (File Contents)

```javascript
// Direct file contents
console.log('Hello, World!');
```

---

## 5. Start Debug Session

Start a debug session for a file in the workspace.

### Request

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"file": "test/fixtures/steppable-script.js"}' \
  http://localhost:8080/debug/session
```

### Response

```json
{
  "session": {
    "sessionId": "session-1",
    "targetFile": "test/fixtures/steppable-script.js",
    "wsUrl": "ws://localhost:8888",
    "inspectUrl": "ws://localhost:9229/...",
    "status": "running",
    "pid": 12345,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Connect to WebSocket

After starting a debug session, connect to the WebSocket to control the debugger:

```javascript
const ws = new WebSocket('ws://localhost:8888');

ws.onopen = () => {
  console.log('Connected to debugger');

  // Send Chrome DevTools Protocol commands
  ws.send(JSON.stringify({
    id: 1,
    method: 'Debugger.enable',
    params: {}
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

---

## 6. Stop Debug Session

Stop an active debug session.

### Request

```bash
# Stop by session ID
curl -X DELETE http://localhost:8080/debug/session/session-1

# Or stop the current session
curl -X DELETE http://localhost:8080/debug/session
```

### Response

```json
{
  "success": true,
  "message": "Debug session stopped",
  "sessionId": "session-1"
}
```

---

## Complete Workflow Example

Here's a complete workflow from uploading a project to starting a debug session:

```bash
# 1. Check workspace
curl http://localhost:8080/workspace/info

# 2. Upload your project
curl -X POST \
  -H "X-Workspace-API-Key: dev-key-123" \
  -H "Content-Type: application/zip" \
  --data-binary @my-nodejs-project.zip \
  http://localhost:8080/project/

# 3. Browse uploaded files
curl http://localhost:8080/project/

# 4. Start debugging a file
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"file": "index.js"}' \
  http://localhost:8080/debug/session

# 5. Check server status
curl http://localhost:8080/

# 6. When done, stop the debug session
curl -X DELETE http://localhost:8080/debug/session
```

---

## Interactive Examples

For interactive examples, open these in your browser:

- **Upload Demo**: http://localhost:8080/examples/upload-project-demo.html
- **Workspace Browser**: http://localhost:8080/examples/workspace-browser-demo.html
- **Server Status**: http://localhost:8080/

---

## API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/workspace/info` | Get workspace information | No |
| GET | `/project/*` | List directory or download file | No |
| POST/PUT/PATCH | `/project/*` | Upload and extract ZIP | Yes (API Key) |
| POST | `/debug/session` | Start debug session | No |
| DELETE | `/debug/session/:id` | Stop debug session | No |
| GET | `/health` | Server health check | No |
| GET | `/` | Server status page | No |

---

## Notes

- **Authentication**: Write operations (upload) require an API key via the `X-Workspace-API-Key` header
- **Default API Key**: `dev-key-123` (for development only)
- **Workspace Root**: Configured via `WORKSPACE_ROOT` environment variable or defaults to current directory
- **File Paths**: All file paths are relative to the workspace root
- **Security**: Path traversal attacks are prevented - you cannot access files outside the workspace root