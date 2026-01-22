/**
 * Pithagoras GPIO Library
 * Provides a clean API for controlling GPIO pins in CircuitJS1 simulator or real hardware
 *
 * Usage:
 *   const GPIO = require('pithagoras-gpio');
 *   const gpio = new GPIO({ mode: 'simulator' }); // or 'hardware'
 *
 *   gpio.pin(17).input();
 *   const value = gpio.pin(17).read();
 *
 *   gpio.pin(22).output();
 *   gpio.pin(22).high();
 *   gpio.pin(22).onChange((state, voltage) => {
 *       console.log('GPIO22 changed:', state, voltage);
 *   });
 */

const WebSocket = require('ws');

class PithagorasGPIO {
    constructor(options = {}) {
        this.mode = options.mode || 'simulator'; // 'simulator' or 'hardware'
        this.serverUrl = options.serverUrl || 'ws://localhost:8081';
        this.clientName = options.clientName || 'GPIO Client';
        this.autoReconnect = options.autoReconnect !== false;
        this.reconnectDelay = options.reconnectDelay || 3000;

        this.ws = null;
        this.connected = false;
        this.registered = false;
        this.simulatorConnected = false;
        this.reconnectTimer = null;

        this.nextMessageId = 1;
        this.pendingRequests = new Map(); // messageId → { resolve, reject }
        this.pins = new Map(); // pinNumber → GPIOPin

        this.eventHandlers = new Map(); // pinName → Set of callbacks
        this.connectionPromise = null; // Track connection promise

        // Auto-connect when mode is simulator
        if (this.mode === 'simulator') {
            this.connectionPromise = this.connect();
        } else if (this.mode === 'hardware') {
            throw new Error('Hardware mode not implemented yet - coming soon!');
        }
    }

    /**
     * Connect to GPIO WebSocket server
     */
    connect() {
        return new Promise((resolve, reject) => {
            if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
                console.warn('PithagorasGPIO: Already connected or connecting');
                resolve();
                return;
            }

            console.log(`PithagorasGPIO: Connecting to ${this.serverUrl}`);

            try {
                this.ws = new WebSocket(this.serverUrl);

                this.ws.on('open', () => {
                    console.log('PithagorasGPIO: Connected');
                    this.connected = true;

                    // Register as GPIO client
                    this.send({
                        type: 'register',
                        role: 'gpio-client',
                        name: this.clientName
                    });
                });

                this.ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('PithagorasGPIO: Parse error:', error);
                    }
                });

                this.ws.on('close', (code, reason) => {
                    console.log('PithagorasGPIO: Disconnected', code, reason.toString());
                    this.connected = false;
                    this.registered = false;
                    this.simulatorConnected = false;

                    if (this.autoReconnect && code !== 1000) { // 1000 = normal closure
                        console.log(`PithagorasGPIO: Reconnecting in ${this.reconnectDelay}ms`);
                        this.reconnectTimer = setTimeout(() => {
                            this.connectionPromise = this.connect();
                            this.connectionPromise.catch(err => console.error('Reconnect failed:', err));
                        }, this.reconnectDelay);
                    }
                });

                this.ws.on('error', (error) => {
                    console.error('PithagorasGPIO: WebSocket error:', error);
                    reject(error);
                });

                // Resolve when registered
                const waitForRegistration = () => {
                    if (this.registered) {
                        resolve();
                    } else {
                        setTimeout(waitForRegistration, 100);
                    }
                };
                setTimeout(waitForRegistration, 100);

            } catch (error) {
                console.error('PithagorasGPIO: Connection failed:', error);
                reject(error);
            }
        });
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        this.autoReconnect = false;

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }

        this.connected = false;
        this.registered = false;
    }

    /**
     * Handle incoming message from server
     */
    handleMessage(message) {
        switch (message.type) {
            case 'registered':
                console.log('PithagorasGPIO: Registered as', message.role, `(clientId: ${message.clientId})`);
                this.registered = true;
                break;

            case 'response':
                this.handleResponse(message);
                break;

            case 'error':
                this.handleError(message);
                break;

            case 'gpioOutputChanged':
                this.handleGPIOOutputChanged(message);
                break;

            case 'simulatorConnected':
                console.log('PithagorasGPIO: Simulator connected');
                this.simulatorConnected = true;
                break;

            case 'simulatorDisconnected':
                console.warn('PithagorasGPIO: Simulator disconnected');
                this.simulatorConnected = false;
                break;

            default:
                console.warn('PithagorasGPIO: Unknown message type:', message.type);
        }
    }

    /**
     * Handle response from server
     */
    handleResponse(message) {
        const { messageId, ...data } = message;

        const pending = this.pendingRequests.get(messageId);
        if (pending) {
            this.pendingRequests.delete(messageId);
            pending.resolve(data);
        }
    }

    /**
     * Handle error from server
     */
    handleError(message) {
        const { messageId, error } = message;

        const pending = this.pendingRequests.get(messageId);
        if (pending) {
            this.pendingRequests.delete(messageId);
            pending.reject(new Error(error));
        } else {
            console.error('PithagorasGPIO: Server error:', error);
        }
    }

    /**
     * Handle GPIO output change event
     */
    handleGPIOOutputChanged(message) {
        const { pinName, bcmPin, state, voltage } = message;

        // Trigger callbacks for this pin
        const handlers = this.eventHandlers.get(pinName);
        if (handlers) {
            handlers.forEach(callback => {
                try {
                    callback(state, voltage, bcmPin);
                } catch (error) {
                    console.error(`Error in GPIO onChange callback for ${pinName}:`, error);
                }
            });
        }
    }

    /**
     * Send message to server with request tracking
     */
    async sendRequest(type, params = {}) {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this.registered) {
                reject(new Error('Not connected to GPIO server'));
                return;
            }

            const messageId = this.nextMessageId++;

            this.pendingRequests.set(messageId, { resolve, reject });

            // Set timeout for request
            setTimeout(() => {
                if (this.pendingRequests.has(messageId)) {
                    this.pendingRequests.delete(messageId);
                    reject(new Error(`Request timeout for ${type}`));
                }
            }, 5000);

            this.send({
                type,
                messageId,
                ...params
            });
        });
    }

    /**
     * Send message to server
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('PithagorasGPIO: Cannot send, not connected');
        }
    }

    /**
     * Get or create a GPIO pin interface
     */
    pin(pinNumber) {
        if (!this.pins.has(pinNumber)) {
            this.pins.set(pinNumber, new GPIOPin(this, pinNumber));
        }
        return this.pins.get(pinNumber);
    }

    /**
     * Register onChange callback for a pin
     */
    onChange(pinName, callback) {
        if (!this.eventHandlers.has(pinName)) {
            this.eventHandlers.set(pinName, new Set());

            // Wait for connection and simulator to be ready before registering
            const registerCallback = async () => {
                try {
                    // Wait for initial connection if still connecting
                    if (this.connectionPromise) {
                        await this.connectionPromise;
                    }

                    // Wait for simulator to connect (with timeout)
                    const timeout = 10000; // 10 second timeout
                    const startTime = Date.now();
                    while (!this.simulatorConnected && (Date.now() - startTime) < timeout) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    if (!this.simulatorConnected) {
                        console.warn(`${pinName}: Simulator not connected after ${timeout}ms, callback registration may fail`);
                    }

                    // Register callback with simulator
                    await this.sendRequest('registerGPIOOutputCallback', { pinName });
                } catch (err) {
                    console.error(`Failed to register callback for ${pinName}:`, err);
                }
            };

            registerCallback();
        }

        this.eventHandlers.get(pinName).add(callback);

        // Return unsubscribe function
        return () => {
            const handlers = this.eventHandlers.get(pinName);
            if (handlers) {
                handlers.delete(callback);
                if (handlers.size === 0) {
                    this.eventHandlers.delete(pinName);
                }
            }
        };
    }
}

/**
 * GPIO Pin interface
 */
class GPIOPin {
    constructor(gpio, pinNumber) {
        this.gpio = gpio;
        this.pinNumber = pinNumber;
        this.pinName = `GPIO${pinNumber}`;
        this._direction = null; // 'input' or 'output'
    }

    /**
     * Configure pin as input
     * Note: Pin must already exist in circuit schematic
     */
    async input() {
        this._direction = 'input';

        // Pin should already exist in circuit - we don't auto-create
        // Backend will log warning if pin doesn't exist when operations are attempted
        console.warn(`GPIO${this.pinNumber}: Configured as input (pin must exist in circuit schematic)`);

        return this;
    }

    /**
     * Configure pin as output
     * Note: Pin must already exist in circuit schematic
     */
    async output() {
        this._direction = 'output';

        // Pin should already exist in circuit - we don't auto-create
        // Backend will log warning if pin doesn't exist when operations are attempted
        console.warn(`GPIO${this.pinNumber}: Configured as output (pin must exist in circuit schematic)`);

        return this;
    }

    /**
     * Read pin state
     */
    async read() {
        if (this._direction === 'input') {
            try {
                const response = await this.gpio.sendRequest('getGPIOInputState', {
                    pinName: this.pinName
                });
                return response.state;
            } catch (error) {
                console.warn(`GPIO${this.pinNumber}: Pin exists in code but not in circuit - returning LOW`);
                return 0; // Default to LOW like real hardware
            }
        } else if (this._direction === 'output') {
            try {
                const response = await this.gpio.sendRequest('getGPIOOutputState', {
                    pinName: this.pinName
                });
                return response.state;
            } catch (error) {
                console.warn(`GPIO${this.pinNumber}: Pin exists in code but not in circuit - returning LOW`);
                return 0; // Default to LOW like real hardware
            }
        } else {
            console.warn(`GPIO${this.pinNumber}: Not configured (call .input() or .output() first) - returning LOW`);
            return 0;
        }
    }

    /**
     * Write pin state (for input pins - sets the simulated input value)
     */
    async write(state) {
        if (this._direction !== 'input') {
            console.warn(`GPIO${this.pinNumber}: Not configured as input - ignoring write`);
            return this;
        }

        try {
            await this.gpio.sendRequest('setGPIOInputState', {
                pinName: this.pinName,
                state: state ? 1 : 0
            });
        } catch (error) {
            console.warn(`GPIO${this.pinNumber}: Pin exists in code but not in circuit - write ignored`);
        }

        return this;
    }

    /**
     * Set pin HIGH (for input pins)
     */
    async high() {
        return this.write(1);
    }

    /**
     * Set pin LOW (for input pins)
     */
    async low() {
        return this.write(0);
    }

    /**
     * Register onChange callback (for output pins)
     */
    onChange(callback) {
        if (this._direction !== 'output') {
            console.warn(`GPIO${this.pinNumber}: Not configured as output - callback not registered`);
            return () => {}; // Return empty unsubscribe function
        }

        try {
            return this.gpio.onChange(this.pinName, callback);
        } catch (error) {
            console.warn(`GPIO${this.pinNumber}: Pin exists in code but not in circuit - callback not registered`);
            return () => {}; // Return empty unsubscribe function
        }
    }
}

module.exports = PithagorasGPIO;