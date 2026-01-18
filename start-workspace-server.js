/**
 * Workspace Server with On-Demand Debugging
 *
 * This server provides:
 * 1. Workspace API (browse/upload/download files)
 * 2. Debugger Session API (start/stop debug sessions on-demand)
 * 3. Static file serving
 *
 * Workflow:
 * 1. Server starts (NO debugger auto-start)
 * 2. Client establishes workspace (GET /workspace/info)
 * 3. Client browses files (GET /project/*)
 * 4. Client starts debug session for specific file (POST /debug/session {file: "/path/to/file.js"})
 * 5. Client connects to debugger WebSocket (ws://localhost:8888)
 * 6. Client debugs...
 * 7. Client stops session (DELETE /debug/session)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const Logger = require('./util/logger');

class WorkspaceServer {
    constructor(options = {}) {
        this.options = {
            httpPort: options.httpPort || 8080,
            proxyPort: options.proxyPort || 8888,
            inspectPort: options.inspectPort || 9229,
            workspaceRoot: options.workspaceRoot || process.cwd(),
            apiKeys: options.apiKeys || [process.env.WORKSPACE_API_KEY || 'dev-key-123'],
            staticDirs: options.staticDirs || [path.resolve(__dirname)],
            ...options
        };

        // Normalize staticDirs to always be an array
        if (!Array.isArray(this.options.staticDirs)) {
            this.options.staticDirs = [this.options.staticDirs];
        }

        // Resolve all static directory paths
        this.options.staticDirs = this.options.staticDirs.map(dir => path.resolve(dir));

        this.httpServer = null;
        this.logger = new Logger('WorkspaceServer');
        this.isRunning = false;
    }

    /**
     * Start HTTP server
     */
    async start() {
        if (this.isRunning) {
            this.logger.info('Server already running');
            return;
        }

        this.logger.info('Starting workspace server...');

        try {
            await this.startHttpServer();

            this.isRunning = true;

            this.logger.info('\n' + '='.repeat(70));
            this.logger.info('🚀 Workspace Server is ready!');
            this.logger.info('='.repeat(70));
            this.logger.info(`📁 HTTP Server:       http://localhost:${this.options.httpPort}`);
            this.logger.info(`🗂️  Workspace Root:    ${this.options.workspaceRoot}`);
            this.logger.info(`🔌 Debug Port (when active): ws://localhost:${this.options.proxyPort}`);
            this.logger.info('='.repeat(70));
            this.logger.info('\n📋 Available URLs:');
            this.logger.info(`   Workspace Browser: http://localhost:${this.options.httpPort}/examples/workspace-browser-demo.html`);
            this.logger.info(`   Full Lifecycle Demo: http://localhost:${this.options.httpPort}/examples/lifecycle-demo.html`);
            this.logger.info(`   Workspace API:     http://localhost:${this.options.httpPort}/workspace/info`);
            this.logger.info(`   Debug Session API: http://localhost:${this.options.httpPort}/debug/session`);
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
     * Custom middleware to serve files from multiple static directories
     */
    serveFromMultipleDirectories(req, res, next) {
        const requestedPath = req.path;

        const tryNextDirectory = (index) => {
            if (index >= this.options.staticDirs.length) {
                return next();
            }

            const baseDir = this.options.staticDirs[index];
            const filePath = path.join(baseDir, requestedPath);

            fs.stat(filePath, (err, stats) => {
                if (err || !stats.isFile()) {
                    return tryNextDirectory(index + 1);
                }

                res.sendFile(filePath, (sendErr) => {
                    if (sendErr) {
                        return tryNextDirectory(index + 1);
                    }
                });
            });
        };

        tryNextDirectory(0);
    }

    /**
     * Start HTTP server
     */
    async startHttpServer() {
        return new Promise((resolve, reject) => {
            const app = express();

            // JSON body parser
            app.use(express.json());

            // CORS headers
            app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Workspace-API-Key');
                if (req.method === 'OPTIONS') {
                    return res.sendStatus(200);
                }
                next();
            });

            // Health check endpoint
            app.get('/health', (req, res) => {
                res.json({
                    status: 'ok',
                    http: `http://localhost:${this.options.httpPort}`,
                    workspaceRoot: this.options.workspaceRoot,
                    timestamp: new Date().toISOString()
                });
            });

            // Workspace API (file browsing, upload/download)
            const createWorkspaceApi = require('./server/workspace-api');
            const workspaceConfig = {
                workspaceRoot: this.options.workspaceRoot,
                demoProjectPath: this.options.demoProjectPath,
                apiKeys: this.options.apiKeys
            };
            const workspaceRouter = createWorkspaceApi(workspaceConfig);
            app.use('/project', workspaceRouter);
            app.use('/workspace', workspaceRouter);
            this.logger.info('✓ Workspace API mounted at /project and /workspace');

            // Debugger Session API (start/stop debug sessions)
            const { createDebuggerSessionApi } = require('./server/debugger-session-api');
            const debugConfig = {
                workspaceRoot: this.options.workspaceRoot,
                proxyPort: this.options.proxyPort,
                inspectPort: this.options.inspectPort,
                apiKeys: this.options.apiKeys,
                requireAuth: false // Set to true to require API key for starting sessions
            };
            const debugRouter = createDebuggerSessionApi(debugConfig);
            app.use('/debug', debugRouter);
            this.logger.info('✓ Debugger Session API mounted at /debug');

            // Project Management API (save/load/export/import projects)
            const { createProjectApi } = require('./server/project-api');
            const projectConfig = {
                workspaceRoot: this.options.workspaceRoot
            };
            const projectRouter = createProjectApi(projectConfig);
            app.use('/api/project', projectRouter);
            this.logger.info('✓ Project Management API mounted at /api/project');

            // Helpful index page
            app.get('/', (req, res) => {
                res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Workspace Server</title>
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
                            code {
                                background: #f5f5f5;
                                padding: 2px 6px;
                                border-radius: 3px;
                                font-family: monospace;
                            }
                        </style>
                    </head>
                    <body>
                        <h1>🗂️ Workspace Server</h1>

                        <div class="status">
                            <strong>Status:</strong> Running<br>
                            <strong>Workspace:</strong> ${this.options.workspaceRoot}<br>
                            <strong>HTTP Server:</strong> http://localhost:${this.options.httpPort}
                        </div>

                        <h2>Available Tools</h2>

                        <div class="link-box">
                            <h3>🎯 Full Lifecycle Demo (Recommended)</h3>
                            <p>Complete demo showing: Open Project → Browse Files → Debug Specific File</p>
                            <a href="/cruft/examples/lifecycle-demo.html">Open Lifecycle Demo →</a>
                        </div>

                        <div class="link-box">
                            <h3>🗂️ Workspace Browser</h3>
                            <p>Browse workspace files, upload/download ZIPs</p>
                            <a href="/cruft/examples/workspace-browser-demo.html">Open Workspace Browser →</a>
                        </div>

                        <h2>API Endpoints</h2>

                        <div class="link-box">
                            <h3>Workspace API</h3>
                            <ul>
                                <li><code>GET /workspace/info</code> - Workspace handshake</li>
                                <li><code>GET /project/</code> - List workspace files</li>
                                <li><code>GET /project/path/to/file</code> - Get file content</li>
                                <li><code>PUT /project/</code> - Upload ZIP (requires API key)</li>
                            </ul>
                            <a href="/workspace/info">View Workspace Info →</a>
                        </div>

                        <div class="link-box">
                            <h3>Debugger Session API</h3>
                            <ul>
                                <li><code>POST /debug/session</code> - Start debug session for a file</li>
                                <li><code>GET /debug/session</code> - Get current session info</li>
                                <li><code>DELETE /debug/session</code> - Stop current session</li>
                            </ul>
                            <p><em>No auto-start - sessions created on-demand</em></p>
                        </div>

                        <h2>Documentation</h2>
                        <ul>
                            <li><a href="/cruft/docs/WORKSPACE_API.md">Workspace API Documentation</a></li>
                        </ul>
                    </body>
                    </html>
                `);
            });

            // Serve static files from multiple directories
            app.use((req, res, next) => this.serveFromMultipleDirectories(req, res, next));

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
     * Setup handlers for graceful shutdown
     */
    setupShutdownHandlers() {
        const shutdown = async (signal) => {
            this.logger.info(`\n${signal} received, shutting down gracefully...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

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
     * Stop server
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        this.logger.info('Stopping server...');

        if (this.httpServer) {
            await new Promise((resolve) => {
                this.httpServer.close(() => {
                    this.logger.info('✓ HTTP server stopped');
                    resolve();
                });
            });
        }

        this.httpServer = null;
        this.isRunning = false;

        this.logger.info('Server stopped');
    }

    /**
     * Get server status
     */
    getStatus() {
        return {
            running: this.isRunning,
            httpPort: this.options.httpPort,
            workspaceRoot: this.options.workspaceRoot,
            httpUrl: `http://localhost:${this.options.httpPort}`
        };
    }
}

// Create and export singleton instance
let serverInstance = null;

function getServer(options) {
    if (!serverInstance) {
        serverInstance = new WorkspaceServer(options);
    }
    return serverInstance;
}

// If run directly, start the server
if (require.main === module) {
    const server = getServer({
        httpPort: process.env.HTTP_PORT || 8080,
        proxyPort: process.env.PROXY_PORT || 8888,
        inspectPort: process.env.INSPECT_PORT || 9229,
        workspaceRoot: process.env.WORKSPACE_ROOT || process.cwd()
    });

    server.start().catch((err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
}

module.exports = { WorkspaceServer, getServer };
