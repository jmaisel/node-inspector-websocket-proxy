/**
 * Serial Connection UI Controller
 *
 * Manages both Bluetooth and Serial port connections using Web Serial API
 */

class BluetoothUIController {
    constructor() {
        this.manager = new WebSerialBluetoothManager();
        this.logger = new Logger('SerialUI');
        this.currentConnectionType = null; // 'bluetooth', 'serial', or 'local-server'
        this.localServerConnected = false;

        // UI Elements
        this.statusElement = null;
        this.terminalOutput = null;
        this.commandInput = null;
    }

    /**
     * Initialize the UI controller
     */
    async initialize() {
        this.logger.info('Initializing Serial UI');

        // Check if Web Serial API is available
        if (!navigator.serial) {
            this.showError('Web Serial API not available. Requires Chrome/Electron with Serial support.');
            return;
        }

        // Setup event listeners on manager
        this.setupManagerEvents();

        // Setup UI elements
        this.setupUIElements();

        // Initialize tabs
        this.initializeTabs();

        this.logger.info('Serial UI initialized');
    }

    /**
     * Initialize jQuery UI tabs
     */
    initializeTabs() {
        const tabsElement = $('#bluetooth-tabs');
        if (tabsElement.length) {
            tabsElement.tabs();
            this.logger.info('Tabs initialized');
        }
    }

    /**
     * Setup manager event listeners
     */
    setupManagerEvents() {
        this.manager.addEventListener('connected', (event) => {
            this.logger.info('Connected:', event.detail);
            this.onConnected(event.detail);
        });

        this.manager.addEventListener('disconnected', () => {
            this.logger.info('Disconnected');
            this.onDisconnected();
        });

        this.manager.addEventListener('data', (event) => {
            this.onData(event.detail.line);
        });

        this.manager.addEventListener('error', (event) => {
            this.logger.error('Manager error:', event.detail.error);
            this.showError(event.detail.error.message);
        });
    }

    /**
     * Setup UI element references and handlers
     */
    setupUIElements() {
        // Status
        this.statusElement = document.getElementById('bt-status');

        // Terminal
        this.terminalOutput = document.getElementById('terminal-output');
        this.commandInput = document.getElementById('terminal-command-input');

        if (this.commandInput) {
            this.commandInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSendCommand();
                }
            });
        }

        // Clear terminal button
        const clearBtn = document.getElementById('terminal-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearTerminal());
        }

        // === BLUETOOTH TAB ===
        const btSelectBtn = document.getElementById('bt-select-device-btn');
        const btDisconnectBtn = document.getElementById('bt-disconnect-btn');
        const btRefreshBtn = document.getElementById('bt-refresh-devices-btn');
        const btBaudrateInput = document.getElementById('bt-baudrate');

        if (btSelectBtn) {
            btSelectBtn.addEventListener('click', () => this.handleSelectDevice('bluetooth'));
        }
        if (btDisconnectBtn) {
            btDisconnectBtn.addEventListener('click', () => this.handleDisconnect());
        }
        if (btRefreshBtn) {
            btRefreshBtn.addEventListener('click', () => this.refreshDevicesList('bluetooth'));
        }

        // === SERIAL TAB ===
        const serialSelectBtn = document.getElementById('serial-select-device-btn');
        const serialDisconnectBtn = document.getElementById('serial-disconnect-btn');
        const serialRefreshBtn = document.getElementById('serial-refresh-devices-btn');
        const serialBaudrateInput = document.getElementById('serial-baudrate');

        if (serialSelectBtn) {
            serialSelectBtn.addEventListener('click', () => this.handleSelectDevice('serial'));
        }
        if (serialDisconnectBtn) {
            serialDisconnectBtn.addEventListener('click', () => this.handleDisconnect());
        }
        if (serialRefreshBtn) {
            serialRefreshBtn.addEventListener('click', () => this.refreshDevicesList('serial'));
        }

        // Initial UI state
        this.updateUIState(false);

        // Load both device lists
        this.refreshDevicesList('bluetooth');
        this.refreshDevicesList('serial');
    }

    /**
     * Handle select new device button click
     */
    async handleSelectDevice(type) {
        try {
            this.logger.info(`User requesting new ${type} device selection`);
            this.updateStatus('Opening device picker...', 'info');
            this.appendToTerminal(`=== Opening ${type} device picker dialog ===`);

            // Get baud rate from appropriate input
            const baudrateInput = type === 'bluetooth'
                ? document.getElementById('bt-baudrate')
                : document.getElementById('serial-baudrate');
            const baudRate = baudrateInput ? parseInt(baudrateInput.value) : 115200;

            // Request port from user - this shows the native browser picker
            const port = await this.manager.requestPort();

            this.updateStatus('Connecting...', 'info');

            // Connect to the port
            await this.manager.connect(port, { baudRate });

            this.currentConnectionType = type;

            // Refresh devices list to show the newly granted device
            await this.refreshDevicesList(type);

        } catch (error) {
            this.logger.error('Connection failed:', error);

            // Handle user cancellation gracefully
            if (error.name === 'NotFoundError' || error.message.includes('No port selected')) {
                this.updateStatus('No device selected', 'warning');
                this.appendToTerminal('=== Device selection cancelled ===');
                this.logger.info('User cancelled port selection');
            } else {
                this.updateStatus('Connection failed: ' + error.message, 'error');
                this.appendToTerminal('=== Connection failed: ' + error.message + ' ===');
                alert('Connection failed: ' + error.message);
            }
        }
    }

    /**
     * Handle disconnect button click
     */
    async handleDisconnect() {
        try {
            this.logger.info('User requesting disconnection');
            await this.manager.disconnect();
            this.currentConnectionType = null;
        } catch (error) {
            this.logger.error('Disconnect failed:', error);
        }
    }

    /**
     * Refresh the devices list
     */
    async refreshDevicesList(type) {
        try {
            this.logger.info(`Refreshing ${type} devices list`);
            const ports = await this.manager.getGrantedPorts();

            const listElement = type === 'bluetooth'
                ? document.getElementById('bt-devices-list')
                : document.getElementById('serial-devices-list');

            if (!listElement) {
                this.logger.warn(`${type} devices list element not found`);
                return;
            }

            const baudrateInput = type === 'bluetooth'
                ? document.getElementById('bt-baudrate')
                : document.getElementById('serial-baudrate');

            if (ports.length === 0) {
                listElement.innerHTML = `
                    <div class="devices-empty">
                        No devices granted yet.<br>
                        <br>
                        Click "Select ${type === 'bluetooth' ? 'Bluetooth Device' : 'Serial Port'}" above to connect.
                    </div>
                `;
            } else {
                let html = '';
                for (let i = 0; i < ports.length; i++) {
                    const port = ports[i];
                    const info = port.getInfo();

                    const deviceName = info.bluetoothServiceClassId
                        ? `Bluetooth Device (${info.bluetoothServiceClassId.substring(0, 8)}...)`
                        : (info.usbVendorId
                            ? `USB Serial (VID:${info.usbVendorId.toString(16)})`
                            : `Serial Device ${i + 1}`);

                    const details = info.usbVendorId
                        ? `USB VID:${info.usbVendorId} PID:${info.usbProductId}`
                        : (info.bluetoothServiceClassId ? 'Bluetooth Classic SPP' : 'Serial Port');

                    html += `
                        <div class="device-item">
                            <div class="device-info">
                                <div class="device-name">${deviceName}</div>
                                <div class="device-details">${details}</div>
                            </div>
                            <button class="device-connect-btn" data-port-index="${i}" data-connection-type="${type}">
                                Connect
                            </button>
                        </div>
                    `;
                }
                listElement.innerHTML = html;

                // Attach click handlers
                const connectButtons = listElement.querySelectorAll('.device-connect-btn');
                connectButtons.forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const portIndex = parseInt(e.target.getAttribute('data-port-index'));
                        const connectionType = e.target.getAttribute('data-connection-type');
                        await this.handleConnectToPort(ports[portIndex], connectionType, baudrateInput);
                    });
                });
            }
        } catch (error) {
            this.logger.error(`Failed to refresh ${type} devices list:`, error);
        }
    }

    /**
     * Handle connect to a specific port
     */
    async handleConnectToPort(port, type, baudrateInput) {
        try {
            this.logger.info('Connecting to port');
            this.updateStatus('Connecting...', 'info');

            const baudRate = baudrateInput ? parseInt(baudrateInput.value) : 115200;

            await this.manager.connect(port, { baudRate });

            this.currentConnectionType = type;
        } catch (error) {
            this.logger.error('Connection failed:', error);
            this.updateStatus('Connection failed: ' + error.message, 'error');
            alert('Connection failed: ' + error.message);
        }
    }

    /**
     * Handle send command
     */
    async handleSendCommand() {
        if (!this.commandInput || !this.manager.isConnected()) {
            return;
        }

        const command = this.commandInput.value.trim();
        if (!command) {
            return;
        }

        try {
            this.logger.info('Sending command:', command);
            this.appendToTerminal('> ' + command);
            this.commandInput.value = '';

            const response = await this.manager.sendCommand(command);
            this.appendToTerminal(response);

        } catch (error) {
            this.logger.error('Command failed:', error);
            this.appendToTerminal('ERROR: ' + error.message);
        }
    }

    /**
     * Handle connection established
     */
    onConnected(detail) {
        const info = detail.portInfo;
        let statusText = `Connected via ${this.currentConnectionType || 'serial'}`;

        this.updateStatus(statusText, 'success');
        this.updateUIState(true);
        this.appendToTerminal(`=== Connected ===`);

        // Refresh both device lists
        this.refreshDevicesList('bluetooth');
        this.refreshDevicesList('serial');
    }

    /**
     * Handle disconnection
     */
    onDisconnected() {
        this.updateStatus('Disconnected', 'warning');
        this.updateUIState(false);
        this.appendToTerminal('=== Disconnected ===');

        // If this was a local server connection, re-enable mode button
        if (this.currentConnectionType === 'local-server') {
            this.enableModeButton();
            this.updateLocalServerUIState(false);
            this.updateLocalServerStatus('Disconnected from local server', 'warning');
            this.localServerConnected = false;
        }

        this.currentConnectionType = null;
    }

    /**
     * Handle incoming data
     */
    onData(line) {
        this.appendToTerminal(line);
    }

    /**
     * Update status display
     */
    updateStatus(message, type = 'info') {
        if (!this.statusElement) return;

        this.statusElement.textContent = message;
        this.statusElement.className = 'bt-status bt-status-' + type;
    }

    /**
     * Update UI state based on connection status
     */
    updateUIState(connected) {
        // Bluetooth tab buttons
        const btSelectBtn = document.getElementById('bt-select-device-btn');
        const btDisconnectBtn = document.getElementById('bt-disconnect-btn');

        if (btSelectBtn) btSelectBtn.disabled = connected;
        if (btDisconnectBtn) btDisconnectBtn.disabled = !connected;

        // Serial tab buttons
        const serialSelectBtn = document.getElementById('serial-select-device-btn');
        const serialDisconnectBtn = document.getElementById('serial-disconnect-btn');

        if (serialSelectBtn) serialSelectBtn.disabled = connected;
        if (serialDisconnectBtn) serialDisconnectBtn.disabled = !connected;

        // Terminal input
        if (this.commandInput) {
            this.commandInput.disabled = !connected;
        }
    }

    /**
     * Append text to terminal output
     */
    appendToTerminal(text) {
        if (!this.terminalOutput) return;

        const line = document.createElement('div');
        line.textContent = text;
        this.terminalOutput.appendChild(line);

        // Auto-scroll to bottom
        this.terminalOutput.scrollTop = this.terminalOutput.scrollHeight;

        // Limit terminal output (keep last 1000 lines)
        while (this.terminalOutput.children.length > 1000) {
            this.terminalOutput.removeChild(this.terminalOutput.firstChild);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        this.updateStatus('Error: ' + message, 'error');
        alert('Serial Error: ' + message);
    }

    /**
     * Clear terminal output
     */
    clearTerminal() {
        if (this.terminalOutput) {
            this.terminalOutput.innerHTML = '';
        }
    }

    /**
     * Handle connect to local server
     */
    async handleConnectLocalServer() {
        try {
            // Always use localhost for local server
            // Note: Port 8888 is the debugger proxy port, not 8080 (HTTP server port)
            const wsUrl = 'ws://localhost:8888';

            this.logger.info('Connecting to local server:', wsUrl);
            this.updateStatus('Connecting to local server...', 'info');
            this.updateLocalServerStatus('Connecting to localhost:8888...', 'info');

            // Get the debugger connection helper
            const aceController = window.application?.aceController;
            if (!aceController) {
                throw new Error('AceController not available - application not initialized');
            }
            if (!aceController.debuggerConnectionHelper) {
                throw new Error('Debugger connection helper not available on AceController');
            }

            // Connect to the debugger directly
            aceController.debuggerConnectionHelper.connectToDebugger(wsUrl);

            // Set connection type and update UI
            this.currentConnectionType = 'local-server';
            this.localServerConnected = true;

            // Update local server UI
            this.updateLocalServerUIState(true);
            this.updateStatus('Connected to local server', 'success');
            this.updateLocalServerStatus('Connected to localhost:8888', 'success');

            // Disable the mode button
            this.disableModeButton();

            this.logger.info('Local server connection initiated');

        } catch (error) {
            this.logger.error('Local server connection failed:', error);
            this.logger.error('Error stack:', error.stack);
            this.updateStatus('Connection failed: ' + error.message, 'error');
            this.updateLocalServerStatus('Connection failed: ' + error.message, 'error');
            alert('Failed to connect to local server:\n\n' + error.message + '\n\nCheck console for details.');
        }
    }

    /**
     * Handle disconnect from local server
     */
    async handleDisconnectLocalServer() {
        try {
            this.logger.info('Disconnecting from local server');

            // Get the inspector proxy and disconnect
            const aceController = window.application?.aceController;
            if (aceController && aceController.inspectorProxy && aceController.inspectorProxy.ws) {
                aceController.inspectorProxy.ws.close();
            }

            this.localServerConnected = false;
            this.currentConnectionType = null;

            this.updateLocalServerUIState(false);
            this.updateStatus('Disconnected from local server', 'warning');
            this.updateLocalServerStatus('Not connected to local server', 'info');

            // Re-enable the mode button
            this.enableModeButton();

            this.logger.info('Disconnected from local server');

        } catch (error) {
            this.logger.error('Local server disconnection failed:', error);
            this.updateStatus('Disconnection failed: ' + error.message, 'error');
        }
    }

    /**
     * Update local server UI state
     */
    updateLocalServerUIState(connected) {
        const connectBtn = document.getElementById('local-server-connect-btn');
        const disconnectBtn = document.getElementById('local-server-disconnect-btn');

        if (connectBtn) connectBtn.disabled = connected;
        if (disconnectBtn) disconnectBtn.disabled = !connected;
    }

    /**
     * Update local server status message
     */
    updateLocalServerStatus(message, type = 'info') {
        const statusMsg = document.getElementById('local-server-status-message');
        if (!statusMsg) return;

        statusMsg.textContent = message;

        // Update style based on type
        statusMsg.style.color = type === 'success' ? '#4caf50' :
                                type === 'error' ? '#f44336' :
                                type === 'warning' ? '#ff9800' : '#b0b0b0';
    }

    /**
     * Disable the mode button (for local dev mode)
     */
    disableModeButton() {
        const modeBtn = document.getElementById('mode-menu-btn');
        if (modeBtn) {
            modeBtn.disabled = true;
            modeBtn.style.opacity = '0.5';
            modeBtn.style.cursor = 'not-allowed';
            modeBtn.title = 'Mode switching disabled in local development mode';
            this.logger.info('Mode button disabled for local dev mode');
        }
    }

    /**
     * Enable the mode button
     */
    enableModeButton() {
        const modeBtn = document.getElementById('mode-menu-btn');
        if (modeBtn) {
            modeBtn.disabled = false;
            modeBtn.style.opacity = '1';
            modeBtn.style.cursor = 'pointer';
            modeBtn.title = 'Mode';
            this.logger.info('Mode button enabled');
        }
    }

    /**
     * Auto-connect to previously granted port if available
     */
    async autoConnect() {
        try {
            const ports = await this.manager.getGrantedPorts();

            if (ports.length > 0) {
                this.logger.info('Found granted port, auto-connecting...');
                this.updateStatus('Auto-connecting...', 'info');
                await this.manager.connect(ports[0], { baudRate: 115200 });
            } else {
                this.logger.info('No previously granted ports found');
            }
        } catch (error) {
            this.logger.warn('Auto-connect failed:', error);
        }
    }
}

// Make available globally
window.BluetoothUIController = BluetoothUIController;
