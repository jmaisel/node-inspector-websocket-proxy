# Electron App Architecture

## Overview

The Pithagoras Electron app is a client-only application that connects to an external server. The server can run on:
- The same machine (localhost) during development
- A Raspberry Pi SBC for production use

The server directory is bundled with the Electron app for Bluetooth transfer to SBC devices during initial setup.

## Architecture

```
┌─────────────────────────────────────┐
│   Electron App (Desktop/Laptop)    │
│                                     │
│  - Displays UI (www/app/)           │
│  - Connects to http://localhost:8080│
│  - Bundles server/ for transfer     │
└──────────────┬──────────────────────┘
               │
               │ HTTP/WebSocket
               │
┌──────────────▼──────────────────────┐
│    Server (Raspberry Pi / Local)   │
│                                     │
│  - HTTP API (port 8080)             │
│  - Debug WebSocket (port 8888)      │
│  - GPIO WebSocket (port 8081)       │
│  - Workspace management             │
└─────────────────────────────────────┘
```

## Development Workflow

### Running Locally

1. **Start the server** (Terminal 1):
   ```bash
   npm run server
   # or
   cd server && npm start
   ```

2. **Start the Electron app** (Terminal 2):
   ```bash
   npm run electron
   # or for development mode with DevTools
   npm run electron:dev
   ```

The Electron app will check if the server is running on `localhost:8080`. If not, it will show an error dialog.

### Building for Distribution

```bash
# Build for current platform
npm run build

# Build for all platforms
npm run build:all

# Build for specific platform
npm run build:linux
npm run build:mac
npm run build:win
```

The built app will be in the `dist/` directory.

## Production Workflow (with Raspberry Pi)

### Initial Setup

1. **On Desktop**: Build the Electron app
2. **First Run**: When user opens the app for the first time and no Pi is configured:
   - App detects no server at localhost:8080
   - App shows "Setup Wizard" (to be implemented)
   - User pairs with Raspberry Pi via Bluetooth
   - App transfers `server/` directory to Pi
   - App runs `npm install && npm start` on Pi via Bluetooth/SSH
   - Pi server starts on port 8080
   - App connects and loads

3. **Subsequent Runs**: App connects directly to `raspberrypi.local:8080` or last known Pi IP

### Server Updates

When the Electron app version changes:
1. App detects version mismatch with Pi server
2. App offers to update server
3. User confirms
4. App transfers updated `server/` directory
5. App restarts server on Pi

## Files Included in Build

The Electron build includes:
- `electron-main.js` - Main process (client-only)
- `www/**/*` - Frontend UI files
- `server/**/*` - Server files (for Bluetooth transfer)
- `pithagoras-gpio/**/*` - GPIO library
- `util/**/*` - Utilities

The `server/` directory is unpacked from the ASAR archive (via `asarUnpack`) so it can be easily transferred to the Raspberry Pi.

## Server Directory Location

In the built app, the server directory is located at:
- **macOS**: `Pithagoras.app/Contents/Resources/app.asar.unpacked/server/`
- **Linux**: `resources/app.asar.unpacked/server/`
- **Windows**: `resources\app.asar.unpacked\server\`

## Configuration

### Server Connection

Edit `electron-main.js` to change server location:
```javascript
const SERVER_HOST = 'localhost';  // or 'raspberrypi.local'
const SERVER_PORT = 8080;
```

### Server Configuration

Server configuration is in `server/package.json`:
```json
{
  "server.config": {
    "httpPort": 8080,
    "proxyPort": 8888,
    "gpioPort": 8081,
    "workspaceRoot": "/tmp/node-inspector-websocket-proxy"
  }
}
```

## Future: Setup Wizard

To be implemented:
1. Bluetooth pairing UI
2. Server transfer progress indicator
3. SSH connection setup
4. Server health monitoring
5. Server version checking
6. Automatic server updates
7. Multiple Pi device management
