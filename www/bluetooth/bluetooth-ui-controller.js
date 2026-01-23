/**
 * Bluetooth UI Controller
 *
 * Manages the Bluetooth connection UI and coordinates with WebSerialBluetoothManager
 */

class BluetoothUIController {
    constructor() {
        this.manager = null;
        this.logger = new Logger('BluetoothUI');
        this.statusElement = null;
        this.connectButton = null;
        this.disconnectButton = null;
        this.terminalOutput = null;
        this.commandInput = null;
    }

    /**
     * Initialize the UI controller
     */
    initialize() {
        this.logger.info('Initializing Bluetooth UI');

        // Check if Web Serial is supported
        if (!WebSerialBluetoothManager.isSupported()) {
            this.logger.error('Web Serial API not supported');
            this.showError('Web Serial API not supported in this browser/Electron version');
            return;
        }

        // Create manager instance
        this.manager = new WebSerialBluetoothManager();

        // Setup event listeners on manager
        this.setupManagerEvents();

        // Setup UI elements
        this.setupUIElements();

        this.logger.info('Bluetooth UI initialized');
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
        // Get UI elements
        this.statusElement = document.getElementById('bt-status');
        this.connectButton = document.getElementById('bt-connect-btn');
        this.disconnectButton = document.getElementById('bt-disconnect-btn');
        this.refreshDevicesButton = document.getElementById('bt-refresh-devices-btn');
        this.devicesListElement = document.getElementById('bt-devices-list');
        this.terminalOutput = document.getElementById('bt-terminal-output');
        this.commandInput = document.getElementById('bt-command-input');

        // Setup button handlers
        if (this.connectButton) {
            this.connectButton.addEventListener('click', () => this.handleConnect());
        }

        if (this.disconnectButton) {
            this.disconnectButton.addEventListener('click', () => this.handleDisconnect());
        }

        if (this.refreshDevicesButton) {
            this.refreshDevicesButton.addEventListener('click', () => this.refreshDevicesList());
        }

        if (this.commandInput) {
            this.commandInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSendCommand();
                }
            });
        }

        // Initial UI state
        this.updateUIState(false);

        // Load devices list
        this.refreshDevicesList();
    }

    /**
     * Handle connect button click (select new device)
     */
    async handleConnect() {
        try {
            this.logger.info('User requesting new device selection');
            this.updateStatus('Opening device picker...', 'info');
            this.appendToTerminal('=== Opening device picker dialog ===');
            this.appendToTerminal('Look for a browser dialog to select your Bluetooth device...');

            // Request port from user - this shows the native browser picker
            const port = await this.manager.requestPort();

            this.updateStatus('Connecting...', 'info');

            // Connect to the port
            await this.manager.connect(port, {
                baudRate: 115200
            });

            // Refresh devices list to show the newly granted device
            await this.refreshDevicesList();

        } catch (error) {
            this.logger.error('Connection failed:', error);

            // Handle user cancellation gracefully
            if (error.name === 'NotFoundError' || error.message.includes('No port selected')) {
                this.updateStatus('No device selected', 'warning');
                this.appendToTerminal('=== Device selection cancelled ===');
                this.logger.info('User cancelled port selection');

                // Show helpful message
                alert('No device selected.\n\nMake sure:\n1. Your Bluetooth device is paired in OS settings\n2. You select a device from the picker dialog\n\nIf no devices appear in the picker, pair them in your OS Bluetooth settings first.');
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
        } catch (error) {
            this.logger.error('Disconnect failed:', error);
        }
    }

    /**
     * Refresh the devices list
     */
    async refreshDevicesList() {
        try {
            this.logger.info('Refreshing devices list');
            const ports = await this.manager.getGrantedPorts();

            if (!this.devicesListElement) {
                this.logger.warn('Devices list element not found');
                return;
            }

            if (ports.length === 0) {
                this.devicesListElement.innerHTML = `
                    <div class="devices-empty">
                        No devices granted yet.<br>
                        <br>
                        <strong>To connect:</strong><br>
                        1. Pair your Bluetooth device in OS settings<br>
                        2. Click "Select New Device" above<br>
                        3. Grant permission in the browser dialog
                    </div>
                `;
            } else {
                let html = '';
                for (let i = 0; i < ports.length; i++) {
                    const port = ports[i];
                    const info = port.getInfo();

                    const deviceName = info.bluetoothServiceClassId
                        ? `Bluetooth Device (${info.bluetoothServiceClassId.substring(0, 8)}...)`
                        : `Serial Device ${i + 1}`;

                    const details = info.usbVendorId
                        ? `USB VID:${info.usbVendorId} PID:${info.usbProductId}`
                        : (info.bluetoothServiceClassId ? 'Bluetooth Classic SPP' : 'Serial Port');

                    html += `
                        <div class="device-item">
                            <div class="device-info">
                                <div class="device-name">${deviceName}</div>
                                <div class="device-details">${details}</div>
                            </div>
                            <button class="device-connect-btn" data-port-index="${i}">
                                Connect
                            </button>
                        </div>
                    `;
                }
                this.devicesListElement.innerHTML = html;

                // Attach click handlers
                const connectButtons = this.devicesListElement.querySelectorAll('.device-connect-btn');
                connectButtons.forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const portIndex = parseInt(e.target.getAttribute('data-port-index'));
                        await this.handleConnectToPort(ports[portIndex]);
                    });
                });

                this.appendToTerminal(`=== Found ${ports.length} previously granted device(s) ===`);
            }
        } catch (error) {
            this.logger.error('Failed to refresh devices list:', error);
            if (this.devicesListElement) {
                this.devicesListElement.innerHTML = `
                    <div class="devices-empty" style="color: #c62828;">
                        Error loading devices: ${error.message}
                    </div>
                `;
            }
        }
    }

    /**
     * Handle connect to a specific port
     */
    async handleConnectToPort(port) {
        try {
            this.logger.info('Connecting to port');
            this.updateStatus('Connecting...', 'info');

            await this.manager.connect(port, {
                baudRate: 115200
            });
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
        let statusText = 'Connected';

        if (info.bluetoothServiceClassId) {
            statusText += ` (Bluetooth)`;
        }

        this.updateStatus(statusText, 'success');
        this.updateUIState(true);
        this.appendToTerminal('=== Connected to Bluetooth device ===');

        // Refresh devices list
        this.refreshDevicesList();
    }

    /**
     * Handle disconnection
     */
    onDisconnected() {
        this.updateStatus('Disconnected', 'warning');
        this.updateUIState(false);
        this.appendToTerminal('=== Disconnected ===');
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
        if (this.connectButton) {
            this.connectButton.disabled = connected;
        }

        if (this.disconnectButton) {
            this.disconnectButton.disabled = !connected;
        }

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
        alert('Bluetooth Error: ' + message);
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
