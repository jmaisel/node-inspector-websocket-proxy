/**
 * Unified Test Server
 * Manages both HTTP server (for serving test files) and WebSocket proxy server (for debugging)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const RemoteDebuggerProxyServer = require('./inspector-proxy-factory');
const Logger = require('./util/logger');

class UnifiedTestServer {
    constructor(options = {}) {
        this.options = {
            httpPort: options.httpPort || 8080,
            proxyPort: options.proxyPort || 8888,
            inspectPort: options.inspectPort || 9229,
            workspaceRoot: options.workspaceRoot || process.cwd(),
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
        this.proxyServer = null;
        this.logger = new Logger('UnifiedTestServer');
        this.isRunning = false;
    }

    /**
     * Start HTTP server (NO auto-start of debugger)
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

            // NO auto-start of debugger proxy!
            // Use POST /debug/session to start debugging on-demand

            this.isRunning = true;

            this.logger.info('\n' + '='.repeat(70));
            this.logger.info('Unified Test Server is ready!');
            this.logger.info('='.repeat(70));
            this.logger.info(`HTTP Server:       http://localhost:${this.options.httpPort}`);
            this.logger.info(`Workspace Root:    ${this.options.workspaceRoot || process.cwd()}`);
            this.logger.info(`Debug Port:        ws://localhost:${this.options.proxyPort} (when active)`);
            this.logger.info('='.repeat(70));
            this.logger.info('\nAvailable URLs:');
            this.logger.info(`   Server Status:     http://localhost:${this.options.httpPort}/`);
            this.logger.info(`   Health Check:      http://localhost:${this.options.httpPort}/health`);
            this.logger.info(`   Lifecycle Demo:    http://localhost:${this.options.httpPort}/examples/lifecycle-demo.html`);
            this.logger.info(`   Workspace Browser: http://localhost:${this.options.httpPort}/examples/workspace-browser-demo.html`);
            this.logger.info(`   Smoke Tests:       http://localhost:${this.options.httpPort}/test/websocket-protocol-event-queue-smoke.html`);
            this.logger.info(`   Debugger UI:       http://localhost:${this.options.httpPort}/debugger/debugger.html`);
            this.logger.info('='.repeat(70));
            this.logger.info('\nNote: Debugger does NOT auto-start!');
            this.logger.info('      Use POST /debug/session to start debugging a specific file.');
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
     * Searches through directories in order and serves the first match
     * @private
     */
    serveFromMultipleDirectories(req, res, next) {
        const requestedPath = req.path;

        // Try each static directory in order
        const tryNextDirectory = (index) => {
            if (index >= this.options.staticDirs.length) {
                // No file found in any directory, pass to next middleware
                return next();
            }

            const baseDir = this.options.staticDirs[index];
            const filePath = path.join(baseDir, requestedPath);

            // Check if file exists
            fs.stat(filePath, (err, stats) => {
                if (err || !stats.isFile()) {
                    // File not found, try next directory
                    return tryNextDirectory(index + 1);
                }

                // File found, serve it
                res.sendFile(filePath, (sendErr) => {
                    if (sendErr) {
                        // Error sending file, try next directory
                        return tryNextDirectory(index + 1);
                    }
                });
            });
        };

        tryNextDirectory(0);
    }

    /**
     * Start HTTP server for serving static files
     * @private
     */
    async startHttpServer() {
        return new Promise((resolve, reject) => {
            const app = express();

            // Parse JSON request bodies
            app.use(express.json());
            app.use(express.urlencoded({ extended: true }));

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
                    workspaceRoot: this.options.workspaceRoot,
                    staticDirs: this.options.staticDirs,
                    timestamp: new Date().toISOString()
                });
            });

            // Workspace API - mount before static file serving
            const createWorkspaceApi = require('./server/workspace-api');
            const workspaceConfig = {
                workspaceRoot: this.options.workspaceRoot || process.cwd(),
                apiKeys: [process.env.WORKSPACE_API_KEY || 'dev-key-123']
            };
            const workspaceRouter = createWorkspaceApi(workspaceConfig);
            app.use('/project', workspaceRouter);
            app.use('/workspace', workspaceRouter);
            this.logger.info('* Workspace API mounted at /project and /workspace');

            // Debugger Session API - manage debug sessions on-demand
            const { createDebuggerSessionApi } = require('./server/debugger-session-api');
            const debugConfig = {
                workspaceRoot: this.options.workspaceRoot || process.cwd(),
                proxyPort: this.options.proxyPort,
                inspectPort: this.options.inspectPort,
                apiKeys: [process.env.WORKSPACE_API_KEY || 'dev-key-123'],
                requireAuth: false
            };
            const debugRouter = createDebuggerSessionApi(debugConfig);
            app.use('/debug', debugRouter);
            this.logger.info('* Debugger Session API mounted at /debug');

            // Store reference to debug router for status queries
            this.debugRouter = debugRouter;

            // Project management endpoints
            app.post('/api/projects/create', express.json(), async (req, res) => {
                try {
                    const { projectName } = req.body;
                    if (!projectName) {
                        return res.status(400).json({ error: 'Project name required' });
                    }
                    const projectPath = path.join(this.options.workspaceRoot, projectName);
                    await fsPromises.mkdir(projectPath, { recursive: true });
                    res.json({ success: true, path: projectPath, message: `Project '${projectName}' created` });
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            });

            app.post('/api/projects/copy-test-files', async (req, res) => {
                try {
                    const testDir = path.join(__dirname, 'test');
                    const targetPath = path.join(this.options.workspaceRoot, 'test-fixtures');

                    // Check if already exists
                    try {
                        await fsPromises.access(targetPath);
                        return res.json({ success: true, message: 'Test files already exist', path: targetPath });
                    } catch (err) {
                        // Doesn't exist, copy it
                    }

                    // Recursively copy directory
                    await fsPromises.cp(testDir, targetPath, { recursive: true });
                    res.json({ success: true, message: 'Test files copied to workspace', path: targetPath });
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            });

            app.delete('/api/projects/:projectName', async (req, res) => {
                try {
                    const { projectName } = req.params;
                    const projectPath = path.join(this.options.workspaceRoot, projectName);

                    // Safety check - don't delete if outside workspace
                    if (!projectPath.startsWith(this.options.workspaceRoot)) {
                        return res.status(403).json({ error: 'Cannot delete outside workspace' });
                    }

                    await fsPromises.rm(projectPath, { recursive: true, force: true });
                    res.json({ success: true, message: `Project '${projectName}' deleted` });
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            });

            // Helpful index page with live server state
            app.get('/', async (req, res) => {
                // Get current debug session if any
                const currentSession = debugRouter.sessionManager.getCurrentSession();
                const debugFile = currentSession ? currentSession.targetFile : null;
                const debugStatus = currentSession ? currentSession.status : 'No active session';

                // Check if Pithagoras is in static dirs
                const pithagoras = this.options.staticDirs.find(dir => dir.includes('pithagoras'));

                // List projects in workspace
                let projects = [];
                try {
                    const files = await fsPromises.readdir(this.options.workspaceRoot);
                    const projectChecks = await Promise.all(
                        files.map(async (name) => {
                            const filePath = path.join(this.options.workspaceRoot, name);
                            const stats = await fsPromises.lstat(filePath);
                            return {
                                name,
                                isDirectory: stats.isDirectory(),
                                isSymlink: stats.isSymbolicLink()
                            };
                        })
                    );
                    projects = projectChecks.filter(p => p.isDirectory);
                } catch (err) {
                    console.error('Error reading projects:', err);
                }

                res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Debugger Wrapper Server Status</title>
                        <meta http-equiv="refresh" content="5">
                        <style>
                            body {
                                font-family: 'Courier New', monospace;
                                max-width: 900px;
                                margin: 30px auto;
                                padding: 20px;
                                line-height: 1.6;
                                background: #f5f5f5;
                            }
                            h1 {
                                color: #333;
                                border-bottom: 2px solid #333;
                                padding-bottom: 10px;
                            }
                            h2 {
                                color: #555;
                                margin-top: 30px;
                            }
                            .status {
                                background: #fff;
                                border: 2px solid #333;
                                padding: 20px;
                                margin: 20px 0;
                                font-family: monospace;
                            }
                            .status-row {
                                display: flex;
                                margin: 8px 0;
                            }
                            .status-label {
                                font-weight: bold;
                                min-width: 180px;
                            }
                            .status-value {
                                color: #0066cc;
                            }
                            .debug-active {
                                background: #d4edda;
                                border-color: #28a745;
                            }
                            .debug-inactive {
                                background: #f8f9fa;
                                border-color: #6c757d;
                            }
                            .link-box {
                                background: #fff;
                                border: 1px solid #ddd;
                                padding: 15px;
                                margin: 10px 0;
                            }
                            .link-box h3 {
                                margin-top: 0;
                                color: #333;
                            }
                            a {
                                color: #0066cc;
                                text-decoration: none;
                            }
                            a:hover {
                                text-decoration: underline;
                            }
                            .refresh-note {
                                color: #666;
                                font-size: 0.9em;
                                font-style: italic;
                            }
                            .form-box {
                                background: #fff;
                                border: 2px solid #333;
                                padding: 20px;
                                margin: 20px 0;
                            }
                            .form-group {
                                margin-bottom: 15px;
                            }
                            .form-group label {
                                display: block;
                                font-weight: bold;
                                margin-bottom: 5px;
                            }
                            .form-group input, .form-group select {
                                width: 100%;
                                padding: 8px;
                                border: 1px solid #ddd;
                                border-radius: 4px;
                                font-family: 'Courier New', monospace;
                            }
                            button {
                                background: #0066cc;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-weight: bold;
                                margin-right: 10px;
                            }
                            button:hover {
                                background: #0052a3;
                            }
                            button.danger {
                                background: #d32f2f;
                            }
                            button.danger:hover {
                                background: #b71c1c;
                            }
                            button.success {
                                background: #28a745;
                            }
                            button.success:hover {
                                background: #1e7e34;
                            }
                            .message {
                                padding: 10px;
                                margin: 10px 0;
                                border-radius: 4px;
                            }
                            .message.success {
                                background: #d4edda;
                                color: #155724;
                                border: 1px solid #c3e6cb;
                            }
                            .message.error {
                                background: #f8d7da;
                                color: #721c24;
                                border: 1px solid #f5c6cb;
                            }
                            .projects-list {
                                list-style: none;
                                padding: 0;
                            }
                            .project-item {
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                padding: 10px;
                                margin: 5px 0;
                                background: #f8f9fa;
                                border-radius: 4px;
                            }
                            .project-item.symlink {
                                background: #e8f4f8;
                                border-left: 4px solid #0066cc;
                            }
                        </style>
                    </head>
                    <body>
                        <h1>Debugger Wrapper Server Status</h1>
                        <p class="refresh-note">This page auto-refreshes every 5 seconds</p>

                        <h2>Server Configuration</h2>
                        <div class="status">
                            <div class="status-row">
                                <span class="status-label">Server Status:</span>
                                <span class="status-value">Running</span>
                            </div>
                            <div class="status-row">
                                <span class="status-label">Workspace Directory:</span>
                                <span class="status-value">${this.options.workspaceRoot}</span>
                            </div>
                            <div class="status-row">
                                <span class="status-label">HTTP Server:</span>
                                <span class="status-value">http://localhost:${this.options.httpPort}</span>
                            </div>
                            <div class="status-row">
                                <span class="status-label">WebSocket Proxy:</span>
                                <span class="status-value">ws://localhost:${this.options.proxyPort}</span>
                            </div>
                        </div>

                        <h2>Debug Session</h2>
                        <div class="status ${debugFile ? 'debug-active' : 'debug-inactive'}">
                            <div class="status-row">
                                <span class="status-label">Status:</span>
                                <span class="status-value">${debugStatus}</span>
                            </div>
                            <div class="status-row">
                                <span class="status-label">File Being Debugged:</span>
                                <span class="status-value">${debugFile || 'null'}</span>
                            </div>
                            ${currentSession ? `
                            <div class="status-row">
                                <span class="status-label">Session ID:</span>
                                <span class="status-value">${currentSession.sessionId}</span>
                            </div>
                            <div class="status-row">
                                <span class="status-label">WebSocket URL:</span>
                                <span class="status-value">${currentSession.wsUrl}</span>
                            </div>
                            ` : ''}
                        </div>

                        ${pithagoras ? `
                        <h2>Pithagoras</h2>
                        <div class="link-box">
                            <h3>Pithagoras IDE</h3>
                            <p>External IDE integration</p>
                            <a href="/pithagoras" target="_blank">Open Pithagoras</a>
                        </div>
                        ` : ''}

                        <h2>Workspace Projects</h2>
                        <div class="status">
                            ${projects.length > 0 ? `
                                <ul class="projects-list">
                                    ${projects.map(p => `
                                        <li class="project-item ${p.isSymlink ? 'symlink' : ''}">
                                            <span>${p.name}${p.isSymlink ? ' (symlink)' : ''}</span>
                                            <button class="danger" onclick="deleteProject('${p.name}')">Delete</button>
                                        </li>
                                    `).join('')}
                                </ul>
                            ` : '<p>No projects in workspace</p>'}
                        </div>

                        <h2>Project Management</h2>

                        <div class="form-box">
                            <h3>Create New Project</h3>
                            <div id="create-message"></div>
                            <div class="form-group">
                                <label for="project-name">Project Name:</label>
                                <input type="text" id="project-name" placeholder="my-new-project">
                            </div>
                            <button onclick="createProject()">Create Project</button>
                        </div>

                        <div class="form-box">
                            <h3>Copy Test Files</h3>
                            <div id="copy-message"></div>
                            <p>Copy test fixtures into the workspace</p>
                            <button class="success" onclick="copyTestFiles()">Copy Test Files</button>
                        </div>

                        <h2>Available Tools</h2>

                        <div class="link-box">
                            <h3>Test Debug Workflow</h3>
                            <p>Test the complete debug workflow step-by-step</p>
                            <a href="/examples/test-debug-workflow.html">Test Workflow</a>
                        </div>

                        <div class="link-box">
                            <h3>Debugger UI</h3>
                            <p>Interactive debugger interface</p>
                            <a href="/debugger/debugger.html">Open Debugger</a>
                        </div>

                        <div class="link-box">
                            <h3>Upload Project</h3>
                            <p>Upload and create projects using ZIP files</p>
                            <a href="/examples/upload-project-demo.html">Upload Demo</a>
                        </div>

                        <div class="link-box">
                            <h3>Workspace Browser</h3>
                            <p>Browse and manage workspace files</p>
                            <a href="/examples/workspace-browser-demo.html">Open Workspace Browser</a>
                        </div>

                        <div class="link-box">
                            <h3>Diagnostic Test</h3>
                            <p>Verify WebSocket connection and basic operations</p>
                            <a href="/test/diagnostic-test.html">Run Diagnostics</a>
                        </div>

                        <div class="link-box">
                            <h3>Smoke Tests</h3>
                            <p>Comprehensive WebsocketProtocolEventQueue integration tests</p>
                            <a href="/test/websocket-protocol-event-queue-smoke.html">Run Tests</a>
                        </div>

                        <div class="link-box">
                            <h3>Health Check API</h3>
                            <p>Server status and configuration (JSON)</p>
                            <a href="/health">View Health</a>
                        </div>

                        <script>
                            function showMessage(elementId, message, isError = false) {
                                const el = document.getElementById(elementId);
                                el.innerHTML = '<div class="message ' + (isError ? 'error' : 'success') + '">' + message + '</div>';
                                setTimeout(() => el.innerHTML = '', 3000);
                            }

                            async function createProject() {
                                const name = document.getElementById('project-name').value.trim();
                                if (!name) {
                                    showMessage('create-message', 'Please enter a project name', true);
                                    return;
                                }

                                try {
                                    const response = await fetch('/api/projects/create', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ projectName: name })
                                    });

                                    const data = await response.json();

                                    if (response.ok) {
                                        showMessage('create-message', data.message);
                                        document.getElementById('project-name').value = '';
                                        setTimeout(() => location.reload(), 1500);
                                    } else {
                                        showMessage('create-message', data.error || 'Failed to create project', true);
                                    }
                                } catch (error) {
                                    showMessage('create-message', error.message, true);
                                }
                            }

                            async function copyTestFiles() {
                                try {
                                    const response = await fetch('/api/projects/copy-test-files', {
                                        method: 'POST'
                                    });

                                    const data = await response.json();

                                    if (response.ok) {
                                        showMessage('copy-message', data.message);
                                        setTimeout(() => location.reload(), 1500);
                                    } else {
                                        showMessage('copy-message', data.error || 'Failed to copy test files', true);
                                    }
                                } catch (error) {
                                    showMessage('copy-message', error.message, true);
                                }
                            }

                            async function deleteProject(name) {
                                if (!confirm('Delete project "' + name + '"? This cannot be undone.')) {
                                    return;
                                }

                                try {
                                    const response = await fetch('/api/projects/' + encodeURIComponent(name), {
                                        method: 'DELETE'
                                    });

                                    const data = await response.json();

                                    if (response.ok) {
                                        alert(data.message);
                                        location.reload();
                                    } else {
                                        alert(data.error || 'Failed to delete project');
                                    }
                                } catch (error) {
                                    alert(error.message);
                                }
                            }
                        </script>
                    </body>
                    </html>
                `);
            });

            // Serve static files from multiple directories (searches in order)
            app.use((req, res, next) => this.serveFromMultipleDirectories(req, res, next));

            this.httpServer = app.listen(this.options.httpPort, () => {
                this.logger.info(`* HTTP server started on port ${this.options.httpPort}`);
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
     * DEPRECATED: No longer auto-starts proxy server
     * Use POST /debug/session to start debugging on-demand
     * @private
     */
    async startProxyServer() {
        // NO-OP: Debugger sessions are now managed via /debug/session API
        // This method kept for backward compatibility but does nothing
        this.logger.info('Note: Proxy server NOT auto-started (use session API)');
        return Promise.resolve();
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
                        this.logger.info('* HTTP server stopped');
                        resolve();
                    });
                })
            );
        }

        // Proxy server is now managed by session API
        // Sessions are stopped via DELETE /debug/session

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
            workspaceRoot: this.options.workspaceRoot,
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
        workspaceRoot: process.env.WORKSPACE_ROOT || process.cwd()
    });

    server.start().catch((err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
}

module.exports = { UnifiedTestServer, getServer };