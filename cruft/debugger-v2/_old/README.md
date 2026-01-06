# Debugger v2 - View-Based Architecture

A modular, embeddable debugger UI with dynamic HTML generation. All components can be used independently in third-party applications.

## Features

- **View-Based Architecture**: Views generate their own HTML from templates
- **Template Override System**: Customize HTML structure via global registry
- **Modular Components**: Each component can be mounted independently
- **Element Maps**: Access DOM elements via logical names with jQuery selectors
- **Dockable Components**: Toolbar and Console support docking/undocking
- **No Hardcoded HTML**: Everything generated dynamically with unique IDs

## Architecture

```
debugger-v2/
├── core/               # Core infrastructure
│   ├── BaseView.js     # Abstract base class for all views
│   ├── DockableView.js # Base for dockable views (toolbar, console)
│   ├── TemplateRegistry.js  # Global template override registry
│   └── ViewUtils.js    # Shared utilities
├── views/              # View classes (DOM generation)
├── templates/          # Default HTML templates
├── controllers/        # Business logic controllers
├── main.js            # Complete application entry point
├── index.js           # Public API exports
└── debugger.html      # Minimal HTML shell

```

## Quick Start

### Full Application

Open `debugger.html` in a browser. The complete debugger UI will initialize automatically.

### Embedding Individual Components

```javascript
import { ConsoleView, ToolbarView } from './debugger-v2/index.js';

// Mount console to your container
const consoleView = new ConsoleView({
    container: '#my-console-area',
    initialState: { mode: 'standalone' }
});

await consoleView.mount();

// Add log entries
consoleView.addLogEntry({
    message: 'Application started',
    type: 'info',
    timestamp: new Date().toLocaleTimeString()
});

// Access elements
const elements = consoleView.getElementMap();
console.log('Search input:', elements.searchInput); // DOM element
```

## Template Override System

### Register Custom Templates

```javascript
import { TemplateRegistry } from './debugger-v2/core/TemplateRegistry.js';

// Register BEFORE creating view
TemplateRegistry.register('toolbar', (data, config, instanceId) => {
    return `
        <div id="${instanceId}" class="my-custom-toolbar">
            <input id="${instanceId}-ws-url" value="${data.wsUrl}">
            <button id="${instanceId}-connect-btn">Connect</button>
            <!-- Must include ALL elements from element map -->
        </div>
    `;
});

// Now create view with custom template
const toolbarView = new ToolbarView({ container: '#my-area' });
await toolbarView.mount();
```

### Template Contract

Templates MUST:
1. Include all elements defined in view's `defineElementMap()`
2. Use correct element IDs: `${instanceId}-{suffix}`
3. Return valid HTML string
4. Accept parameters: `(data, config, instanceId)`

## Element Maps

Each view provides an element map with two modes:

**Before Mount (Selectors):**
```javascript
const elements = view.getElementMap();
// { container: '#toolbar-abc123', connectBtn: '#toolbar-abc123-connect-btn' }
```

**After Mount (DOM Elements):**
```javascript
await view.mount();
const elements = view.getElementMap();
// { container: <div#toolbar-abc123>, connectBtn: <button#...> }
```

This allows consumers to know what elements they need to implement in custom templates.

## Components

### Core Views

#### ToolbarView (Dockable)
- Connection controls (WebSocket URL, Connect button)
- Debug controls (Pause, Resume, Step Over/Into/Out)
- Settings panel (icon size)
- Docking to designated zone

**Element Map:**
```javascript
{
    container, grip, wsUrlInput, connectBtn, disconnectBtn,
    pauseBtn, resumeBtn, stepOverBtn, stepIntoBtn, stepOutBtn,
    settingsBtn, redockBtn, connectionControls, debugControls, settingsPanel
}
```

#### ConsoleView (Dockable)
- Dual-mode rendering (tabbed or floating)
- Log management with search/filter
- Regex search with highlighting
- Auto-scroll detection

**Element Map (Tabbed):**
```javascript
{
    container, searchWrapper, searchToggle, searchInput,
    searchRegex, clearSearch, undockBtn, logContent
}
```

#### TabSystemView
- Tab navigation between panels
- Tab visibility control
- Pane content management

**Element Map:**
```javascript
{
    container, navContainer, contentContainer,
    tabs: { console, callstack, files, breakpoints, watches, scope },
    panes: { console, callstack, files, breakpoints, watches, scope }
}
```

#### FileTreeView
- Hierarchical file tree
- Script categorization (project/dependencies/node-internal)
- File selection events

#### CallStackView
- Call frame visualization
- Frame selection
- Source code preview integration

#### BreakpointListView
- Breakpoint list with enable/disable toggles
- Add/remove breakpoints
- Form validation

#### WatchesView
- Watch expression management
- Add/remove watches
- Value display

#### ScopeView
- Scope chain visualization
- Variable display by scope (local, global, closure)

## Controllers

Controllers handle business logic and use Views for rendering:

```javascript
import { ToolbarController } from './debugger-v2/controllers/ToolbarController.js';

const toolbar = new ToolbarController({
    container: '#toolbar-area',
    dockZone: '#dock-zone',
    wsUrl: 'ws://localhost:8888'
});

await toolbar.initialize();

// Listen to events
toolbar.on('connect', (wsUrl) => {
    console.log('Connect to:', wsUrl);
});

toolbar.on('pause', () => {
    console.log('Pause execution');
});

// Control UI
toolbar.showDebugControls();
toolbar.updateControlStates(isPaused);
```

## Examples

### Example 1: Standalone Console

```html
<div id="my-console"></div>

<script type="module">
import { ConsoleView } from './debugger-v2/index.js';

const console = new ConsoleView({
    container: '#my-console',
    initialState: { mode: 'tabbed' }
});

await console.mount();

// Add logs
setInterval(() => {
    console.addLogEntry({
        message: `Log at ${Date.now()}`,
        type: 'info'
    });
}, 1000);
</script>
```

### Example 2: Custom Toolbar Layout

```html
<div id="my-app">
    <header id="my-header"></header>
    <main id="my-main"></main>
</div>

<script type="module">
import { ToolbarView, TemplateRegistry } from './debugger-v2/index.js';

// Custom template
TemplateRegistry.register('toolbar', (data, config, instanceId) => {
    return `
        <nav id="${instanceId}" class="my-nav">
            <div class="logo">MyApp Debugger</div>
            <input id="${instanceId}-ws-url" value="${data.wsUrl}">
            <button id="${instanceId}-connect-btn">Connect</button>
            <button id="${instanceId}-pause-btn">Pause</button>
            <button id="${instanceId}-resume-btn">Resume</button>
            <!-- All other required elements... -->
        </nav>
    `;
});

const toolbar = new ToolbarView({ container: '#my-header' });
await toolbar.mount();
</script>
```

### Example 3: Full Custom Layout

```javascript
import {
    ToolbarView,
    ConsoleView,
    CallStackView,
    FileTreeView
} from './debugger-v2/index.js';

// Create custom layout
document.body.innerHTML = `
    <div class="my-layout">
        <aside id="sidebar"></aside>
        <main>
            <header id="toolbar"></header>
            <div id="console"></div>
            <div id="callstack"></div>
        </main>
    </div>
`;

// Mount components
const toolbar = new ToolbarView({ container: '#toolbar' });
const fileTree = new FileTreeView({ container: '#sidebar' });
const console = new ConsoleView({ container: '#console' });
const callStack = new CallStackView({ container: '#callstack' });

await Promise.all([
    toolbar.mount(),
    fileTree.mount(),
    console.mount(),
    callStack.mount()
]);
```

## API Reference

### BaseView

**Constructor:**
- `config.container` - CSS selector for mount container
- `config.initialState` - Initial state data
- `config.template` - Custom template function

**Methods:**
- `mount(container?)` - Mount to DOM
- `unmount()` - Remove from DOM
- `render(data?)` - Generate HTML
- `update(partialState)` - Update and re-render
- `getElementMap()` - Get element references
- `setState(newState)` - Update state
- `getState()` - Get current state

### DockableView

Extends BaseView with:

**Methods:**
- `dock()` - Dock to designated zone
- `undock()` - Make floating
- `savePosition(pos)` - Persist position
- `restorePosition()` - Restore position
- `initDraggable(config)` - Enable dragging
- `initResizable(config)` - Enable resizing

### TemplateRegistry

**Static Methods:**
- `register(name, templateFn)` - Register override
- `get(name)` - Get template
- `has(name)` - Check if exists
- `clear()` - Clear all
- `registerAll(map)` - Bulk registration

## Browser Compatibility

- Modern browsers with ES6 module support
- jQuery 3.6.0+
- jQuery UI 1.13.2+ (for draggable/resizable)

## Migration from v1

v1 (Original): Relies on hardcoded HTML in `debugger.html`
v2 (New): Generates HTML dynamically, embeddable anywhere

Both systems coexist. v1 in `/debugger`, v2 in `/debugger-v2`.

## License

MIT
