# Debugger v2 - Simplified Event-Driven Architecture

A clean, event-driven debugger that uses InspectorBrowserProxy for lifecycle management.

## Architecture

```
DebuggerApplication
├── proxy (InspectorBrowserProxy)
│   ├── queue (RegexPubSub) - THE event queue
│   ├── connect() - manages WebSocket lifecycle
│   ├── initControllers() - creates domain controllers
│   ├── enable() - enables Console/Runtime/Debugger domains
│   └── Controllers: debuggerController, runtimeController, consoleController
└── ToolbarController
    ├── Subscribes: WebSocket.*, Debugger.* events from proxy queue
    ├── Calls: proxy.connect(), proxy.debuggerController.pause(), etc.
    └── Renders: toolbar template

```

## Key Principles

1. **InspectorBrowserProxy is the Boss**: The proxy manages its own lifecycle, has its own queue, creates its own controllers.

2. **Use What Exists**: Don't create new event queues or duplicate proxy functionality - use what InspectorBrowserProxy already provides.

3. **Controllers Subscribe to Events**: Controllers subscribe to the proxy's queue for UI updates (WebSocket.open, Debugger.paused, etc.)

4. **Controllers Call Proxy Methods**: For actions, controllers call proxy methods directly (proxy.connect(), proxy.debuggerController.pause())

5. **Template-Based Rendering**: Controllers render from templates, no complex View architecture.

## Files

### Core
- `core/DebuggerApplication.js` - Creates InspectorBrowserProxy and ToolbarController
- `core/ViewUtils.js` - Utility functions for templates

### Controllers
- `controllers/ToolbarController.js` - Toolbar with connection and debug controls

### Templates
- `templates/toolbar-template.js` - Toolbar HTML template
- `templates/console-template.js` - Console HTML template
- (other templates for future controllers)

### HTML
- `debugger.html` - Main debugger page with event log

## Event Flow

### Connection Flow
1. User clicks "Connect" button
2. ToolbarController calls `proxy.connect()`
3. Proxy creates WebSocket, publishes `WebSocket.open` event
4. ToolbarController receives event, calls `proxy.initControllers()` and `proxy.enable()`
5. ToolbarController updates UI to show debug controls

### Debug Control Flow
1. User clicks "Pause" button
2. ToolbarController calls `proxy.debuggerController.pause()`
3. DebuggerController sends Debugger.pause command via proxy
4. Chrome sends back `Debugger.paused` event
5. Proxy publishes `Debugger.paused` on its queue
6. ToolbarController receives event, updates UI button states

## Adding a New Controller

To add a new controller:

1. Create the controller file in `controllers/`
2. Pass it `eventQueue` (proxy.queue) and `proxy` in constructor
3. Subscribe to events from the queue for UI updates
4. Call proxy methods or proxy controller methods for actions
5. Render from a template in `templates/`
6. Add to DebuggerApplication initialization

Example:

```javascript
class MyController {
    constructor({ eventQueue, proxy }) {
        this.eventQueue = eventQueue;
        this.proxy = proxy;
        this.subscribeToEvents();
    }

    subscribeToEvents() {
        // Subscribe to events for UI updates
        this.eventQueue.subscribe('Debugger.paused', (topic, data) => {
            this.updateUI(data);
        });
    }

    handleAction() {
        // Call proxy methods for actions
        this.proxy.debuggerController.stepOver();
    }
}
```

## What We Removed

- ❌ ConnectionManager (duplicated proxy functionality)
- ❌ Custom event queue (use proxy.queue)
- ❌ BaseView/DockableView complexity (use templates directly)
- ❌ All the old controllers (moved to _old/)

## What We Kept

- ✅ InspectorBrowserProxy (handles everything)
- ✅ Templates (for rendering)
- ✅ Simple controllers that subscribe and call proxy methods