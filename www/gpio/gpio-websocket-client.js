/**
 * GPIO WebSocket Client
 * Connects CircuitJS1 simulator to the GPIO WebSocket server
 * Registers as the simulator and routes GPIO commands
 */
class GPIOWebSocketClient {
    constructor(circuitJS1, options = {}) {
        this.circuitJS1 = circuitJS1; // window.CircuitJS1 API reference
        this.logger = options.logger || console;
        this.serverUrl = options.serverUrl || 'ws://localhost:8081';
        this.autoReconnect = options.autoReconnect !== false;
        this.reconnectDelay = options.reconnectDelay || 3000;

        this.ws = null;
        this.connected = false;
        this.registered = false;
        this.reconnectTimer = null;

        // Store callback registrations
        this.callbackRegistrations = new Map(); // pinName → true
    }

    /**
     * Connect to the GPIO WebSocket server
     */
    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            this.logger.warn('GPIOWebSocketClient: Already connected or connecting');
            return;
        }

        this.logger.info(`GPIOWebSocketClient: Connecting to ${this.serverUrl}`);

        try {
            this.ws = new WebSocket(this.serverUrl);

            this.ws.onopen = () => {
                this.logger.info('GPIOWebSocketClient: Connected');
                this.connected = true;

                // Register as simulator
                this.send({
                    type: 'register',
                    role: 'simulator'
                });
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    this.logger.error('GPIOWebSocketClient: Parse error:', error);
                }
            };

            this.ws.onclose = (event) => {
                this.logger.info('GPIOWebSocketClient: Disconnected', event.code, event.reason);
                this.connected = false;
                this.registered = false;

                if (this.autoReconnect && event.code !== 1000) { // 1000 = normal closure
                    this.logger.info(`GPIOWebSocketClient: Reconnecting in ${this.reconnectDelay}ms`);
                    this.reconnectTimer = setTimeout(() => {
                        this.connect();
                    }, this.reconnectDelay);
                }
            };

            this.ws.onerror = (error) => {
                this.logger.error('GPIOWebSocketClient: WebSocket error:', error);
            };

        } catch (error) {
            this.logger.error('GPIOWebSocketClient: Connection failed:', error);
        }
    }

    /**
     * Disconnect from the server
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
     * Cleanup and destroy the client
     * Call this before removing the client instance to prevent memory leaks
     */
    destroy() {
        // Disconnect first
        this.disconnect();

        // Remove all WebSocket event handlers to prevent memory leaks
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws = null;
        }

        // Clear callback registrations
        this.callbackRegistrations.clear();

        // Clear references
        this.circuitJS1 = null;
        this.logger = null;
    }

    /**
     * Handle incoming message from server
     */
    handleMessage(message) {
        this.logger.debug('GPIOWebSocketClient: Message received:', message.type);

        switch (message.type) {
            case 'registered':
                this.handleRegistered(message);
                break;

            case 'setGPIOInput':
                this.handleSetGPIOInput(message);
                break;

            case 'setGPIOInputState':
                this.handleSetGPIOInputState(message);
                break;

            case 'getGPIOInputState':
                this.handleGetGPIOInputState(message);
                break;

            case 'getGPIOOutputState':
                this.handleGetGPIOOutputState(message);
                break;

            case 'registerGPIOOutputCallback':
                this.handleRegisterGPIOOutputCallback(message);
                break;

            case 'createGPIOInput':
                this.handleCreateGPIOInput(message);
                break;

            case 'createGPIOOutput':
                this.handleCreateGPIOOutput(message);
                break;

            case 'removeAllGPIOPins':
                this.handleRemoveAllGPIOPins(message);
                break;

            case 'error':
                this.logger.error('GPIOWebSocketClient: Server error:', message.error);
                break;

            default:
                this.logger.warn('GPIOWebSocketClient: Unknown message type:', message.type);
        }
    }

    /**
     * Handle registration confirmation
     */
    handleRegistered(message) {
        this.logger.info('GPIOWebSocketClient: Registered as', message.role);
        this.registered = true;
    }

    /**
     * Handle setGPIOInput command
     */
    handleSetGPIOInput(message) {
        try {
            const { pinName, voltage, __clientId } = message;
            this.circuitJS1.setGPIOInput(pinName, voltage);

            this.sendResponse(message.messageId, __clientId, { success: true });
        } catch (error) {
            this.sendError(message.messageId, message.__clientId, error.message);
        }
    }

    /**
     * Handle setGPIOInputState command
     */
    handleSetGPIOInputState(message) {
        try {
            const { pinName, state, __clientId } = message;
            this.circuitJS1.setGPIOInputState(pinName, state);

            this.sendResponse(message.messageId, __clientId, { success: true });
        } catch (error) {
            this.sendError(message.messageId, message.__clientId, error.message);
        }
    }

    /**
     * Handle getGPIOInputState query
     */
    handleGetGPIOInputState(message) {
        try {
            const { pinName, __clientId } = message;
            const state = this.circuitJS1.getGPIOInputState(pinName);

            this.sendResponse(message.messageId, __clientId, {
                success: true,
                state: state
            });
        } catch (error) {
            this.sendError(message.messageId, message.__clientId, error.message);
        }
    }

    /**
     * Handle getGPIOOutputState query
     */
    handleGetGPIOOutputState(message) {
        try {
            const { pinName, __clientId } = message;
            const state = this.circuitJS1.getGPIOOutputState(pinName);

            this.sendResponse(message.messageId, __clientId, {
                success: true,
                state: state
            });
        } catch (error) {
            this.sendError(message.messageId, message.__clientId, error.message);
        }
    }

    /**
     * Handle registerGPIOOutputCallback command
     */
    handleRegisterGPIOOutputCallback(message) {
        try {
            const { pinName, __clientId } = message;

            // Create callback that forwards to WebSocket
            const callback = (bcmPin, pinName, state, voltage) => {
                this.logger.debug('GPIO Output changed:', pinName, state, voltage);

                // Send to server
                this.send({
                    type: 'gpioOutputChanged',
                    pinName: pinName,
                    bcmPin: bcmPin,
                    state: state,
                    voltage: voltage,
                    timestamp: Date.now()
                });
            };

            // Register callback with CircuitJS1
            this.circuitJS1.registerGPIOOutputCallback(pinName, callback);

            // Track registration
            this.callbackRegistrations.set(pinName, true);

            this.sendResponse(message.messageId, __clientId, { success: true });
        } catch (error) {
            this.sendError(message.messageId, message.__clientId, error.message);
        }
    }

    /**
     * Handle createGPIOInput command
     */
    handleCreateGPIOInput(message) {
        try {
            const { bcmPin, __clientId } = message;
            const result = this.circuitJS1.createGPIOInput(bcmPin);

            this.sendResponse(message.messageId, __clientId, {
                success: true,
                created: result
            });
        } catch (error) {
            this.sendError(message.messageId, message.__clientId, error.message);
        }
    }

    /**
     * Handle createGPIOOutput command
     */
    handleCreateGPIOOutput(message) {
        try {
            const { bcmPin, __clientId } = message;
            const result = this.circuitJS1.createGPIOOutput(bcmPin);

            this.sendResponse(message.messageId, __clientId, {
                success: true,
                created: result
            });
        } catch (error) {
            this.sendError(message.messageId, message.__clientId, error.message);
        }
    }

    /**
     * Handle removeAllGPIOPins command
     */
    handleRemoveAllGPIOPins(message) {
        try {
            const { __clientId } = message;
            this.circuitJS1.removeAllGPIOPins();

            // Clear callback registrations
            this.callbackRegistrations.clear();

            this.sendResponse(message.messageId, __clientId, { success: true });
        } catch (error) {
            this.sendError(message.messageId, message.__clientId, error.message);
        }
    }

    /**
     * Send response back to server
     */
    sendResponse(messageId, clientId, data) {
        this.send({
            type: 'response',
            messageId: messageId,
            __clientId: clientId,
            ...data
        });
    }

    /**
     * Send error response back to server
     */
    sendError(messageId, clientId, errorMessage) {
        this.send({
            type: 'error',
            messageId: messageId,
            __clientId: clientId,
            error: errorMessage
        });
    }

    /**
     * Send message to server
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            this.logger.warn('GPIOWebSocketClient: Cannot send, not connected');
        }
    }

    /**
     * Get connection status
     */
    isConnected() {
        return this.connected && this.registered;
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.GPIOWebSocketClient = GPIOWebSocketClient;
}