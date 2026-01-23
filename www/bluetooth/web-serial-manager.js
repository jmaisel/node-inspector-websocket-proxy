/**
 * Web Serial Bluetooth Manager for BadgerBox/ESP32
 *
 * Uses the Web Serial API (Chrome 117+) to communicate with Bluetooth Classic
 * Serial Port Profile (SPP) devices. Works directly in the renderer process
 * without requiring native Node.js modules.
 *
 * Supports:
 * - Bluetooth Classic RFCOMM/SPP devices
 * - Automatic reconnection
 * - Command queuing
 * - Line-based protocol parsing
 */

class WebSerialBluetoothManager extends EventTarget {
    constructor() {
        super();
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.connected = false;
        this.autoReconnect = true;
        this.reconnectDelay = 5000;
        this.commandQueue = [];
        this.currentCommand = null;
        this.readBuffer = '';
        this.logger = new Logger('WebSerialBT');
    }

    /**
     * Check if Web Serial API is available
     * @returns {boolean}
     */
    static isSupported() {
        return 'serial' in navigator;
    }

    /**
     * Get list of already granted serial ports
     * @returns {Promise<Array>} List of SerialPort objects
     */
    async getGrantedPorts() {
        if (!WebSerialBluetoothManager.isSupported()) {
            throw new Error('Web Serial API not supported');
        }

        try {
            const ports = await navigator.serial.getPorts();
            this.logger.info(`Found ${ports.length} granted ports`);
            return ports;
        } catch (error) {
            this.logger.error('Error getting granted ports:', error);
            return [];
        }
    }

    /**
     * Request user to select a Bluetooth serial port
     * @param {Object} options - Request options
     * @returns {Promise<SerialPort>}
     */
    async requestPort(options = {}) {
        if (!WebSerialBluetoothManager.isSupported()) {
            throw new Error('Web Serial API not supported');
        }

        try {
            // Request port with optional Bluetooth service class ID filters
            const requestOptions = {};

            // If custom Bluetooth service class IDs are provided
            if (options.allowedBluetoothServiceClassIds) {
                requestOptions.allowedBluetoothServiceClassIds = options.allowedBluetoothServiceClassIds;
            }

            if (options.filters) {
                requestOptions.filters = options.filters;
            }

            this.logger.info('Requesting serial port selection...');
            const port = await navigator.serial.requestPort(requestOptions);

            // Get port info
            const info = port.getInfo();
            this.logger.info('Port selected:', info);

            return port;
        } catch (error) {
            if (error.name === 'NotFoundError') {
                this.logger.warn('User cancelled port selection');
            } else {
                this.logger.error('Error requesting port:', error);
            }
            throw error;
        }
    }

    /**
     * Connect to a serial port
     * @param {SerialPort} port - Port object from requestPort() or getPorts()
     * @param {Object} options - Connection options
     */
    async connect(port, options = {}) {
        if (this.connected) {
            this.logger.warn('Already connected');
            return;
        }

        if (!port) {
            throw new Error('Port is required');
        }

        this.port = port;

        const portOptions = {
            baudRate: options.baudRate || 115200,
            dataBits: options.dataBits || 8,
            stopBits: options.stopBits || 1,
            parity: options.parity || 'none',
            flowControl: options.flowControl || 'none'
        };

        try {
            this.logger.info('Opening port with options:', portOptions);
            await this.port.open(portOptions);

            this.connected = true;
            const info = this.port.getInfo();
            this.logger.info('Connected to port:', info);

            // Start reading
            this.startReading();

            // Setup writer
            this.writer = this.port.writable.getWriter();

            this.dispatchEvent(new CustomEvent('connected', {
                detail: { portInfo: info }
            }));

        } catch (error) {
            this.logger.error('Failed to connect:', error);
            this.connected = false;
            throw error;
        }
    }

    /**
     * Start reading from the port
     */
    async startReading() {
        if (!this.port || !this.port.readable) {
            this.logger.error('Port not readable');
            return;
        }

        try {
            this.reader = this.port.readable.getReader();
            this.logger.info('Started reading from port');

            while (true) {
                const { value, done } = await this.reader.read();

                if (done) {
                    this.logger.info('Reader closed');
                    break;
                }

                if (value) {
                    await this.handleData(value);
                }
            }
        } catch (error) {
            this.logger.error('Read error:', error);
            this.dispatchEvent(new CustomEvent('error', { detail: { error } }));
        } finally {
            if (this.reader) {
                this.reader.releaseLock();
                this.reader = null;
            }
            await this.handleDisconnection();
        }
    }

    /**
     * Handle incoming data
     * @param {Uint8Array} data
     */
    async handleData(data) {
        // Convert Uint8Array to string
        const text = new TextDecoder().decode(data);
        this.readBuffer += text;

        // Process complete lines
        let newlineIndex;
        while ((newlineIndex = this.readBuffer.indexOf('\n')) !== -1) {
            const line = this.readBuffer.substring(0, newlineIndex).trim();
            this.readBuffer = this.readBuffer.substring(newlineIndex + 1);

            if (line) {
                this.logger.debug('RX:', line);
                this.dispatchEvent(new CustomEvent('data', { detail: { line } }));

                // Handle command responses
                if (this.currentCommand) {
                    this.currentCommand.output += line + '\n';

                    // Check for command completion (customize based on your protocol)
                    if (line.includes('OK') || line.includes('ERROR') || line.includes('>')) {
                        const command = this.currentCommand;
                        this.currentCommand = null;

                        command.resolve(command.output);

                        // Process next command in queue
                        this.processNextCommand();
                    }
                }
            }
        }
    }

    /**
     * Write data to the port
     * @param {string|Uint8Array} data
     */
    async write(data) {
        if (!this.connected || !this.writer) {
            throw new Error('Not connected');
        }

        try {
            let bytes;
            if (typeof data === 'string') {
                bytes = new TextEncoder().encode(data);
            } else {
                bytes = data;
            }

            await this.writer.write(bytes);
            this.logger.debug('TX:', data);
        } catch (error) {
            this.logger.error('Write error:', error);
            throw error;
        }
    }

    /**
     * Send a command and wait for response
     * @param {string} command
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<string>}
     */
    async sendCommand(command, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const commandObj = {
                command,
                output: '',
                resolve,
                reject,
                timeout: setTimeout(() => {
                    reject(new Error(`Command timeout: ${command}`));
                    this.currentCommand = null;
                    this.processNextCommand();
                }, timeout)
            };

            this.commandQueue.push(commandObj);

            if (!this.currentCommand) {
                this.processNextCommand();
            }
        });
    }

    /**
     * Process next command in queue
     */
    async processNextCommand() {
        if (this.currentCommand || this.commandQueue.length === 0) {
            return;
        }

        this.currentCommand = this.commandQueue.shift();

        try {
            await this.write(this.currentCommand.command + '\n');
        } catch (error) {
            this.currentCommand.reject(error);
            this.currentCommand = null;
            this.processNextCommand();
        }
    }

    /**
     * Handle disconnection
     */
    async handleDisconnection() {
        this.logger.info('Handling disconnection');
        this.connected = false;

        // Clean up writer
        if (this.writer) {
            try {
                this.writer.releaseLock();
            } catch (e) {
                // Ignore
            }
            this.writer = null;
        }

        this.dispatchEvent(new CustomEvent('disconnected'));

        // Auto-reconnect if enabled
        if (this.autoReconnect && this.port) {
            this.logger.info(`Reconnecting in ${this.reconnectDelay}ms...`);
            setTimeout(() => this.reconnect(), this.reconnectDelay);
        }
    }

    /**
     * Attempt to reconnect
     */
    async reconnect() {
        if (!this.port) {
            this.logger.warn('Cannot reconnect: no port stored');
            return;
        }

        try {
            this.logger.info('Attempting to reconnect...');
            await this.connect(this.port);
        } catch (error) {
            this.logger.error('Reconnect failed:', error);
            if (this.autoReconnect) {
                setTimeout(() => this.reconnect(), this.reconnectDelay);
            }
        }
    }

    /**
     * Disconnect from the port
     */
    async disconnect() {
        this.autoReconnect = false;

        if (this.reader) {
            try {
                await this.reader.cancel();
            } catch (e) {
                this.logger.warn('Error cancelling reader:', e);
            }
        }

        if (this.writer) {
            try {
                this.writer.releaseLock();
            } catch (e) {
                this.logger.warn('Error releasing writer:', e);
            }
            this.writer = null;
        }

        if (this.port) {
            try {
                await this.port.close();
                this.logger.info('Port closed');
            } catch (error) {
                this.logger.error('Error closing port:', error);
            }
            this.port = null;
        }

        this.connected = false;
        this.dispatchEvent(new CustomEvent('disconnected'));
    }

    /**
     * Get port information
     * @returns {Object|null}
     */
    getPortInfo() {
        if (!this.port) {
            return null;
        }
        return this.port.getInfo();
    }

    /**
     * Check if connected
     * @returns {boolean}
     */
    isConnected() {
        return this.connected;
    }
}

// Make available globally
window.WebSerialBluetoothManager = WebSerialBluetoothManager;
