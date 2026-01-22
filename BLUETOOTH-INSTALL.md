# Bluetooth Module Installation

## Current Status

✅ **App runs without Bluetooth** - The app will start and function normally, but Bluetooth features are disabled until you compile the native modules.

⚠️ **Bluetooth requires native compilation** - The `serialport` module needs to be rebuilt for Electron.

## Quick Start (Without Bluetooth)

The app works perfectly for development on localhost:

```bash
# Terminal 1 - Start server
npm run server

# Terminal 2 - Start Electron app
npm run electron
```

The app connects to `localhost:8080` and all GPIO/debugging features work.

## Enabling Bluetooth

### Prerequisites

Install Python distutils (required for native module compilation):

```bash
# Ubuntu/Debian/Mint
sudo apt-get install python3-distutils python3-dev

# Fedora/RHEL
sudo dnf install python3-devel

# macOS (usually already installed)
# If needed: brew install python@3

# Windows
# Ensure Python is installed from python.org with "Add to PATH" checked
```

### Build Native Modules

```bash
# Option 1: Use newer @electron/rebuild (recommended)
npm install --save-dev @electron/rebuild
npx @electron/rebuild

# Option 2: Use legacy electron-rebuild
npx electron-rebuild

# Option 3: Install during regular install
npm install
```

### Verify It Works

```bash
npm run electron
```

The app should now show Bluetooth as available in the console:
- ❌ Before: "serialport not available - Bluetooth features will be disabled"
- ✅ After: No warning, Bluetooth menu/features available

### Test Bluetooth Setup

1. Open app
2. Navigate to: **Settings → Bluetooth Setup** (or `/bluetooth-setup.html`)
3. Click "Scan for Bluetooth Devices"
4. If working: You'll see available devices
5. If not working: You'll see an error message

## Troubleshooting

### Python distutils not found

```bash
# Install distutils
sudo apt-get install python3-distutils python3-dev

# Verify Python
python3 --version  # Should be 3.8 or newer

# Try rebuild again
npx @electron/rebuild
```

### node-gyp errors

```bash
# Install build tools
sudo apt-get install build-essential

# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
npx @electron/rebuild
```

### Module version mismatch

```bash
# Completely rebuild
rm -rf node_modules
npm install
npx @electron/rebuild
```

### Still not working?

Bluetooth is optional - the app works without it:
- All main features work (GPIO simulation, debugging, project management)
- Only the "Bluetooth Setup" wizard won't function
- You can still manually setup the Raspberry Pi via SSH/WiFi

## Alternative Setup Methods

If you can't get Bluetooth working, here are alternatives:

### 1. SSH/WiFi Setup (Recommended)

```bash
# On Raspberry Pi
cd ~
git clone https://your-repo/server.git pithagoras-server
cd pithagoras-server/server
npm install
npm start
```

Then configure Electron app to connect to Pi's IP instead of localhost.

### 2. SD Card Image

Create a pre-configured SD card image with server already installed.

### 3. USB Serial Adapter

Instead of Bluetooth, use a USB-Serial adapter for the same functionality:
- No native modules needed (just regular serialport)
- More reliable connection
- Faster data transfer

## For Production Builds

When building distributable packages:

```bash
# Ensure native modules are compiled first
npx @electron/rebuild

# Then build
npm run build:linux  # or :mac, :win
```

The built package will include compiled native modules for the target platform.

## Platform-Specific Notes

### Linux
- Most straightforward
- `python3-distutils` package required
- No special permissions needed after pairing

### macOS
- Generally works out of the box
- Xcode Command Line Tools required
- May need to approve Bluetooth access in System Preferences

### Windows
- Python must be installed with "Add to PATH"
- Visual Studio Build Tools may be required
- Windows SDK needed for compilation

## Summary

**For now**: App works great without Bluetooth on localhost
**For later**: Install `python3-distutils` and rebuild when you need Bluetooth
**For production**: Pre-compile during build process
