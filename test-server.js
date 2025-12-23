/**
 * Unified Test Server
 * Manages both HTTP server (for serving test files) and WebSocket proxy server (for debugging)
 */

const express = require('express');
const path = require('path');
const RemoteDebuggerProxyServer = require('./inspector-proxy-factory');
const Logger = require('./util/logger');

class UnifiedTestServer {
    constructor(options = {}) {
        this.options = {
            httpPort: options.httpPort || 8080,
            proxyPort: options.proxyPort || 8888,
            inspectPort: options.inspectPort || 9229,
            debugScript: options.debugScript || './test/fixtures/steppable-script.js',
            ...options
        };

        this.httpServer = null;
        this.proxyServer = null;
        this.logger = new Logger('UnifiedTestServer');
        this.isRunning = false;
    }

    /**
     * Start both HTTP and WebSocket proxy servers
     */
    async start() {
        if (this.isRunning) {
            this.logger.info('Server already running');
            return;
        }

        this.logger.info('Starting unified test server...');

        try {
            // Start HTTP server for serving test files
            await this.startHttpServer();

            // Start WebSocket proxy server for debugging
            await this.startProxyServer();

            this.isRunning = true;

            this.logger.info('\n' + '='.repeat(70));
            this.logger.info('🚀 Unified Test Server is ready!');
            this.logger.info('='.repeat(70));
            this.logger.info(`📁 HTTP Server:      http://localhost:${this.options.httpPort}`);
            this.logger.info(`🔌 WebSocket Proxy:  ws://localhost:${this.options.proxyPort}`);
            this.logger.info(`🐛 Debug Script:     ${this.options.debugScript}`);
            this.logger.info('='.repeat(70));
            this.logger.info('\n📋 Test URLs:');
            this.logger.info(`   Smoke Tests: http://localhost:${this.options.httpPort}/test/websocket-protocol-event-queue-smoke.html`);
            this.logger.info(`   Debugger UI: http://localhost:${this.options.httpPort}/debugger/debugger.html`);
            this.logger.info('='.repeat(70) + '\n');

            // Handle shutdown signals
            this.setupShutdownHandlers();

        } catch (error) {
            this.logger.error('Failed to start server:', error);
            await this.stop();
            throw error;
        }
    }

    /**
     * Start HTTP server for serving static files
     * @private
     */
    async startHttpServer() {
        return new Promise((resolve, reject) => {
            const app = express();

            // Serve static files from project root
            app.use(express.static(path.resolve(__dirname)));

            // Add CORS headers for WebSocket connections
            app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
                next();
            });

            // Health check endpoint
            app.get('/health', (req, res) => {
                res.json({
                    status: 'ok',
                    http: `http://localhost:${this.options.httpPort}`,
                    websocket: `ws://localhost:${this.options.proxyPort}`,
                    debugScript: this.options.debugScript,
                    timestamp: new Date().toISOString()
                });
            });

            // Helpful index page
            app.get('/', (req, res) => {
                res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Debugger Wrapper Test Server</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                max-width: 800px;
                                margin: 50px auto;
                                padding: 20px;
                                line-height: 1.6;
                            }
                            h1 { color: #333; }
                            .link-box {
                                background: #f4f4f4;
                                padding: 15px;
                                margin: 10px 0;
                                border-radius: 5px;
                            }
                            a {
                                color: #0066cc;
                                text-decoration: none;
                                font-weight: bold;
                            }
                            a:hover { text-decoration: underline; }
                            .status {
                                background: #e7f5e7;
                                border-left: 4px solid #4caf50;
                                padding: 10px;
                                margin: 20px 0;
                            }
                        </style>
                    </head>
                    <body>
                        <h1>🚀 Debugger Wrapper Test Server</h1>

                        <div class="status">
                            <strong>Status:</strong> Running<br>
                            <strong>HTTP Server:</strong> http://localhost:${this.options.httpPort}<br>
                            <strong>WebSocket Proxy:</strong> ws://localhost:${this.options.proxyPort}<br>
                            <strong>Debug Script:</strong> ${this.options.debugScript}
                        </div>

                        <h2>Available Tests & Tools</h2>

                        <div class="link-box">
                            <h3>🔧 Diagnostic Test (Start Here)</h3>
                            <p>Interactive diagnostic tool to verify WebSocket connection and basic operations</p>
                            <a href="/test/diagnostic-test.html">Open Diagnostic Tool →</a>
                        </div>

                        <div class="link-box">
                            <h3>📋 Simple Smoke Tests (Recommended)</h3>
                            <p>Simplified smoke tests with better error handling and debugging</p>
                            <a href="/test/websocket-smoke-simple.html">Run Simple Tests →</a>
                        </div>

                        <div class="link-box">
                            <h3>📋 Full Smoke Tests</h3>
                            <p>Comprehensive WebsocketProtocolEventQueue integration tests</p>
                            <a href="/test/websocket-protocol-event-queue-smoke.html">Run Full Tests →</a>
                        </div>

                        <div class="link-box">
                            <h3>🐛 Debugger UI</h3>
                            <p>Interactive debugger interface</p>
                            <a href="/debugger/debugger.html">Open Debugger →</a>
                        </div>

                        <div class="link-box">
                            <h3>🔍 Health Check</h3>
                            <p>Server status and configuration</p>
                            <a href="/health">View Health →</a>
                        </div>

                        <h2>Documentation</h2>
                        <ul>
                            <li><a href="/test/README-SMOKE-TESTS.md">Smoke Tests README</a></li>
                            <li><a href="/CLAUDE.md">Protocol Commands Reference</a></li>
                        </ul>
                    </body>
                    </html>
                `);
            });

            this.httpServer = app.listen(this.options.httpPort, () => {
                this.logger.info(`✓ HTTP server started on port ${this.options.httpPort}`);
                resolve();
            });

            this.httpServer.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    reject(new Error(`Port ${this.options.httpPort} is already in use`));
                } else {
                    reject(err);
                }
            });
        });
    }

    /**
     * Start WebSocket proxy server for debugging
     * @private
     */
    async startProxyServer() {
        return new Promise((resolve, reject) => {
            try {
                const scriptPath = path.resolve(this.options.debugScript);
                this.proxyServer = new RemoteDebuggerProxyServer(scriptPath, {
                    inspectPort: this.options.inspectPort,
                    proxyPort: this.options.proxyPort
                });

                this.proxyServer.start();

                // Wait a bit for the proxy to initialize
                setTimeout(() => {
                    this.logger.info(`✓ WebSocket proxy started on port ${this.options.proxyPort}`);
                    resolve();
                }, 500);

            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Setup handlers for graceful shutdown
     * @private
     */
    setupShutdownHandlers() {
        const shutdown = async (signal) => {
            this.logger.info(`\n${signal} received, shutting down gracefully...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // Handle uncaught errors
        process.on('uncaughtException', (err) => {
            this.logger.error('Uncaught exception:', err);
            this.stop().then(() => process.exit(1));
        });

        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
            this.stop().then(() => process.exit(1));
        });
    }

    /**
     * Stop both servers
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        this.logger.info('Stopping servers...');

        const stopPromises = [];

        // Stop HTTP server
        if (this.httpServer) {
            stopPromises.push(
                new Promise((resolve) => {
                    this.httpServer.close(() => {
                        this.logger.info('✓ HTTP server stopped');
                        resolve();
                    });
                })
            );
        }

        // Stop proxy server
        if (this.proxyServer) {
            try {
                this.proxyServer.stop();
                this.logger.info('✓ WebSocket proxy stopped');
            } catch (err) {
                this.logger.error('Error stopping proxy server:', err);
            }
        }

        await Promise.all(stopPromises);

        this.httpServer = null;
        this.proxyServer = null;
        this.isRunning = false;

        this.logger.info('All servers stopped');
    }

    /**
     * Get server status
     */
    getStatus() {
        return {
            running: this.isRunning,
            httpPort: this.options.httpPort,
            proxyPort: this.options.proxyPort,
            inspectPort: this.options.inspectPort,
            debugScript: this.options.debugScript,
            httpUrl: `http://localhost:${this.options.httpPort}`,
            wsUrl: `ws://localhost:${this.options.proxyPort}`,
            smokeTestsUrl: `http://localhost:${this.options.httpPort}/test/websocket-protocol-event-queue-smoke.html`,
            debuggerUrl: `http://localhost:${this.options.httpPort}/debugger/debugger.html`
        };
    }
}

// Create and export singleton instance
let serverInstance = null;

function getServer(options) {
    if (!serverInstance) {
        serverInstance = new UnifiedTestServer(options);
    }
    return serverInstance;
}

// If run directly, start the server
if (require.main === module) {
    const server = getServer({
        httpPort: process.env.HTTP_PORT || 8080,
        proxyPort: process.env.PROXY_PORT || 8888,
        inspectPort: process.env.INSPECT_PORT || 9229,
        debugScript: process.env.DEBUG_SCRIPT || './test/fixtures/steppable-script.js'
    });

    server.start().catch((err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
}

module.exports = { UnifiedTestServer, getServer };