# GPIO Architecture

## Overview
PithagorasGPIO is an abstraction layer that runs in the user's Node.js script with two implementations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ User's Node.js Script (Being Debugged)                       │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ PithagorasGPIO (Abstraction Layer)                     │ │
│  │ - pin.on('change', callback)                           │ │
│  │ - pin.write(HIGH/LOW)                                  │ │
│  │ - pin.read()                                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                    │
│              ┌───────────┴──────────────┐                    │
│              │                           │                    │
│      ┌───────▼─────────┐      ┌────────▼────────────┐      │
│      │ Implementation 1│      │ Implementation 2    │      │
│      │ WebSocket       │      │ Hardware GPIO       │      │
│      │ (Simulator)     │      │ (Raspberry Pi)      │      │
│      └─────────────────┘      └─────────────────────┘      │
│              │                                                │
└──────────────┼────────────────────────────────────────────────┘
               │ WebSocket
               │ (port 8081)
               │
      ┌────────▼──────────────────────────────────────────────┐
      │ GPIO WebSocket API Server                             │
      │ - Routes messages between simulator & debugger script │
      └────────┬──────────────────────────────────────────────┘
               │ WebSocket
               │ (port 8081)
               │
┌──────────────▼──────────────────────────────────────────────┐
│ Browser                                                       │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ CircuitJS1 Simulator                                 │  │
│  │ - Simulates GPIO pins (inputs/outputs)              │  │
│  │ - Fires onGPIOOutputChanged events                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↑                                    │
│                          │                                    │
│  ┌───────────────────────┴──────────────────────────────┐  │
│  │ GPIOWebSocketClient (gpio-websocket-client.js)       │  │
│  │ - Bridges CircuitJS1 ↔ WebSocket Server             │  │
│  │ - Sends GPIO output changes to server                │  │
│  │ - Receives GPIO commands from server                 │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

## The Resource Leak Problem

When debugger stops/starts:
1. **gpio-driver.js** (Node side): Creates new WebSocket connection, old one not cleaned up
2. **gpio-websocket-client.js** (Browser side): Creates new instance, old one not cleaned up
3. Result: Multiple WebSocket connections, duplicate event handlers

## Key Insight

- **"connect/disconnect" is WebSocket terminology** - both implementations need to open/close their transport
- **The GPIO abstraction layer** doesn't care about connect/disconnect - it just uses GPIO methods
- **Lifecycle binding**: The WebSocket implementation is bound to debugger lifecycle (connect when debugger connects, disconnect when it disconnects)

## What Needs to Be Simple

### gpio-driver.js (Node side - WebSocket implementation)
- ONE instance per debugger session
- Clean up WebSocket handlers on disconnect
- Don't clear user's pin event callbacks

### gpio-websocket-client.js (Browser side)
- ONE instance for page lifetime
- Clean up WebSocket handlers on disconnect
- No complex event subscription management

## Questions

1. Should `gpio-driver.js` create a new PithagorasGPIO instance each time debugger connects? Or reuse?
2. Should `gpio-websocket-client.js` be a singleton created once on page load?
3. Where exactly is `new PithagorasGPIO()` called in the user's script? Does it persist across debugger restarts?