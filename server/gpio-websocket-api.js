const express = require('express');
const WebSocket = require('ws');
const Logger = require('../util/logger');

/**
 * GPIO WebSocket API
 *
 * Routes GPIO commands between CircuitJS1 simulator and GPIO client code.
 *
 * Two types of connections:
 * 1. Simulator connection - CircuitJS1 registers as the simulator
 * 2. GPIO client connections - User code (Pi/local Node.js) controlling GPIO
 *
 * Protocol:
 * - Client connects and sends { type: 'register', role: 'simulator' | 'gpio-client' }
 * - GPIO commands flow: gpio-client → server → simulator
 * - GPIO events flow: simulator → server → gpio-client(s)
 */
class GPIOWebSocketManager {
    constructor(config = {}) {
        this.port = config.gpioPort || 8081;
        this.logger = new Logger('GPIOWebSocket', 'info', config.logLevel || 'debug');
        this.wss = null;

        // Track connections
        this.simulator = null;  // Only one simulator connection
        this.clients = new Map(); // Map of clientId → {ws, info}
        this.nextClientId = 1;
    }

    /**
     * Start the WebSocket server
     */
    start() {
        if (this.wss) {
            this.logger.warn('GPIO WebSocket server already running');
            return;
        }

        this.wss = new WebSocket.Server({ port: this.port });
        this.logger.info(`GPIO WebSocket server starting on port ${this.port}`);

        this.wss.on('connection', (ws) => {
            this.logger.info('New WebSocket connection (unregistered)');

            // Handle messages
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(ws, message);
                } catch (error) {
                    this.logger.error('Parse error:', error);
                    this.send(ws, {
                        type: 'error',
                        error: `Invalid JSON: ${error.message}`
                    });
                }
            });

            // Handle close
            ws.on('close', () => {
                this.handleDisconnect(ws);
            });

            // Handle error
            ws.on('error', (error) => {
                this.logger.error('WebSocket error:', error);
            });
        });

        this.logger.info(`GPIO WebSocket server ready on ws://localhost:${this.port}`);
    }

    /**
     * Stop the server
     */
    stop() {
        if (this.wss) {
            this.logger.info('Stopping GPIO WebSocket server');
            this.wss.close();
            this.wss = null;
            this.simulator = null;
            this.clients.clear();
        }
    }

    /**
     * Handle incoming message
     */
    handleMessage(ws, message) {
        this.logger.debug('Message received:', message.type);

        // Check if this is a registration message
        if (message.type === 'register') {
            this.handleRegister(ws, message);
            return;
        }

        // Route based on sender
        if (ws === this.simulator) {
            this.handleSimulatorMessage(message);
        } else {
            this.handleClientMessage(ws, message);
        }
    }

    /**
     * Handle registration
     */
    handleRegister(ws, message) {
        const { role, name } = message;

        if (role === 'simulator') {
            // Disconnect previous simulator if any
            if (this.simulator) {
                this.logger.warn('Replacing existing simulator connection');
                this.send(this.simulator, {
                    type: 'error',
                    error: 'Another simulator connected, disconnecting'
                });
                this.simulator.close();
            }

            this.simulator = ws;
            this.logger.info('✓ Simulator registered');

            this.send(ws, {
                type: 'registered',
                role: 'simulator',
                timestamp: Date.now()
            });

        } else if (role === 'gpio-client') {
            const clientId = this.nextClientId++;
            this.clients.set(clientId, {
                ws: ws,
                name: name || `client-${clientId}`,
                connectedAt: Date.now()
            });

            // Store clientId on the ws object for lookup
            ws.__gpioClientId = clientId;

            this.logger.info(`✓ GPIO client registered: ${this.clients.get(clientId).name} (id: ${clientId})`);

            this.send(ws, {
                type: 'registered',
                role: 'gpio-client',
                clientId: clientId,
                timestamp: Date.now()
            });

        } else {
            this.send(ws, {
                type: 'error',
                error: `Unknown role: ${role}. Expected 'simulator' or 'gpio-client'`
            });
        }
    }

    /**
     * Handle message from simulator
     */
    handleSimulatorMessage(message) {
        this.logger.debug('Simulator message:', message.type);

        switch (message.type) {
            case 'gpioOutputChanged':
                // Forward to all GPIO clients
                this.broadcastToClients(message);
                break;

            case 'response':
            case 'error':
                // Forward to specific client if messageId present
                if (message.messageId) {
                    this.forwardToClient(message);
                }
                break;

            default:
                this.logger.warn('Unknown simulator message type:', message.type);
        }
    }

    /**
     * Handle message from GPIO client
     */
    handleClientMessage(ws, message) {
        const clientId = ws.__gpioClientId;
        const client = this.clients.get(clientId);

        if (!client) {
            this.logger.error('Message from unregistered client');
            return;
        }

        this.logger.debug(`GPIO client ${client.name} message:`, message.type);

        // Check if simulator is connected
        if (!this.simulator || this.simulator.readyState !== WebSocket.OPEN) {
            this.send(ws, {
                type: 'error',
                messageId: message.messageId,
                error: 'Simulator not connected'
            });
            return;
        }

        // Add client identifier to message for routing responses
        message.__clientId = clientId;

        // Forward to simulator
        this.send(this.simulator, message);
    }

    /**
     * Forward response back to specific client
     */
    forwardToClient(message) {
        const clientId = message.__clientId;
        if (!clientId) {
            this.logger.warn('Response has no __clientId, cannot route');
            return;
        }

        const client = this.clients.get(clientId);
        if (!client) {
            this.logger.warn(`Client ${clientId} no longer connected`);
            return;
        }

        // Remove internal routing field before sending
        delete message.__clientId;

        this.send(client.ws, message);
    }

    /**
     * Broadcast message to all GPIO clients
     */
    broadcastToClients(message) {
        this.logger.debug(`Broadcasting to ${this.clients.size} clients:`, message.type);

        this.clients.forEach((client) => {
            this.send(client.ws, message);
        });
    }

    /**
     * Handle disconnect
     */
    handleDisconnect(ws) {
        if (ws === this.simulator) {
            this.logger.info('Simulator disconnected');
            this.simulator = null;

            // Notify all clients
            this.broadcastToClients({
                type: 'simulatorDisconnected',
                timestamp: Date.now()
            });

        } else if (ws.__gpioClientId) {
            const clientId = ws.__gpioClientId;
            const client = this.clients.get(clientId);

            if (client) {
                this.logger.info(`GPIO client disconnected: ${client.name}`);
                this.clients.delete(clientId);
            }
        } else {
            this.logger.info('Unregistered connection closed');
        }
    }

    /**
     * Send message to WebSocket
     */
    send(ws, message) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            running: this.wss !== null,
            port: this.port,
            wsUrl: `ws://localhost:${this.port}`,
            simulator: this.simulator ? 'connected' : 'disconnected',
            clientCount: this.clients.size,
            clients: Array.from(this.clients.values()).map(c => ({
                name: c.name,
                connectedAt: c.connectedAt
            }))
        };
    }
}

/**
 * Create GPIO WebSocket API router
 * Adds HTTP endpoints for status and management
 */
function createGPIOWebSocketApi(config = {}) {
    const router = express.Router();
    const manager = new GPIOWebSocketManager(config);

    // Start the WebSocket server
    manager.start();

    // Store manager on router for access by server
    router.gpioManager = manager;

    // Status endpoint
    router.get('/status', (req, res) => {
        res.json(manager.getStatus());
    });

    // Health check
    router.get('/health', (req, res) => {
        const status = manager.getStatus();
        res.json({
            healthy: status.running,
            ...status
        });
    });

    return router;
}

module.exports = { GPIOWebSocketManager, createGPIOWebSocketApi };