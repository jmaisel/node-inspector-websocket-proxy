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
        this.terminalOutput = document.getElementById('bt-terminal-output');
        this.commandInput = document.getElementById('bt-command-input');

        // Setup button handlers
        if (this.connectButton) {
            this.connectButton.addEventListener('click', () => this.handleConnect());
        }

        if (this.disconnectButton) {
            this.disconnectButton.addEventListener('click', () => this.handleDisconnect());
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
    }

    /**
     * Handle connect button click
     */
    async handleConnect() {
        try {
            this.logger.info('User requesting connection');
            this.updateStatus('Requesting port selection...', 'info');

            // Request port from user
            const port = await this.manager.requestPort();

            this.updateStatus('Connecting...', 'info');

            // Connect to the port
            await this.manager.connect(port, {
                baudRate: 115200
            });

        } catch (error) {
            this.logger.error('Connection failed:', error);
            this.updateStatus('Connection failed: ' + error.message, 'error');
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
            statusText += ` (Bluetooth: ${info.bluetoothServiceClassId})`;
        }

        this.updateStatus(statusText, 'success');
        this.updateUIState(true);
        this.appendToTerminal('=== Connected to Bluetooth device ===');
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
