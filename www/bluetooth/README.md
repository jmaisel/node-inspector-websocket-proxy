# Web Serial Bluetooth Manager

Modern implementation of Bluetooth Classic Serial Port Profile (SPP) communication using the Web Serial API.

## Overview

This implementation replaces the previous Node.js `serialport` package approach with the browser-native **Web Serial API**, which supports Bluetooth Classic RFCOMM/SPP as of Chrome 117+ (Electron 25+).

## Benefits

✅ **No Native Modules** - No need for serialport package or native compilation
✅ **Cross-Platform** - Works consistently across all platforms
✅ **Standard Web API** - Future-proof browser standard
✅ **Better Security** - User permission model built-in
✅ **Simpler Architecture** - Runs directly in renderer process, no IPC needed

## Requirements

- **Chrome/Electron**: Version 117+ (for Bluetooth Classic support)
- **Bluetooth**: Paired Bluetooth Classic SPP device
- **Platform**: Desktop (Windows, macOS, Linux)

## Architecture

```
ESP32 (Bluetooth Classic SPP)
    ↓
OS Bluetooth Stack
    ↓
Web Serial API (Chrome/Electron)
    ↓
WebSerialBluetoothManager (renderer process)
    ↓
BluetoothUIController (UI)
```

## Files

- **web-serial-manager.js** - Core Bluetooth manager using Web Serial API
- **bluetooth-ui-controller.js** - UI controller for connection management
- **bluetooth-panel.html** - User interface panel with terminal

## Usage

### Basic Connection

```javascript
const manager = new WebSerialBluetoothManager();

// Request port selection from user
const port = await manager.requestPort();

// Connect to the port
await manager.connect(port, { baudRate: 115200 });

// Listen for data
manager.addEventListener('data', (event) => {
    console.log('Received:', event.detail.line);
});

// Send command
const response = await manager.sendCommand('AT');
```

### With Custom Service Class ID

For non-standard RFCOMM services:

```javascript
const port = await manager.requestPort({
    allowedBluetoothServiceClassIds: ["01234567-89ab-cdef-0123-456789abcdef"]
});
```

### Using the UI

1. Click the **📡 Bluetooth** button in the toolbar
2. Click **Connect to Bluetooth Device**
3. Select your paired Bluetooth device from the system dialog
4. Use the terminal to send commands and view responses

## Events

The manager fires these events:

- **connected** - Connection established
- **disconnected** - Connection lost
- **data** - Data received (emits `{line: string}`)
- **error** - Error occurred

## Auto-Reconnection

Auto-reconnection is enabled by default:

```javascript
manager.autoReconnect = true;
manager.reconnectDelay = 5000; // 5 seconds
```

## Command Queue

Commands are queued and processed sequentially:

```javascript
// These run one at a time
await manager.sendCommand('AT');
await manager.sendCommand('AT+VERSION');
await manager.sendCommand('AT+LIST');
```

## Migration from serialport

If you're migrating from the old Node.js `serialport` approach:

### Old (electron-bluetooth-manager.js)
```javascript
const { SerialPort } = require('serialport');
// Runs in main process, requires IPC
```

### New (web-serial-manager.js)
```javascript
const manager = new WebSerialBluetoothManager();
// Runs in renderer process, no IPC needed
```

### Key Differences

| Feature | serialport (old) | Web Serial API (new) |
|---------|-----------------|---------------------|
| Process | Main | Renderer |
| Native modules | Required | None |
| Compilation | Yes | No |
| User permission | OS-level | Browser prompt |
| IPC required | Yes | No |
| Platform support | Variable | Consistent |

## Browser Support

The Web Serial API with Bluetooth Classic support is available in:

- ✅ Chrome 117+ (desktop)
- ✅ Electron 25+ (any platform)
- ❌ Mobile browsers (not yet supported)
- ❌ Firefox, Safari (no Web Serial API yet)

## Security

- User must explicitly grant permission via system dialog
- Only Serial Port Profile (UUID 0x1101) allowed for standard Bluetooth
- Custom Service Class IDs require explicit allowlist
- No access to audio/video Bluetooth profiles

## Troubleshooting

### "Web Serial API not supported"
- Ensure you're using Chrome 117+ or Electron 25+
- Check that your Electron app doesn't disable Web Serial API

### "User cancelled port selection"
- Normal when user closes the selection dialog
- App remains functional, user can retry

### Connection fails
- Ensure device is paired in OS Bluetooth settings
- Check that device supports Serial Port Profile (SPP)
- Verify no other application is using the device

### No data received
- Check baud rate matches device (typically 115200)
- Verify device is actually sending data
- Check line endings match your protocol

## References

- [Web Serial API Specification](https://wicg.github.io/serial/)
- [Chrome Blog: Serial over Bluetooth](https://developer.chrome.com/blog/serial-over-bluetooth)
- [MDN: Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)

## Legacy Code

The old `electron-bluetooth-manager.js` using Node.js `serialport` is kept for reference but can be removed once migration is complete.
