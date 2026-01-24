/**
 * Electron Preload Script
 *
 * Exposes secure IPC API to renderer process for Bluetooth communication
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose server configuration API
contextBridge.exposeInMainWorld('server', {
    setHost: (host) => ipcRenderer.invoke('set-server-host', host)
});

// Detect if running in Electron
contextBridge.exposeInMainWorld('isElectron', true);
