/**
 * Electron Main Process
 *
 * This file serves as the entry point for the Electron application.
 * It connects to an external server running on Raspberry Pi via WiFi.
 *
 * The Bluetooth connection to ESP32/BadgerBox provides:
 * - Initial setup and configuration
 * - Persistent control channel (out-of-band management)
 * - Terminal access to Raspberry Pi
 * - File transfers when needed
 *
 * The server directory is bundled with the app for transfer to Raspberry Pi.
 */

const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const http = require('http');

let mainWindow = null;

// Server configuration
const SERVER_PORT = 8080;
let SERVER_HOST = 'localhost'; // Will be updated to Pi IP after setup
let SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;
let APP_URL = `${SERVER_URL}/app/index.html`;

/**
 * Check if the server is running
 */
async function checkServer() {
    return new Promise((resolve) => {
        const req = http.get(`${SERVER_URL}/health`, (res) => {
            resolve(res.statusCode === 200);
        });

        req.on('error', () => {
            resolve(false);
        });

        req.setTimeout(2000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

/**
 * Show error dialog when server is not available
 */
function showServerNotAvailableDialog() {
    dialog.showErrorBox(
        'Server Not Running',
        `Cannot connect to server at ${SERVER_URL}\n\n` +
        'Please start the server first:\n' +
        '  cd server && npm start\n\n' +
        'Or on Raspberry Pi:\n' +
        '  npm start'
    );
}

async function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            enableBlinkFeatures: 'Serial',  // Enable Web Serial API
            preload: require('path').join(__dirname, 'electron-preload.js')
        },
        title: 'Pithagoras - GPIO Simulator',
        autoHideMenuBar: true
    });

    // Enable Serial API permissions
    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
        if (permission === 'serial') {
            return true;
        }
        return false;
    });

    mainWindow.webContents.session.setDevicePermissionHandler((details) => {
        if (details.deviceType === 'serial') {
            return true;
        }
        return false;
    });

    // Hide menu bar completely
    Menu.setApplicationMenu(null);

    // Check if server is running
    try {
        console.log(`Checking for server at ${SERVER_URL}...`);
        const serverAvailable = await checkServer();

        if (!serverAvailable) {
            console.error(`Server not available at ${SERVER_URL}`);
            showServerNotAvailableDialog();
            app.quit();
            return;
        }

        console.log('Server is available, loading application...');
        console.log(`Loading application from ${APP_URL}`);
        await mainWindow.loadURL(APP_URL);

        // Open DevTools in development mode
        if (process.env.NODE_ENV === 'development') {
            mainWindow.webContents.openDevTools();
        }
    } catch (error) {
        console.error('Failed to connect to server:', error);
        showServerNotAvailableDialog();
        app.quit();
    }

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/**
 * Setup IPC handlers
 */
function setupIPCHandlers() {
    // Update server host
    ipcMain.handle('set-server-host', async (event, host) => {
        SERVER_HOST = host;
        SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;
        APP_URL = `${SERVER_URL}/app/index.html`;
        return { success: true };
    });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
    setupIPCHandlers();
    createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    // On macOS it is common for applications to stay open until the user explicitly quits
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Cleanup when quitting
app.on('before-quit', async () => {
    // Cleanup if needed
});

// Handle any uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
