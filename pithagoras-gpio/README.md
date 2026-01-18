# Pithagoras GPIO Library

GPIO library for the Pithagoras platform - control CircuitJS1 simulator or real Raspberry Pi hardware.

## Architecture

```
┌─────────────────────────────────────┐
│  Node.js User Code (Raspberry Pi)  │
│  const gpio = require(              │
│      'pithagoras-gpio')             │
│  gpio.pin(17).input()               │
│  gpio.pin(17).high()                │
└──────────────┬──────────────────────┘
               │ WebSocket
               ▼
┌─────────────────────────────────────┐
│  node-inspector-websocket-proxy (Node.js Server)  │
│  - HTTP API (port 8080)             │
│  - Debugger WebSocket (port 8888)   │
│  - GPIO WebSocket (port 8081)       │
│    Routes between simulator & code  │
└──────────────┬──────────────────────┘
               │ WebSocket
               ▼
┌─────────────────────────────────────┐
│  Pithagoras (Browser/Electron)      │
│  - CircuitJS1 Simulator             │
│  - GPIO WebSocket Client            │
│  - Connects when debug starts       │
└─────────────────────────────────────┘
```

## Components

### 1. GPIO WebSocket Server
**Location:** `node-inspector-websocket-proxy/server/gpio-websocket-api.js`

- Runs on port 8081
- Routes messages between simulator and GPIO clients
- Handles two connection types:
  - **Simulator connection**: CircuitJS1 registers as 'simulator'
  - **GPIO clients**: User code registers as 'gpio-client'

### 2. GPIO WebSocket Client (Simulator-side)
**Location:** `pithagoras/war/lib/gpio-websocket-client.js`

- Runs in browser alongside CircuitJS1
- Connects to GPIO server when debug session starts
- Disconnects when debug session ends
- Routes GPIO commands to `window.CircuitJS1` API

### 3. GPIO Library (User-side)
**Location:** `node-inspector-websocket-proxy/pithagoras-gpio/index.js`

- Node.js library for user code
- Provides clean API: `gpio.pin(17).input()`, `gpio.pin(22).high()`, etc.
- Connects as GPIO client to WebSocket server

### 4. CircuitJS1 GPIO Elements
**Location:** `pithagoras/src/com/lushprojects/circuitjs1/client/`

- `GPIOInputElm.java` - Voltage source controlled by JavaScript
- `GPIOOutputElm.java` - Monitors circuit voltage, fires callbacks
- Exposed via `window.CircuitJS1` API

## Testing the Complete Workflow

### Prerequisites

1. **Start node-inspector-websocket-proxy server:**
   ```bash
   cd ../node-inspector-websocket-proxy
   node start-server.js
   ```

2. **Open Pithagoras:**
   - In browser: `http://localhost:8080/pithagoras/pithagoras.html`
   - Or use Electron app

3. **Load a circuit with GPIO elements:**
   - In CircuitJS1, go to Draw menu
   - Add "GPIO Input" (e.g., GPIO17)
   - Add "GPIO Output" (e.g., GPIO22)
   - Wire them up to your circuit

### Test Procedure

1. **Start a debug session in Pithagoras:**
   - Click the "Debug" button
   - Select a JavaScript file to debug
   - This will trigger GPIO WebSocket connection

2. **Run the example code:**
   ```bash
   cd pithagoras-gpio
   node example.js
   ```

3. **Observe:**
   - GPIO17 will blink HIGH/LOW every second (you control the input)
   - GPIO22 will report state changes (circuit controls the output)
   - Console shows GPIO events from both sides

### Expected Output

**Terminal (Node.js):**
```
Starting GPIO example...
PithagorasGPIO: Connecting to ws://localhost:8081
PithagorasGPIO: Connected
PithagorasGPIO: Registered as gpio-client (clientId: 1)
Connected to GPIO server

Configuring GPIO17 as input...
Configuring GPIO22 as output...
Registering callback for GPIO22 output changes...

Blinking GPIO17 HIGH/LOW every second...
  Setting GPIO17 to HIGH
  GPIO22 changed: state=1, voltage=3.300V
  Setting GPIO17 to LOW
  GPIO22 changed: state=0, voltage=0.000V
  ...
```

**Browser Console:**
```
GPIOWebSocketClient: Connecting to ws://localhost:8081
GPIOWebSocketClient: Connected
GPIOWebSocketClient: Registered as simulator
GPIO Output changed: GPIO22, 1, 3.3
GPIO Output changed: GPIO22, 0, 0
...
```

## API Reference

### PithagorasGPIO Class

```javascript
const GPIO = require('pithagoras-gpio');
const gpio = new GPIO({
    mode: 'simulator',        // 'simulator' or 'hardware' (hardware TBD)
    serverUrl: 'ws://localhost:8081',
    clientName: 'My GPIO App',
    autoReconnect: true
});
```

### GPIO Pin Methods

```javascript
// Configure as input (you write values)
await gpio.pin(17).input();
await gpio.pin(17).high();
await gpio.pin(17).low();
await gpio.pin(17).write(1);
const state = await gpio.pin(17).read();

// Configure as output (circuit writes, you read via callback)
await gpio.pin(22).output();
const unsubscribe = gpio.pin(22).onChange((state, voltage, bcmPin) => {
    console.log(`GPIO${bcmPin} changed to ${state} (${voltage}V)`);
});

// Later: unsubscribe()
```

## Lifecycle

The GPIO WebSocket client follows the same lifecycle as the debugger:

1. **Pithagoras loads:** GPIO client created but NOT connected
2. **Debug session starts:** GPIO client connects to ws://localhost:8081
3. **User code runs:** Connects as GPIO client, controls pins
4. **Debug session ends:** GPIO client disconnects

This ensures GPIO is only active when there's a debug session with user code running.

## Offline Mode (Local Development)

When working without a physical Raspberry Pi:

1. Run node-inspector-websocket-proxy locally (already doing this)
2. User code connects to localhost:8081
3. Simulator connects to localhost:8081
4. Everything routes through local server

## Hardware Mode (Future)

When deploying to actual Raspberry Pi:

1. node-inspector-websocket-proxy runs on Pi
2. User code runs on Pi (same as simulator mode)
3. GPIO library switches to `mode: 'hardware'`
4. Uses `pigpio` or similar for real GPIO control

## Troubleshooting

**GPIO client can't connect:**
- Ensure node-inspector-websocket-proxy is running
- Ensure you started a debug session in Pithagoras
- Check browser console for GPIO WebSocket connection logs

**Simulator not receiving commands:**
- Check that debug session is active
- Verify GPIO WebSocket shows "simulator: connected" in server logs

**Commands timeout:**
- Ensure CircuitJS1 has GPIO elements in the circuit
- Check that pin names match (e.g., "GPIO17", "GPIO22")

## Files Modified

### In pithagoras:
- `war/pithagoras.html` - Added GPIO WebSocket client script
- `war/pithagoras.js` - Added GPIO lifecycle management
- `war/lib/gpio-websocket-client.js` - NEW: Simulator-side client
- `src/.../CirSim.java` - Already has GPIO API methods

### In node-inspector-websocket-proxy:
- `test-server.js` - Added GPIO WebSocket API mounting
- `server/gpio-websocket-api.js` - NEW: WebSocket routing server
- `pithagoras-gpio/` - NEW: Node.js GPIO library