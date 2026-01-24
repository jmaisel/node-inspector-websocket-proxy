# Bluetooth Setup Guide

## Architecture Overview

```
┌──────────────────────┐
│   Electron App       │  Desktop/Laptop
│   (localhost:8080)   │
└──────────┬───────────┘
           │
           │ Bluetooth SPP
           │ (Persistent control channel)
           │
┌──────────▼───────────┐
│   ESP32/BadgerBox    │  Bridge device
│   (Bluetooth ↔ UART) │
└──────────┬───────────┘
           │
           │ UART
           │
┌──────────▼───────────┐
│   Raspberry Pi       │  SBC running server
│   - Server (port 8080)│
│   - GPIO control     │
│   - Workspace files  │
└──────────────────────┘
```

## Bluetooth Connection

The Electron app maintains a **persistent Bluetooth serial connection** to the ESP32/BadgerBox, which bridges to the Raspberry Pi's UART. This provides:

1. **Out-of-band management** - Control the Pi even without network
2. **Initial setup** - Transfer and install server on first boot
3. **Configuration** - Configure WiFi, network settings, etc.
4. **Terminal access** - Direct shell access to Pi
5. **File transfers** - Transfer updates or files when needed

## Prerequisites

### Raspberry Pi Setup

1. **Enable UART** on Raspberry Pi:
   ```bash
   # Edit /boot/config.txt
   enable_uart=1

   # Disable serial console
   sudo systemctl disable serial-getty@ttyAMA0.service
   ```

2. **Wire ESP32 to Pi UART**:
   - ESP32 TX → Pi RX (GPIO 15, pin 10)
   - ESP32 RX → Pi TX (GPIO 14, pin 8)
   - GND → GND

### ESP32/BadgerBox Setup

1. **Flash Bluetooth SPP firmware** that bridges Bluetooth ↔ UART
2. **Configure baud rate**: 115200
3. **Set device name**: "BadgerBox" or similar

### Desktop/Laptop Setup

1. **Pair BadgerBox** with your computer:
   - **Linux**: `bluetoothctl` → `scan on` → `pair [MAC]` → `trust [MAC]`
   - **macOS**: System Preferences → Bluetooth → Pair
   - **Windows**: Settings → Bluetooth → Add device

2. **Note the serial port** created after pairing:
   - **Linux**: `/dev/rfcomm0` or similar
   - **macOS**: `/dev/cu.BadgerBox-SerialPort` or similar
   - **Windows**: `COM3` or similar

## Using the Setup Wizard

1. **Launch Electron app**
2. **Open Bluetooth Setup**: Navigate to `http://localhost:8080/bluetooth-setup.html`
3. **Scan for devices**: Click "Scan for Bluetooth Devices"
4. **Select BadgerBox**: Choose your BadgerBox from the list
5. **Connect**: Click "Connect"
6. **Check Pi status**: Verify connection to Pi
7. **Setup server** (first time only):
   - Click "Setup Server on Pi"
   - Wait for transfer and installation (2-5 minutes)
   - Server will start automatically

## Manual Setup via Terminal

If you prefer manual setup:

```bash
# 1. Connect via Bluetooth terminal
screen /dev/rfcomm0 115200
# or
minicom -D /dev/rfcomm0 -b 115200

# 2. You should see Pi shell prompt
# 3. Transfer server archive (see below)
# 4. Extract and install
cd /tmp
tar -xzf server.tar.gz
cd server
npm install
npm start
```

## Transferring Files via Serial

### Method 1: Base64 (built into setup wizard)

```bash
# On Pi via serial terminal
cat > /tmp/file.tar.gz.b64 << 'EOF'
[paste base64 encoded data]
EOF
base64 -d /tmp/file.tar.gz.b64 > /tmp/file.tar.gz
```

### Method 2: XMODEM/YMODEM (faster)

```bash
# On Pi
sudo apt-get install lrzsz
rz  # Receive file via ZMODEM

# Then send file from terminal program
# minicom: Ctrl+A, then S
# screen: Not supported natively
```

## Troubleshooting

### Can't find Bluetooth device

- Ensure BadgerBox is powered on
- Check if device is paired
- On Linux, check `hciconfig` and `bluetoothctl`
- Try unpairing and re-pairing

### Connection fails

- Check baud rate (should be 115200)
- Verify UART wiring to Pi
- Check Pi UART is enabled in `/boot/config.txt`
- Ensure serial console is disabled

### Slow file transfers

- Bluetooth SPP is slow (~1-3 KB/s for text transfer)
- Large files may take several minutes
- Consider setting up WiFi first, then use that for transfers

### Terminal shows garbled text

- Check baud rate matches (115200)
- Verify proper ground connection
- Check for electrical interference

## Development

### Testing Bluetooth without ESP32

Use virtual serial ports for testing:

```bash
# Linux
socat -d -d pty,raw,echo=0 pty,raw,echo=0
# Note the two PTY paths, use one for app, one for testing

# macOS
# Use a USB-Serial adapter in loopback mode
```

### Bluetooth Manager API

```javascript
// In renderer process (browser)
if (window.bluetooth) {
    // Scan for devices
    const devices = await window.bluetooth.scan();

    // Connect
    await window.bluetooth.connect('/dev/rfcomm0');

    // Send command
    const result = await window.bluetooth.sendCommand('ls -la');

    // Get Pi status
    const status = await window.bluetooth.getStatus();

    // Setup server
    await window.bluetooth.setupServer('/path/to/server.tar.gz');

    // Listen for events
    window.bluetooth.onData((data) => console.log('Received:', data));
    window.bluetooth.onConnected((info) => console.log('Connected:', info));
    window.bluetooth.onDisconnected(() => console.log('Disconnected'));
}
```

## Security Considerations

1. **Bluetooth pairing** - Requires pairing before connection
2. **Shell access** - Full root access via serial, ensure physical security
3. **No authentication** - Serial connection bypasses SSH authentication
4. **Local only** - Bluetooth range limits exposure

## Future Enhancements

- [ ] Automatic device discovery and pairing
- [ ] File transfer progress indicator
- [ ] Server update detection and auto-update
- [ ] WiFi configuration wizard via Bluetooth
- [ ] Multiple device support
- [ ] Connection health monitoring
