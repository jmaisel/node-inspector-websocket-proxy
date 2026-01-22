/**
 * Bluetooth Serial Manager for BadgerBox/ESP32
 *
 * Manages persistent Bluetooth SPP connection to ESP32 device which bridges to Raspberry Pi UART.
 * Provides terminal access, command execution, and file transfer over serial.
 */

const { EventEmitter } = require('events');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

class BluetoothSerialManager extends EventEmitter {
    constructor() {
        super();
        this.port = null;
        this.parser = null;
        this.connected = false;
        this.autoReconnect = true;
        this.reconnectDelay = 5000;
        this.devicePath = null;
        this.commandQueue = [];
        this.currentCommand = null;
    }

    /**
     * Scan for available Bluetooth serial devices
     * @returns {Promise<Array>} List of available devices
     */
    async scanDevices() {
        try {
            const ports = await SerialPort.list();

            // Filter for Bluetooth devices (platform-specific)
            return ports.filter(port => {
                const name = (port.friendlyName || port.manufacturer || '').toLowerCase();
                const path = (port.path || '').toLowerCase();

                // Look for Bluetooth indicators
                return name.includes('bluetooth') ||
                       name.includes('badgerbox') ||
                       name.includes('esp32') ||
                       path.includes('bluetooth') ||
                       path.includes('rfcomm');
            });
        } catch (error) {
            console.error('Error scanning devices:', error);
            return [];
        }
    }

    /**
     * Connect to a Bluetooth serial device
     * @param {string} devicePath - Path to serial device (e.g., '/dev/rfcomm0', 'COM3')
     * @param {Object} options - Connection options
     */
    async connect(devicePath, options = {}) {
        if (this.connected) {
            console.warn('Already connected');
            return;
        }

        this.devicePath = devicePath;

        const portOptions = {
            path: devicePath,
            baudRate: options.baudRate || 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            autoOpen: false
        };

        return new Promise((resolve, reject) => {
            this.port = new SerialPort(portOptions);

            this.port.on('open', () => {
                console.log(`Connected to ${devicePath}`);
                this.connected = true;

                // Setup line parser for reading responses
                this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));
                this.parser.on('data', (line) => this.handleData(line));

                this.emit('connected', { path: devicePath });
                resolve();
            });

            this.port.on('error', (error) => {
                console.error('Serial port error:', error);
                this.emit('error', error);
                reject(error);
            });

            this.port.on('close', () => {
                console.log('Serial connection closed');
                this.connected = false;
                this.emit('disconnected');

                if (this.autoReconnect) {
                    console.log(`Reconnecting in ${this.reconnectDelay}ms...`);
                    setTimeout(() => {
                        this.connect(devicePath, options).catch(err => {
                            console.error('Reconnect failed:', err);
                        });
                    }, this.reconnectDelay);
                }
            });

            this.port.open();
        });
    }

    /**
     * Disconnect from device
     */
    async disconnect() {
        this.autoReconnect = false;

        if (this.port && this.port.isOpen) {
            return new Promise((resolve) => {
                this.port.close(() => {
                    this.port = null;
                    this.parser = null;
                    this.connected = false;
                    resolve();
                });
            });
        }
    }

    /**
     * Handle incoming data from serial
     */
    handleData(line) {
        const trimmed = line.trim();
        if (!trimmed) return;

        console.log('<<', trimmed);
        this.emit('data', trimmed);

        // If waiting for command response, handle it
        if (this.currentCommand) {
            this.currentCommand.output.push(trimmed);

            // Check if command is complete (customize based on your protocol)
            if (trimmed.includes('COMMAND_COMPLETE') || trimmed.includes('$ ')) {
                const output = this.currentCommand.output.join('\n');
                this.currentCommand.resolve(output);
                this.currentCommand = null;
                this.processQueue();
            }
        }
    }

    /**
     * Send raw data to serial port
     */
    async write(data) {
        if (!this.connected || !this.port) {
            throw new Error('Not connected');
        }

        return new Promise((resolve, reject) => {
            this.port.write(data, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Send a command and wait for response
     */
    async sendCommand(command, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const cmd = {
                command,
                output: [],
                resolve,
                reject,
                timeout: setTimeout(() => {
                    reject(new Error(`Command timeout: ${command}`));
                    this.currentCommand = null;
                    this.processQueue();
                }, timeout)
            };

            this.commandQueue.push(cmd);

            if (!this.currentCommand) {
                this.processQueue();
            }
        });
    }

    /**
     * Process command queue
     */
    async processQueue() {
        if (this.currentCommand || this.commandQueue.length === 0) {
            return;
        }

        this.currentCommand = this.commandQueue.shift();
        console.log('>>', this.currentCommand.command);

        try {
            await this.write(this.currentCommand.command + '\n');
        } catch (error) {
            this.currentCommand.reject(error);
            this.currentCommand = null;
            this.processQueue();
        }
    }

    /**
     * Transfer a file over serial (base64 encoded)
     */
    async transferFile(localPath, remotePath) {
        const fs = require('fs');
        const fileContent = fs.readFileSync(localPath);
        const base64 = fileContent.toString('base64');

        // Send in chunks to avoid buffer overflow
        const chunkSize = 512;
        const chunks = base64.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || [];

        this.emit('transfer-start', { file: remotePath, size: fileContent.length, chunks: chunks.length });

        // Create file on remote
        await this.sendCommand(`cat > ${remotePath}.b64 << 'PITHAGORAS_EOF'`);

        // Send chunks
        for (let i = 0; i < chunks.length; i++) {
            await this.write(chunks[i]);
            this.emit('transfer-progress', { chunk: i + 1, total: chunks.length });
        }

        // End heredoc
        await this.sendCommand('PITHAGORAS_EOF');

        // Decode base64
        await this.sendCommand(`base64 -d ${remotePath}.b64 > ${remotePath}`);
        await this.sendCommand(`rm ${remotePath}.b64`);

        this.emit('transfer-complete', { file: remotePath });
    }

    /**
     * Setup server on Raspberry Pi
     */
    async setupServer(serverArchivePath) {
        this.emit('setup-start');

        try {
            // Create temp directory
            await this.sendCommand('mkdir -p /tmp/pithagoras-setup');

            // Transfer server archive
            await this.transferFile(serverArchivePath, '/tmp/pithagoras-setup/server.tar.gz');

            // Extract
            await this.sendCommand('cd /tmp/pithagoras-setup && tar -xzf server.tar.gz');

            // Install dependencies
            this.emit('setup-status', 'Installing dependencies...');
            await this.sendCommand('cd /tmp/pithagoras-setup/server && npm install', 120000);

            // Move to final location
            await this.sendCommand('mkdir -p ~/pithagoras');
            await this.sendCommand('cp -r /tmp/pithagoras-setup/server ~/pithagoras/');

            // Create systemd service (optional)
            // await this.createService();

            // Start server
            this.emit('setup-status', 'Starting server...');
            await this.sendCommand('cd ~/pithagoras/server && npm start &');

            this.emit('setup-complete');

        } catch (error) {
            this.emit('setup-error', error);
            throw error;
        }
    }

    /**
     * Get Raspberry Pi status
     */
    async getStatus() {
        const hostname = await this.sendCommand('hostname');
        const ip = await this.sendCommand('hostname -I | awk \'{print $1}\'');
        const uptime = await this.sendCommand('uptime -p');

        return {
            hostname: hostname.trim(),
            ip: ip.trim(),
            uptime: uptime.trim()
        };
    }

    /**
     * Check if server is running
     */
    async isServerRunning() {
        try {
            const result = await this.sendCommand('curl -s http://localhost:8080/health');
            return result.includes('"status":"ok"');
        } catch (error) {
            return false;
        }
    }
}

module.exports = BluetoothSerialManager;
