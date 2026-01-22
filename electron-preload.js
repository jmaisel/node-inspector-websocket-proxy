/**
 * Electron Preload Script
 *
 * Exposes secure IPC API to renderer process for Bluetooth communication
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose Bluetooth API to renderer
contextBridge.exposeInMainWorld('bluetooth', {
    // Scan for devices
    scan: () => ipcRenderer.invoke('bluetooth-scan'),

    // Connect to device
    connect: (devicePath) => ipcRenderer.invoke('bluetooth-connect', devicePath),

    // Send command
    sendCommand: (command) => ipcRenderer.invoke('bluetooth-command', command),

    // Get Pi status
    getStatus: () => ipcRenderer.invoke('bluetooth-get-status'),

    // Setup server on Pi
    setupServer: (serverArchivePath) => ipcRenderer.invoke('bluetooth-setup-server', serverArchivePath),

    // Event listeners
    onConnected: (callback) => ipcRenderer.on('bluetooth-connected', (event, info) => callback(info)),
    onDisconnected: (callback) => ipcRenderer.on('bluetooth-disconnected', () => callback()),
    onData: (callback) => ipcRenderer.on('bluetooth-data', (event, data) => callback(data)),
    onSetupStatus: (callback) => ipcRenderer.on('setup-status', (event, status) => callback(status))
});

// Expose server configuration API
contextBridge.exposeInMainWorld('server', {
    setHost: (host) => ipcRenderer.invoke('set-server-host', host)
});

// Detect if running in Electron
contextBridge.exposeInMainWorld('isElectron', true);
