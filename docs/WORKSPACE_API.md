# Workspace REST API

A simple REST API for accessing project files and directories. Provides JSON listings and ZIP-based bulk operations for quick state synchronization.

## Quick Start

### Start the Server
```bash
# Set API key (optional, defaults to 'dev-key-123')
export WORKSPACE_API_KEY="your-secret-key"

# Start server
node test-server.js
```

Server will start on:
- HTTP: `http://localhost:8080`
- Workspace API: `http://localhost:8080/project/`

## API Endpoints

### GET /project/

**List directory or download files/directories**

#### List directory as JSON
```bash
curl http://localhost:8080/project/
curl http://localhost:8080/project/src/
```

Response:
```json
{
  "path": "/src",
  "type": "directory",
  "contents": [
    {
      "name": "index.js",
      "type": "file",
      "size": 1234,
      "modified": "2025-12-24T10:30:00Z"
    },
    {
      "name": "utils",
      "type": "directory",
      "modified": "2025-12-23T15:20:00Z"
    }
  ]
}
```

#### Download file
```bash
# Get file contents
curl http://localhost:8080/project/package.json

# Download as ZIP
curl -H "Accept: application/zip" \
  http://localhost:8080/project/package.json \
  -o package.zip
```

#### Download directory as ZIP
```bash
# Download entire workspace
curl -H "Accept: application/zip" \
  http://localhost:8080/project/ \
  -o workspace.zip

# Download subdirectory recursively
curl -H "Accept: application/zip" \
  http://localhost:8080/project/src/ \
  -o src.zip
```

### PUT/POST/PATCH /project/

**Upload and extract ZIP files**

Requires authentication via `X-Workspace-API-Key` header.

```bash
# Create a ZIP file
zip -r changes.zip src/

# Upload and extract to workspace root
curl -X PUT \
  -H "X-Workspace-API-Key: dev-key-123" \
  -H "Content-Type: application/zip" \
  --data-binary @changes.zip \
  http://localhost:8080/project/

# Upload to subdirectory
curl -X PUT \
  -H "X-Workspace-API-Key: dev-key-123" \
  -H "Content-Type: application/zip" \
  --data-binary @src-changes.zip \
  http://localhost:8080/project/src/
```

Response:
```json
{
  "success": true,
  "message": "ZIP extracted successfully",
  "extractedFiles": [...],
  "count": 5,
  "targetPath": "/home/user/project/src"
}
```

## Security

### Authentication
- **Read operations (GET)**: No authentication required
- **Write operations (PUT/POST/PATCH)**: Require API key in header
- **Header**: `X-Workspace-API-Key: <api-key>`

### Path Validation
- All paths are restricted to the workspace directory
- Path traversal attempts (`../..`) are blocked
- Returns 403 Forbidden if path escapes workspace

### HTTP Status Codes
- `200 OK`: Success
- `201 Created`: Resource created
- `400 Bad Request`: Invalid request
- `401 Unauthorized`: Missing authentication
- `403 Forbidden`: Path traversal or invalid auth
- `404 Not Found`: File/directory doesn't exist
- `415 Unsupported Media Type`: Invalid content type
- `500 Internal Server Error`: Server error

## Configuration

### Environment Variables
```bash
# Set custom API key
export WORKSPACE_API_KEY="your-secret-key-here"

# Set custom ports
export HTTP_PORT=8080
export PROXY_PORT=8888
```

### Programmatic Configuration
```javascript
const { UnifiedTestServer } = require('./test-server');

const server = new UnifiedTestServer({
    httpPort: 8080,
    proxyPort: 8888,
    debugScript: './test/fixtures/steppable-script.js'
});

await server.start();
```

## Testing

### Run Test Suite
```bash
node test/workspace-api-test.js
```

### Manual Testing
```bash
# List files
curl http://localhost:8080/project/

# Get file
curl http://localhost:8080/project/package.json

# Download as ZIP
curl -H "Accept: application/zip" \
  http://localhost:8080/project/server/ \
  -o server.zip

# Upload ZIP (authenticated)
curl -X PUT \
  -H "X-Workspace-API-Key: dev-key-123" \
  -H "Content-Type: application/zip" \
  --data-binary @upload.zip \
  http://localhost:8080/project/test/
```

## Use Cases

### Sync Workspace to Remote
```bash
# Download entire workspace
curl -H "Accept: application/zip" \
  http://localhost:8080/project/ \
  -o workspace-backup.zip
```

### Push Changes to Server
```bash
# Zip your changes
zip -r changes.zip src/

# Upload changes
curl -X PUT \
  -H "X-Workspace-API-Key: $WORKSPACE_API_KEY" \
  -H "Content-Type: application/zip" \
  --data-binary @changes.zip \
  http://localhost:8080/project/
```

### Browse Files
```bash
# List root directory
curl http://localhost:8080/project/ | jq

# Navigate into subdirectory
curl http://localhost:8080/project/src/ | jq

# Read specific file
curl http://localhost:8080/project/README.md
```

## Architecture

The Workspace API consists of:

1. **workspace-security.js**: Path validation and workspace boundary enforcement
2. **auth-middleware.js**: API key authentication (extensible to mTLS)
3. **zip-handler.js**: ZIP creation and extraction (streaming)
4. **workspace-api.js**: Express router with REST endpoints

## Future Enhancements

- mTLS certificate authentication
- File watching with WebSocket notifications
- File search by name/content
- Partial file reads (range requests)
- Configurable ignore patterns
