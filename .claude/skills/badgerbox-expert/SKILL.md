---
name: badgerbox-expert
description: Deep SME on BadgerBox codebase - architecture, patterns, APIs, conventions, CircuitJS1 integration, and every implementation detail
disable-model-invocation: false
---

# BadgerBox Architecture & Implementation Expert

You are the ULTIMATE expert on the BadgerBox codebase. You know every pattern, every API, every convention, and every integration point. This is your complete reference.

## Project Overview

**Name**: BadgerBox (formerly Pithagoras)
**Purpose**: AR-Integrated Electronics Development Environment
**Stack**: Electron + Node.js Express + CircuitJS1 (GWT) + Chrome DevTools Protocol
**Version**: !`cat package.json | grep version | head -1`
**Current Branch**: !`git branch --show-current`

## Critical Architecture Patterns

### The Pithagoras Application Class (www/app/app-bootstrap.js)

**THE HEART OF THE APPLICATION** - Everything flows through this

```javascript
class Pithagoras {
    constructor(ctx) {
        this.subscriptions = []; // Array of {regex, observer}
        this.ctx = ctx || {};
    }

    // REGEX-BASED PUB/SUB - Pattern matching for flexible subscriptions
    sub(pattern, observer) {
        // pattern can be string or RegExp
        // Converts string to RegExp automatically
        // Returns subscription object for later unsubscription
    }

    pub(eventName, data) {
        // Publishes to ALL subscribers whose regex matches eventName
        // subscribers.forEach(sub => if(sub.regex.test(eventName)) sub.observer(eventName, data))
    }
}
```

**Key Implementation Details**:
- `sub()` accepts **RegExp or string** - strings auto-convert to RegExp
- Subscriptions stored as `{regex, observer}` objects
- `pub()` matches event names against ALL subscription regexes
- Pattern examples:
  - `/^debugger:console$/` - exact match
  - `/^breadboard:.*/` - all breadboard events
  - `/.*/` - ALL events (used by console for logging)

**Injection Pattern**:
```javascript
// ALWAYS inject application as dependency
constructor(application) {
    this.logger = new Logger(this.constructor.name);
    this.application = application;
}
```

### Event Taxonomy (Current Usage Patterns)

**Format**: `module:category[:detail]`

**Actual Events in Use**:
```javascript
// Debugger events
'debugger:console'                 // Console message from Chrome DevTools
'debugger:connected'               // DevTools connection established
'debugger:disconnected'            // DevTools connection lost
'debugger:paused'                  // Execution paused at breakpoint
'debugger:resumed'                 // Execution resumed

// Breadboard events
'breadboard:component:placed'      // Component added to breadboard
'breadboard:component:hover'       // Mouse over component
'breadboard:rail:highlighted'      // Power rail highlighted
'breadboard:gpio:highlighted'      // GPIO pin highlighted

// Tutorial events
'tutorial:steps:generated'         // Build instructions created
'tutorial:step:displayed'          // Step shown to user
'tutorial:step:forward'            // Next step clicked
'tutorial:step:backward'           // Previous step clicked
'tutorial:completed'               // All steps finished
'tutorial:reset'                   // Reset button clicked

// Circuit events
'circuit:view:scaled'              // Simulator zoom changed
'circuit:elements:dragged'         // Components moved in simulator
'circuitRead'                      // Circuit loaded/modified

// Store events
'store:set'                        // Data stored (key/value)
```

### MVC Pattern (Console System Example)

**Three separate classes with clear responsibilities**:

```javascript
// Model - Pure data, no DOM
class ConsoleUIModel {
    constructor() {
        this.messages = [];      // Message storage
        this.filters = {...};    // Filter state
    }

    addMessage(msg) { /* Pure data manipulation */ }
    getFilteredMessages() { /* Pure data query */ }
}

// View - DOM manipulation ONLY
class ConsoleUIView {
    constructor() {
        this.$console = $('#console-content');
        this.$toolbar = $('#console-toolbar');
    }

    render(messages) { /* Update DOM */ }
    bindToolbarHandlers(callbacks) { /* Wire up events */ }
}

// Controller - Orchestration
class ConsoleUIController {
    constructor() {
        this.model = null;
        this.view = null;
        this.application = null;
    }

    setCtx(application) { this.application = application; }
    setModel(model) { this.model = model; }
    setView(view) { this.view = model; }

    bind() {
        // Subscribe to events
        this.application.sub(/^debugger:console$/, (topic, data) => {
            this.model.addMessage(data);
            this.updateDisplay();
        });

        // Bind view callbacks
        this.view.bindToolbarHandlers({
            onClear: () => this.clearConsole()
        });
    }
}
```

**Initialization**:
```javascript
let model = new ConsoleUIModel();
let view = new ConsoleUIView();
let controller = new ConsoleUIController();

controller.setModel(model);
controller.setView(view);
controller.setCtx(application);
controller.bind(); // Wire everything up
```

### SVG/Snap.js Pattern (Breadboard System)

**Breadboard uses Snap.js for SVG manipulation**:

```javascript
class Breadboard {
    static SVG_RECT_ATTRS = Object.freeze([
        'jsid',        // Simulator component ID
        'logicalPin',  // Simulator pin number
        'physicalPin', // Real component pin number
        'side',        // left/right on IC
        'label',       // Component label
        'name',        // Pin name
        'fill'         // Color
    ]);

    constructor(svgId) {
        this.svg = $(svgId);
        this.snap = Snap(svgId); // Snap.js instance

        // Bus groups for breadboard rows/columns
        this.busgroup = new BusGroup('busgroup', BusGroup.ORIENTATION.V);
        this.rails = new Rails('rails', [0, 3, 5]);
        this.gpio = new BusGroup('gpio', BusGroup.ORIENTATION.V);
    }

    // Tag a bus (breadboard row) with component info
    tag(row, component, mapping) {
        let bus = this.busgroup.getBus(row);
        let $bus = $(bus.node); // jQuery + Snap.js hybrid

        // Tag SVG with data attributes
        let clone = Object.assign({}, mapping, {
            jsid: component.jsid,
            label: component.label
        });

        Breadboard.SVG_RECT_ATTRS.forEach(attr =>
            $bus.attr(attr, clone[attr])
        );
    }
}
```

**BusGroup Pattern**:
```javascript
class BusGroup {
    static ORIENTATION = { 'V': 1, 'H': 2 };

    constructor(name, orientation) {
        this.items = [];      // Array of Snap.svg rects
        this.orientation = orientation;
    }

    renderV(ctx, item) {
        // Vertical busses (breadboard rows)
        let count = (ctx.height - ctx.padding) / (ctx.busStrokePx + ctx.margin);

        for (let i = 0; i < count; i++) {
            let rect = ctx.snap.rect(x, y, width, height);
            rect.attr({ idx: i, id: `${this.name}-${i}` });
            this.items.push(rect);
            ctx.cursor.y += (ctx.busStrokePx + ctx.margin);
        }
    }

    getBus(idx) {
        return this.items[idx]; // Snap.svg rect element
    }

    tag(row, component, mapping) {
        let bus = this.getBus(row);
        $(bus.node).attr('jsid', component.jsid); // jQuery on Snap element
    }
}
```

**Rails = Horizontal Power Busses**:
```javascript
class Rails extends BusGroup {
    constructor(busdef, voltages, scale) {
        super(busdef, BusGroup.ORIENTATION.H, scale);
        this.voltages = [0, 3, 5]; // Ground, 3V, 5V
    }

    renderH(ctx, item) {
        for (let i = 0; i < count; i++) {
            rect.attr('voltage', i===0 ? 0 : i===1 ? 3 : i===2 ? 5 : -1);
            rect.attr('label', i===0 ? "Ground" : (i===1 || i===2) ? "Rail" : "");
        }
    }
}
```

### CircuitJS1 Integration (GWT → JavaScript)

**CircuitJS1 is GWT-compiled Java running in an iframe** - CRITICAL CONSTRAINTS:

1. **Cannot modify GWT code** - upstream dependency
2. **Communication via postMessage** - iframe boundary
3. **Access via window.CircuitJS1** - global object in iframe
4. **Components are Java objects** - special method calls

**Accessing the Simulator**:
```javascript
// Get iframe content window
let sim = $('#circuitFrame')[0].contentWindow;

// Access GWT-compiled CircuitJS1 object
let circuitJS = sim.CircuitJS1;

// Get simulator instance (CirSim Java class)
let simulator = circuitJS.sim;

// Component list (ArrayList in Java)
let elements = simulator.elmList;
```

**Component Queries**:
```javascript
// Iterate Java ArrayList
for (let i = 0; i < elements.size(); i++) {
    let component = elements.get(i);

    // Java method calls
    let label = component.getLabel();         // String
    let postCount = component.getPostCount(); // int
    let info = component.getInfo();           // Array

    // Custom properties (added by us)
    let jsid = component.jsid;                // Our identifier
    let pinProfile = component.pinProfile;    // Our pin mapping
}
```

**Component Types** (Java classes):
```javascript
// Check component type
let className = component.getClass().getName();

// Common types:
'com.lushprojects.circuitjs1.client.ResistorElm'
'com.lushprojects.circuitjs1.client.CapacitorElm'
'com.lushprojects.circuitjs1.client.LEDElm'
'com.lushprojects.circuitjs1.client.VoltageElm'
'com.lushprojects.circuitjs1.client.GroundElm'
'com.lushprojects.circuitjs1.client.GPIOElm'        // Custom!
'com.lushprojects.circuitjs1.client.LogicInputElm'
'com.lushprojects.circuitjs1.client.LogicOutputElm'
```

**The jsid Convention**:
```javascript
// Every component gets a unique jsid (our invention)
component.jsid = "R$0";  // Resistor #0
component.jsid = "C$1";  // Capacitor #1
component.jsid = "Voltage$2"; // Voltage source #2

// Label is user-visible name
component.label = "Resistor";
component.label = "Capacitor";
component.label = "5V Rail";
```

**Pin Profiles** (Hardware Mapping):
```javascript
// For complex components (ICs), we add pinProfile
component.pinProfile = {
    manufacturer: 'Texas Instruments',
    model: 'NE555',
    banks: {
        left: [
            {logicalPin: 0, physicalPin: 1, name: 'GND'},
            {logicalPin: 1, physicalPin: 2, name: 'TRIG'}
        ],
        right: [
            {logicalPin: 6, physicalPin: 8, name: 'VCC'},
            {logicalPin: 5, physicalPin: 7, name: 'DIS'}
        ]
    },
    pins: [/* all pins combined */]
};
```

### CircuitModel Static Helpers

**CircuitModel is a utility class, NOT an instance**:

```javascript
class CircuitModel {
    static logger = new Logger('CircuitModel');

    // Get component by jsid
    static getComponent(jsid) {
        let sim = $('#circuitFrame')[0].contentWindow.CircuitJS1.sim;
        for (let i = 0; i < sim.elmList.size(); i++) {
            let c = sim.elmList.get(i);
            if (c.jsid === jsid) return c;
        }
        return null;
    }

    // Extract label from jsid
    static labelForJsid(jsid) {
        // "R$0" → "Resistor"
        // "GPIO$3" → "GPIO"
        let component = CircuitModel.getComponent(jsid);
        return component ? component.getLabel() : jsid.split('$')[0];
    }

    // Full label with characteristics
    static fullLabelForJsid(jsid) {
        // "R$0" → "10kΩ Resistor"
        let label = CircuitModel.labelForJsid(jsid);
        let char = CircuitModel.getCharacteristics(jsid);
        return char === label ? label : `${char} ${label}`;
    }

    // Extract component value/properties
    static getCharacteristics(jsid) {
        let component = CircuitModel.getComponent(jsid);
        let label = CircuitModel.fullLabelForJsid(jsid);
        let info = component.getInfo().toString().split(',');

        switch(label) {
            case 'Resistor': return info[3];  // "10kΩ"
            case 'Capacitor': return info[3]; // "10μF"
            case 'Inductor': return info[3];  // "100mH"
            case 'LED': return info[0];       // "Red"
            case 'Switch': return info[0];    // "SPST"
            default: return label;            // Fallback
        }
    }

    // Check if simple component (2 pins)
    static isSimpleComponent(component) {
        return !component.getPinNames ||
               component.getPostCount() === 2;
    }

    // Get all components as array
    static getComponents() {
        let sim = $('#circuitFrame')[0].contentWindow.CircuitJS1.sim;
        let result = {};
        for (let i = 0; i < sim.elmList.size(); i++) {
            let c = sim.elmList.get(i);
            if (c.jsid) result[c.jsid] = c;
        }
        return result;
    }
}
```

### Breadboard Static Helpers

```javascript
class Breadboard {
    // Check if component is a power rail
    static isRail(component) {
        if (!component) return false;
        let label = CircuitModel.labelForJsid(component.jsid);
        return label === 'Voltage' ||
               label === 'Ground' ||
               label.includes('Rail');
    }

    // Check if component is GPIO
    static isGPIO(component) {
        if (!component) return false;
        let label = CircuitModel.labelForJsid(component.jsid);
        return label.includes('GPIO') ||
               label.includes('G P I O');
    }

    // Filter out components we don't show in BOM
    static ignore(label) {
        return Object.entries(Breadboard.filters)
            .find(([k, v]) => v.indexOf(label) !== -1) !== undefined;
    }
}
```

## BOM (Bill of Materials) System

**Data Model**:
```javascript
class LineItem {
    constructor(component, quantity, manufacturer, model) {
        this.label = CircuitModel.labelForJsid(component.jsid);
        this.sublabel = LineItem.sublabel(component);
        this.fullLabel = this.label + this.sublabel;

        this.manufacturer = manufacturer;
        this.model = model;

        this.example = component.jsid;
        this.jsids = [this.example];  // Array of component jsids
        this.quantity = quantity || 1;
        this.pinMapping = component.pinMapping;
    }
}

class BillOfMaterials {
    constructor(application) {
        this.lineItems = new Map();  // fullLabel → LineItem
        this.dictionary = new Map(); // fullLabel|jsid → LineItem

        // Populate from circuit
        Object.values(this.application.circuitModel.getComponents())
            .forEach(c => this.add(new LineItem(c)));
    }

    add(item) {
        if (BillOfMaterials.ignore(item.label)) return;

        if (this.lineItems.has(item.fullLabel)) {
            // Increment quantity
            let existing = this.lineItems.get(item.fullLabel);
            existing.jsids.push(item.example);
            existing.quantity++;
        } else {
            // New line item
            this.lineItems.set(item.fullLabel, item);
            this.dictionary.set(item.fullLabel, item);
            this.dictionary.set(item.example, item);
        }
    }
}
```

## Wiring Simplification Algorithm

**Purpose**: Create minimal spanning tree of connections (no redundant wires)

```javascript
class BomBasedBuildInstructions {
    generate() {
        let bom = this.application.circuitModel.asBOM();
        let wiring = this.application.circuitModel.simplify();

        // Union-Find for spanning tree
        let unionFind = new Map();

        let getRoot = (pin) => {
            if (!unionFind.has(pin)) {
                unionFind.set(pin, pin);
                return pin;
            }
            if (unionFind.get(pin) === pin) return pin;

            // Path compression
            let root = getRoot(unionFind.get(pin));
            unionFind.set(pin, root);
            return root;
        };

        let union = (pin1, pin2) => {
            let root1 = getRoot(pin1);
            let root2 = getRoot(pin2);
            if (root1 !== root2) {
                unionFind.set(root2, root1);
                return true;  // Joined separate components
            }
            return false;     // Already connected
        };

        // Only generate instructions for NEW connections
        wiring.forEach(([src, dests]) => {
            dests.forEach(dest => {
                let key1 = `${src.comp}:${src.pin}`;
                let key2 = `${dest.comp}:${dest.pin}`;

                if (union(key1, key2)) {
                    // This connection JOINS two components
                    instructions.push(new BuildStep(
                        `Connect ${srcLabel} to ${destLabel}`,
                        BuildStep.TYPE.CONNECT_COMPONENT,
                        src, dest
                    ));
                }
                // else: already connected via another path, skip
            });
        });
    }
}
```

## jQuery + Vanilla JS Hybrid Pattern

**The codebase mixes jQuery and vanilla DOM**:

```javascript
// jQuery selection
let $element = $('#my-id');
let $elements = $('.my-class');

// Vanilla DOM from iframe
let iframe = $('#circuitFrame')[0];
let contentWindow = iframe.contentWindow;

// Snap.js + jQuery hybrid
let rect = snap.rect(x, y, w, h);  // Snap.svg element
$(rect.node).attr('jsid', 'R$0');   // jQuery on Snap's DOM node

// Event binding - jQuery
$('#button').on('click', () => {});

// Event binding - vanilla
document.getElementById('button').addEventListener('click', () => {});
```

## Logger Pattern

**ALWAYS instantiate a logger**:

```javascript
class MyClass {
    constructor() {
        this.logger = new Logger('MyClass');
        // OR
        this.logger = new Logger(this.constructor.name);
    }

    myMethod() {
        this.logger.info('myMethod called', {param: value});
        this.logger.debug('detailed info', data);
        this.logger.warn('something odd', warning);
        this.logger.error('failed', error);
    }
}
```

**Logger Levels**:
```javascript
Logger.LEVEL = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// Set level in constructor
this.logger = new Logger('MyClass', Logger.LEVEL.DEBUG);
```

## Array Prototype Extension

**BadgerBox adds removeByValue to Array.prototype**:

```javascript
Array.prototype.removeByValue = function(value, key = 'id') {
    if (value && typeof value === 'object' && key in value) {
        const filteredArray = this.filter(obj => obj[key] !== value[key]);
        this.length = 0;
        this.push(...filteredArray);
    }
    return this;
};

// Usage:
components.removeByValue(component, 'jsid');
```

## Electron Architecture

**Main Process** (electron-main.js):
- Spawns Express server (server/server.js)
- Creates BrowserWindow
- Loads http://localhost:8080/app/index.html
- Handles IPC from renderer

**Server** (server/server.js):
- Express HTTP server
- WebSocket server (ws)
- APIs:
  - `/api/projects` - project management
  - `/api/workspace` - file operations
  - `/api/debugger-session` - Chrome DevTools proxy
  - `/gpio` - GPIO WebSocket

**Renderer** (www/app/index.html):
- Loads all UI code
- Two iframes:
  - `#circuitFrame` - CircuitJS1 simulator
  - `#code` - Ace editor
- Connects to server WebSockets

## Iframe Communication

**CircuitJS1 (GWT simulator)**:
```javascript
let iframe = $('#circuitFrame')[0];
let sim = iframe.contentWindow;

// Post message TO simulator
sim.postMessage({
    type: 'loadCircuit',
    circuit: circuitData
}, '*');

// Listen for messages FROM simulator
window.addEventListener('message', (event) => {
    if (event.source === iframe.contentWindow) {
        console.log('From simulator:', event.data);
    }
});
```

**Ace Editor**:
```javascript
let iframe = $('#code')[0];
let aceWindow = iframe.contentWindow;

// Access Ace editor
let editor = aceWindow.editor;
editor.setValue(code);
let value = editor.getValue();
```

## File/Module Organization

```
www/
├── app/                    # Application bootstrap
│   ├── app-bootstrap.js    # Pithagoras class (main app)
│   ├── constants.js        # Global constants
│   ├── mode-controller.js  # Design/Build mode switching
│   ├── toolbar-controller.js
│   ├── gutter-controller.js
│   └── observable-map.js
├── breadboard/             # Breadboard visualization & BOM
│   ├── breadboard.js       # Breadboard class (SVG/Snap.js)
│   ├── bill-of-materials.js
│   ├── line-item.js
│   ├── circuit-model.js    # Static utility (CircuitJS1 queries)
│   ├── circuit-scanner.js
│   ├── build-instructions-generator.js
│   ├── tutorial-strategy.js
│   ├── overlay.js          # Component overlays on breadboard
│   ├── pin-manager.js      # Pin mapping UI
│   ├── pin-manager-view.js
│   └── pin-manager-util.js
├── console/                # MVC console
│   ├── console-model.js
│   ├── console-view.js
│   └── console-controller.js
├── editor/                 # Code editor (Ace)
│   ├── ace-controller-v2.js
│   ├── ace-tab-manager.js
│   ├── editor-helper.js
│   ├── project-helper.js
│   ├── project-api.js
│   ├── project-ui.js
│   ├── project-file-tree.js
│   ├── file-tree-controller.js
│   └── toolbar-helper.js
├── debugger/               # Chrome DevTools Protocol
│   └── api/
│       ├── debugger-api-client.js
│       ├── debugger-connection-helper.js
│       ├── debugger-event-helper.js
│       ├── debugger-simulator-sync.js
│       └── debug-toolbar-helper.js
├── gpio/                   # GPIO WebSocket client
│   └── gpio-websocket-client.js
├── bluetooth/              # Bluetooth/Serial connection
│   ├── bluetooth-detection.js
│   ├── web-serial-manager.js
│   └── bluetooth-ui-controller.js
├── project-ui/             # Project management UI
│   ├── project-manager.js
│   └── project-ui-controller.js
├── preferences/            # Settings UI
│   └── preferences-controller.js
├── styles/                 # Theme system
│   ├── theme-base.css
│   ├── theme-dark.css
│   ├── theme-light.css
│   ├── theme-switcher.js
│   └── theme-switcher.css
├── util/                   # Utilities
│   ├── logger.js
│   └── draggable-window.js
└── vendor/                 # Third-party libs
    ├── jquery/
    ├── ace/
    ├── snap/
    └── splitjs/
```

## Critical Initialization Sequence

**In www/app/index.html**:

```javascript
$(document).ready(async function(){
    // 1. Wait for iframes to load
    await waitForIframes();

    // 2. Create Pithagoras instance
    const pithagoras = new Pithagoras();

    // 3. Initialize
    await pithagoras.initialize();

    // 4. App is ready
});

async function waitForIframes() {
    await Promise.all([
        // CircuitJS1 iframe
        waitForIframe('#circuitFrame', (iframe) => {
            return iframe.contentWindow &&
                   iframe.contentWindow.CircuitJS1;
        }),

        // Ace editor iframe
        waitForIframe('#code', (iframe) => {
            return iframe.contentWindow &&
                   iframe.contentWindow.document;
        })
    ]);
}
```

## Initialization Chain (Pithagoras.initialize)

```javascript
async initialize() {
    // 1. Get simulator reference
    this.simulator = $('#circuitFrame')[0].contentWindow.CircuitJS1.sim;

    // 2. Create circuit model
    this.circuitModel = new CircuitModel(this.simulator);

    // 3. Create breadboard
    this.breadboard = new Breadboard('#breadboard');
    this.breadboard.init(this);

    // 4. Create console (MVC)
    this.consoleModel = new ConsoleUIModel();
    this.consoleView = new ConsoleUIView();
    this.consoleController = new ConsoleUIController();
    this.consoleController.setModel(this.consoleModel);
    this.consoleController.setView(this.consoleView);
    this.consoleController.setCtx(this);
    this.consoleController.bind();

    // 5. Create tutorial strategy
    this.tutorialStrategy = new ComponentFocusedTutorialStrategy();
    this.tutorialStrategy.setCtx(this);

    // 6. Setup simulator watchers
    this.simulator.watch({
        notify: (op, jsid) => {
            this.pub('circuit:changed', {op, jsid});
        }
    });

    // 7. Load initial circuit
    this.loadCircuit(startCircuit);
}
```

## Testing

**Framework**: Jasmine
**Location**: `www/tests/specs/`
**Config**: `www/tests/karma.conf.js`

```bash
# Run tests
npm test

# Run specific spec
npm run test:spec -- --spec=breadboard.spec.js

# Headless mode
npm run test:headless
```

## Common Gotchas

1. **CircuitJS1 components are Java objects** - use Java methods like `.size()`, `.get(i)`
2. **jsid vs label** - jsid is unique ID, label is display name
3. **Snap.svg + jQuery** - use `$(rect.node)` to apply jQuery to Snap elements
4. **Regex-based pub/sub** - patterns match ALL matching subscribers
5. **Pin mapping** - logicalPin (simulator) ≠ physicalPin (real component)
6. **Iframe boundaries** - use postMessage, can't access simulator code directly
7. **Array.prototype.removeByValue** - custom extension, may break libraries
8. **Logger levels** - set in constructor, not per-call
9. **BOM filters** - some components ignored (Logic, Voltage, Ground, Wire)
10. **Union-Find in wiring** - creates minimal spanning tree, not full mesh

## File Naming & Style

- **Classes**: PascalCase (`BillOfMaterials`, `CircuitModel`)
- **Files**: kebab-case (`build-instructions-generator.js`)
- **CSS IDs**: kebab-case (`#step-content`, `#console-toolbar`)
- **CSS Classes**: kebab-case (`console-tab`, `toolbar-btn`)
- **Constants**: SCREAMING_SNAKE_CASE (`SVG_RECT_ATTRS`)
- **Methods**: camelCase (`getFriendlyLabel`, `syncToModel`)

## Dynamic Context

### Current Files
!`find www -maxdepth 2 -type f -name "*.js" | grep -v vendor | sort`

### Recent Changes
!`git diff --stat HEAD~5..HEAD`

### Active Branch
!`git status --short`

### Module Count
!`find www -name "*.js" -not -path "*/vendor/*" -not -path "*/tests/*" | wc -l` JavaScript files

---

**You are the EXPERT. Know this codebase inside and out. Enforce these patterns. Maintain this architecture.**