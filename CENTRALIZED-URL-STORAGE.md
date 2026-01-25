# Centralized URL Storage

This document describes the centralized URL management system that allows dynamic configuration of server endpoints.

## Overview

All server URLs (HTTP, WebSocket, GPIO, etc.) are now stored centrally in `application.store` and can be dynamically updated when connecting to different devices. This eliminates hardcoded URLs throughout the codebase.

## Architecture

### 1. Configuration Source
Server configuration is loaded from `server/package.json` under the `server.config` key:
```json
{
  "server.config": {
    "httpPort": 8080,
    "proxyPort": 8888,
    "gpioPort": 8081,
    "inspectPort": 9229
  }
}
```

### 2. Storage in Application Store
During application startup (`www/app/main.js::pageReady()`):
1. Server config is fetched from `/server/package.json`
2. URLs are constructed using `buildServerUrls(serverConfig, hostname)`
3. Stored in `application.store`:
   - `serverConfig` - Raw configuration from package.json
   - `serverUrls` - Constructed URLs object

### 3. URL Structure
The `serverUrls` object contains:
```javascript
{
  hostname: 'localhost',
  httpPort: 8080,
  proxyPort: 8888,
  gpioPort: 8081,
  inspectPort: 9229,

  // Constructed URLs
  httpBase: 'http://localhost:8080',
  proxyWs: 'ws://localhost:8888',
  gpioWs: 'ws://localhost:8081',
  inspectWs: 'ws://localhost:9229',

  // API endpoints
  apiProject: '/api/project',
  apiWorkspace: '/workspace',
  apiDebugSession: '/debug/session'
}
```

## Usage

### Accessing URLs in Components

Use the `APP_CONSTANTS.getServerUrls(application)` helper function:

```javascript
// Example: In a component with access to application context
const serverUrls = APP_CONSTANTS.getServerUrls(this.application);
const apiUrl = `${serverUrls.httpBase}${serverUrls.apiWorkspace}`;
```

### Updated Components

The following files have been updated to use centralized URLs:

1. **www/app/constants.js** - Added `getServerUrls()` helper
2. **www/debugger/api/debugger-api-client.js** - Accepts application context
3. **www/debugger/api/debugger-connection-helper.js** - Uses dynamic GPIO WebSocket URL
4. **www/gpio/gpio-websocket-client.js** - Supports application context
5. **www/project-ui/project-manager.js** - Uses dynamic HTTP base URL
6. **www/editor/ace-controller-v2.js** - Dynamic import of DebuggerUIApplet
7. **www/editor/project-helper.js** - Uses dynamic workspace URL
8. **www/bluetooth/bluetooth-ui-controller.js** - Uses dynamic proxy WebSocket URL
9. **www/debugger/controllers/ToolbarUIController.js** - Uses dynamic WebSocket URL
10. **www/editor/project-ui.js** - Shows dynamic server URL in error messages

### Dynamically Changing Server URLs

To connect to a different device, call `updateServerUrls()`:

```javascript
// In application code
window.application.updateServerUrls('192.168.1.100');

// Or with custom ports
const newConfig = {
  httpPort: 8080,
  proxyPort: 8888,
  gpioPort: 8081,
  inspectPort: 9229
};
window.application.updateServerUrls('192.168.1.100', newConfig);
```

This will:
1. Update `application.store.serverUrls`
2. Publish `server:urls:updated` event
3. Components can subscribe to this event to reconnect

Example subscription:
```javascript
application.sub('server:urls:updated', (event, data) => {
  console.log('Server URLs changed:', data.urls);
  // Reconnect WebSocket, reload API client, etc.
});
```

## Benefits

1. **Single Source of Truth** - Server configuration in one place (package.json)
2. **Dynamic Reconfiguration** - Change server hostname at runtime
3. **No Hardcoded URLs** - All components reference `application.store`
4. **Easy Testing** - Mock server URLs in tests
5. **Multi-Device Support** - Connect to Raspberry Pi, remote servers, etc.

## Backward Compatibility

All components gracefully fall back to default localhost URLs if:
- Application context is not available
- Server config fails to load
- Constants are not loaded

Default fallback URLs:
- HTTP: `http://localhost:8080`
- Proxy WebSocket: `ws://localhost:8888`
- GPIO WebSocket: `ws://localhost:8081`
- Inspector WebSocket: `ws://localhost:9229`

## Migration Guide

To update existing code to use centralized URLs:

### Before:
```javascript
const apiClient = new DebuggerApiClient('http://localhost:8080');
const ws = new WebSocket('ws://localhost:8081');
```

### After:
```javascript
const serverUrls = APP_CONSTANTS.getServerUrls(application);
const apiClient = new DebuggerApiClient(application);
const ws = new WebSocket(serverUrls.gpioWs);
```

## Testing

To test with a different hostname:
1. Start the server on a Raspberry Pi or remote machine
2. In browser console:
   ```javascript
   application.updateServerUrls('raspberrypi.local');
   ```
3. Reconnect components as needed

## Future Enhancements

- Auto-discovery of servers on local network
- Connection profiles (save/load different server configurations)
- UI for changing server connection settings
- WebRTC for peer-to-peer connections