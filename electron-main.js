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
const { spawn } = require('child_process');
const path = require('path');

let mainWindow = null;
let serverProcess = null;

// Server configuration
const SERVER_PORT = 8080;
let SERVER_HOST = 'localhost'; // Will be updated to Pi IP after setup
let SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;
let APP_URL = `${SERVER_URL}/app/index.html`;

/**
 * Start the local server process
 */
function startServer() {
    return new Promise((resolve, reject) => {
        console.log('Starting local server...');

        const serverPath = path.join(__dirname, 'server');
        const serverScript = path.join(serverPath, 'server.js');

        console.log('Server path:', serverPath);
        console.log('Server script:', serverScript);

        // Use node from PATH instead of electron executable
        const nodePath = 'node';

        console.log('Spawning server with node:', nodePath);

        // Spawn the server process
        serverProcess = spawn(nodePath, [serverScript], {
            cwd: serverPath,
            env: { ...process.env, NODE_ENV: 'production' },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let startupError = null;

        serverProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            console.log(`[Server] ${output}`);
        });

        serverProcess.stderr.on('data', (data) => {
            const output = data.toString().trim();
            console.error(`[Server Error] ${output}`);

            // Capture startup errors
            if (!startupError && output.includes('Error')) {
                startupError = output;
            }
        });

        serverProcess.on('error', (error) => {
            console.error('Failed to spawn server process:', error);
            startupError = error.message;
            reject(error);
        });

        serverProcess.on('exit', (code, signal) => {
            console.log(`Server process exited with code ${code} and signal ${signal}`);
            if (code !== 0 && code !== null) {
                console.error('Server exited with error code:', code);
                if (startupError) {
                    console.error('Startup error:', startupError);
                }
            }
            serverProcess = null;
        });

        // Wait a bit for server to start
        setTimeout(() => {
            if (serverProcess && !startupError) {
                console.log('Server startup initiated');
                resolve();
            } else if (startupError) {
                console.error('Server failed to start:', startupError);
                reject(new Error(`Server startup failed: ${startupError}`));
            } else {
                console.error('Server process died during startup');
                reject(new Error('Server process terminated during startup'));
            }
        }, 3000);
    });
}

/**
 * Stop the local server process
 */
function stopServer() {
    if (serverProcess) {
        console.log('Stopping local server...');
        serverProcess.kill();
        serverProcess = null;
    }
}

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
        'The local server failed to start automatically.\n\n' +
        'Troubleshooting:\n' +
        '1. Check if another server is already running on port 8080\n' +
        '2. Ensure server dependencies are installed:\n' +
        '   cd server && npm install\n' +
        '3. Check the console for error messages\n\n' +
        'Or start the server manually:\n' +
        '  cd server && npm start'
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

    // Start the local server
    try {
        await startServer();
    } catch (error) {
        console.error('Failed to start server:', error);
        dialog.showErrorBox(
            'Server Startup Failed',
            `Failed to start local server:\n\n${error.message}`
        );
        app.quit();
        return;
    }

    // Check if server is running (with retries)
    try {
        console.log(`Checking for server at ${SERVER_URL}...`);

        let serverAvailable = false;
        const maxRetries = 10;
        for (let i = 0; i < maxRetries; i++) {
            serverAvailable = await checkServer();
            if (serverAvailable) break;

            console.log(`Server not ready, retry ${i + 1}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (!serverAvailable) {
            console.error(`Server not available at ${SERVER_URL} after ${maxRetries} retries`);
            showServerNotAvailableDialog();
            stopServer();
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
        stopServer();
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
        stopServer();
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
    console.log('Application quitting, stopping server...');
    stopServer();
});

// Handle any uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
