# ConnectionManager

A dockable widget for managing WebSocket connections to the Chrome DevTools Protocol proxy.

## Features

- **Simple UI**: Toolbar with a single Connect/Disconnect button
- **Visual Status**: Color-coded connection status indicator (disconnected, connecting, connected, error)
- **Auto-Enable Domains**: Automatically enables Console, Runtime, and Debugger domains on connection
- **Event-Driven**: Built on EventEmitter for easy integration
- **Dockable**: Extends DockableWidget for flexible positioning
- **WebSocket Management**: Handles connection lifecycle and error states

## Usage

### Basic Setup

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="dbg/connection-manager.css">
</head>
<body>
  <div id="connection-manager"></div>

  <!-- Dependencies -->
  <script src="client/regex-pubsub.js"></script>
  <script src="client/inspector-constants.js"></script>
  <script src="client/inspector-browser-proxy.js"></script>
  <script src="client/inspector-controllers.js"></script>
  <script src="dbg/DockableWidget.js"></script>
  <script src="dbg/connection-manager.js"></script>

  <script>
    // Initialize
    const manager = new ConnectionManager('#connection-manager', {
      wsUrl: 'ws://localhost:8888',
      autoEnable: true
    });

    // Listen for events
    manager.on('connected', (data) => {
      console.log('Connected!', data.proxy);
    });
  </script>
</body>
</html>
```

### Constructor Options

```javascript
new ConnectionManager(element, options)
```

**Parameters:**
- `element` (string|HTMLElement): CSS selector or DOM element
- `options` (Object):
  - `wsUrl` (string): WebSocket URL (default: `'ws://localhost:8888'`)
  - `autoEnable` (boolean): Auto-enable Console/Runtime/Debugger domains (default: `true`)
  - `savePosition` (boolean): Persist widget position (default: `true`)
  - `containerId` (string): Container ID for docking (inherited from DockableWidget)
  - `dragHandle` (string): CSS selector for drag handle (inherited from DockableWidget)

### Events

The ConnectionManager emits the following events:

#### `connected`
Fired when connection is established and domains are enabled.

```javascript
manager.on('connected', (data) => {
  console.log('Proxy instance:', data.proxy);
});
```

#### `disconnected`
Fired when the WebSocket connection closes.

```javascript
manager.on('disconnected', () => {
  console.log('Disconnected from server');
});
```

#### `error`
Fired when a connection or domain enable error occurs.

```javascript
manager.on('error', (data) => {
  console.error('Error:', data.error);
});
```

### Methods

#### `connect()`
Establishes WebSocket connection and enables domains.

```javascript
await manager.connect();
```

#### `disconnect()`
Closes the WebSocket connection.

```javascript
await manager.disconnect();
```

#### `getProxy()`
Returns the InspectorBrowserProxy instance.

```javascript
const proxy = manager.getProxy();
if (proxy) {
  // Access controllers
  proxy.consoleController.on('Console.messageAdded', handleMessage);
  proxy.runtimeController.evaluate('2 + 2');
  proxy.debuggerController.pause();
}
```

#### `getConnectionState()`
Returns current connection state.

```javascript
const state = manager.getConnectionState();
// Returns: { isConnected: boolean, state: string, wsUrl: string }
```

### Complete Example

```javascript
// Initialize with custom options
const manager = new ConnectionManager('#connection-manager', {
  wsUrl: 'ws://localhost:9229',
  autoEnable: true,
  savePosition: false
});

// Handle connection success
manager.on('connected', async () => {
  const proxy = manager.getProxy();

  // Listen for console output
  proxy.runtimeController.on('Runtime.consoleAPICalled', (params) => {
    const args = params.args.map(arg => arg.value || arg.description);
    console.log(`[Target] ${params.type}:`, ...args);
  });

  // Listen for script events
  proxy.debuggerController.on('Debugger.scriptParsed', (params) => {
    console.log('Script loaded:', params.url);
  });

  // Evaluate code in target
  try {
    const result = await proxy.runtimeController.evaluate('Math.PI');
    console.log('Result:', result.result.value);
  } catch (error) {
    console.error('Evaluation failed:', error);
  }
});

// Handle disconnection
manager.on('disconnected', () => {
  console.log('Disconnected - attempting reconnect in 5s...');
  setTimeout(() => manager.connect(), 5000);
});

// Handle errors
manager.on('error', (data) => {
  console.error('Connection error:', data.error);
});

// Make available in console for debugging
window.manager = manager;
```

## Connection Flow

1. **User clicks "Connect"**
   - `connect()` method called
   - Status changes to "connecting"
   - InspectorBrowserProxy initialized (if not already)
   - WebSocket connection established

2. **WebSocket.open event received**
   - Status remains "connecting"
   - `onProxyReady()` called
   - Console, Runtime, and Debugger domains enabled (if autoEnable is true)

3. **Domains enabled successfully**
   - Status changes to "connected"
   - `connected` event emitted
   - Button changes to "Disconnect"

4. **User clicks "Disconnect"** (or connection closes)
   - WebSocket closed
   - Status changes to "disconnected"
   - `disconnected` event emitted
   - Button changes to "Connect"

## Status Indicator States

| State | Color | Description |
|-------|-------|-------------|
| `disconnected` | Gray | Not connected to server |
| `connecting` | Orange (pulsing) | Establishing connection |
| `connected` | Green (glowing) | Connected and ready |
| `error` | Red (glowing) | Connection or domain error |

## Integration with DockableWidget

Since ConnectionManager extends DockableWidget, it inherits all docking functionality:

```javascript
// Create with drag handle
const manager = new ConnectionManager('#connection-manager', {
  dragHandle: '.connection-toolbar',
  containerId: 'main-container'
});

// Undock programmatically
manager.undock();

// Dock programmatically
manager.dock();

// Toggle dock state
manager.toggle();
```

## Styling

The ConnectionManager uses `connection-manager.css` for styling. You can customize the appearance by:

1. **Using CSS variables** (if you extend the stylesheet)
2. **Adding custom classes** via options
3. **Overriding styles** in your own stylesheet

### Theme Variants

```html
<!-- Dark theme (default) -->
<div id="manager1"></div>

<!-- Light theme (requires custom CSS) -->
<div id="manager2" class="theme-light"></div>

<!-- Compact variant -->
<div id="manager3" class="compact"></div>
```

## Dependencies

Required files (in load order):
1. `client/regex-pubsub.js` - Event pub/sub system
2. `client/inspector-constants.js` - Protocol constants & EventEmitter
3. `client/inspector-browser-proxy.js` - WebSocket proxy
4. `client/inspector-controllers.js` - Domain controllers
5. `dbg/DockableWidget.js` - Base dockable widget class
6. `dbg/connection-manager.js` - ConnectionManager class
7. `dbg/connection-manager.css` - Styles (optional but recommended)

## Example Files

- **`connection-manager-example.html`** - Standalone demo with event logging

## API Summary

### Constructor
```javascript
new ConnectionManager(element, options)
```

### Methods
```javascript
connect()          // Establish connection
disconnect()       // Close connection
getProxy()         // Get InspectorBrowserProxy instance
getConnectionState() // Get current state
destroy()          // Cleanup and destroy
```

### Events
```javascript
'connected'   // Connection ready with domains enabled
'disconnected' // Connection closed
'error'        // Connection or domain error
```

### Inherited from DockableWidget
```javascript
dock()         // Dock to container
undock()       // Undock (float)
toggle()       // Toggle dock state
setContainer() // Change dock container
```

## License

Part of the debugger-wrapper project.