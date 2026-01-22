/**
 * Unified Server
 *
 * Single server that provides everything:
 * - HTTP server for static files
 * - Workspace API (browse/upload/download files)
 * - Debugger Session API (start/stop debug sessions)
 * - GPIO WebSocket API (bridge between CircuitJS1 and GPIO code)
 * - Project Management API (save/load/export/import)
 * - Demo Projects API (list and copy example projects)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const Logger = require('../util/logger');

class Server {
    constructor(options = {}) {
        this.options = {
            httpPort: options.httpPort || 8080,
            proxyPort: options.proxyPort || 8888,
            gpioPort: options.gpioPort || 8081,
            inspectPort: options.inspectPort || 9229,
            workspaceRoot: options.workspaceRoot || '/tmp/node-inspector-websocket-proxy',
            staticDirs: options.staticDirs || [path.join(__dirname, 'www')],
            logLevels: options.logLevels || {
                http: 'info',
                static: 'info',
                websocket: 'info'
            },
            ...options
        };

        // Normalize staticDirs to array
        if (!Array.isArray(this.options.staticDirs)) {
            this.options.staticDirs = [this.options.staticDirs];
        }

        // Resolve all paths
        this.options.staticDirs = this.options.staticDirs.map(dir => {
            if (dir.startsWith('~/')) {
                return path.join(process.env.HOME || process.env.USERPROFILE, dir.slice(2));
            }
            if (!path.isAbsolute(dir)) {
                return path.join(__dirname, dir);
            }
            return dir;
        });

        // Always include __dirname as fallback for static files
        if (!this.options.staticDirs.includes(__dirname)) {
            this.options.staticDirs.push(__dirname);
        }

        this.httpServer = null;
        this.logger = new Logger('Server');
        this.httpLogger = new Logger('HTTP', 'info', this.options.logLevels.http);
        this.staticLogger = new Logger('Static', 'info', this.options.logLevels.static);
        this.isRunning = false;
    }

    async start() {
        if (this.isRunning) {
            this.logger.info('Server already running');
            return;
        }

        this.logger.info('Starting server...');

        // Ensure workspace exists
        await fsPromises.mkdir(this.options.workspaceRoot, { recursive: true });

        try {
            await this.startHttpServer();
            this.isRunning = true;

            this.logger.info('\n' + '='.repeat(70));
            this.logger.info('Server is ready!');
            this.logger.info('='.repeat(70));
            this.logger.info(`HTTP Server:       http://0.0.0.0:${this.options.httpPort}`);
            this.logger.info(`Workspace Root:    ${this.options.workspaceRoot}`);
            this.logger.info(`Debug WebSocket:   ws://0.0.0.0:${this.options.proxyPort} (when active)`);
            this.logger.info(`GPIO WebSocket:    ws://0.0.0.0:${this.options.gpioPort}`);
            this.logger.info('='.repeat(70));
            this.logger.info('Static directories:');
            this.options.staticDirs.forEach(dir => this.logger.info(`   ${dir}`));
            this.logger.info('='.repeat(70) + '\n');

            this.setupShutdownHandlers();
        } catch (error) {
            this.logger.error('Failed to start server:', error);
            await this.stop();
            throw error;
        }
    }

    serveFromMultipleDirectories(req, res, next) {
        const requestedPath = req.path;
        const startTime = Date.now();

        const tryNextDirectory = (index) => {
            if (index >= this.options.staticDirs.length) {
                this.staticLogger.debug(`404 ${req.method} ${requestedPath}`);
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
                    const duration = Date.now() - startTime;
                    this.staticLogger.debug(`${res.statusCode} ${req.method} ${requestedPath} - ${duration}ms`);
                });
            });
        };

        tryNextDirectory(0);
    }

    async startHttpServer() {
        return new Promise((resolve, reject) => {
            const app = express();

            app.use(express.json());
            app.use(express.urlencoded({ extended: true }));

            // CORS
            app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Workspace-API-Key');
                if (req.method === 'OPTIONS') {
                    return res.sendStatus(200);
                }
                next();
            });

            // Health check
            app.get('/health', (req, res) => {
                res.json({
                    status: 'ok',
                    http: `http://0.0.0.0:${this.options.httpPort}`,
                    websocket: `ws://0.0.0.0:${this.options.proxyPort}`,
                    gpio: `ws://0.0.0.0:${this.options.gpioPort}`,
                    workspaceRoot: this.options.workspaceRoot,
                    staticDirs: this.options.staticDirs,
                    timestamp: new Date().toISOString()
                });
            });

            // Workspace API
            const createWorkspaceApi = require('./workspace-api');
            const workspaceRouter = createWorkspaceApi({
                workspaceRoot: this.options.workspaceRoot,
                apiKeys: [process.env.WORKSPACE_API_KEY || 'dev-key-123']
            });
            app.use('/project', workspaceRouter);
            app.use('/workspace', workspaceRouter);
            this.logger.info('* Workspace API mounted at /project and /workspace');

            // Debugger Session API
            const { createDebuggerSessionApi } = require('./debugger-session-api');
            const debugRouter = createDebuggerSessionApi({
                workspaceRoot: this.options.workspaceRoot,
                proxyPort: this.options.proxyPort,
                inspectPort: this.options.inspectPort,
                apiKeys: [process.env.WORKSPACE_API_KEY || 'dev-key-123'],
                requireAuth: false,
                websocketLogLevel: this.options.logLevels.websocket
            });
            app.use('/debug', debugRouter);
            this.debugRouter = debugRouter;
            this.logger.info('* Debugger Session API mounted at /debug');

            // GPIO WebSocket API
            const { createGPIOWebSocketApi } = require('./gpio-websocket-api');
            const gpioRouter = createGPIOWebSocketApi({
                gpioPort: this.options.gpioPort,
                logLevel: this.options.logLevels.websocket
            });
            app.use('/gpio', gpioRouter);
            this.gpioManager = gpioRouter.gpioManager;
            this.logger.info('* GPIO WebSocket API mounted at /gpio');

            // Project Management API
            const { createProjectApi } = require('./project-api');
            const projectRouter = createProjectApi({
                workspaceRoot: this.options.workspaceRoot
            });
            app.use('/api/project', projectRouter);
            this.logger.info('* Project Management API mounted at /api/project');

            // Demo Projects API
            app.get('/api/demo-projects', async (req, res) => {
                try {
                    const demoProjectsDir = path.join(__dirname, '..', 'pithagoras-gpio', 'demo-projects');
                    const entries = await fsPromises.readdir(demoProjectsDir, { withFileTypes: true });

                    const projects = [];
                    for (const entry of entries) {
                        if (entry.isDirectory()) {
                            const projectPath = path.join(demoProjectsDir, entry.name);
                            const packageJsonPath = path.join(projectPath, 'package.json');

                            let description = '';
                            try {
                                const packageJson = JSON.parse(await fsPromises.readFile(packageJsonPath, 'utf8'));
                                description = packageJson.description || '';
                            } catch (err) {
                                // No package.json or invalid
                            }

                            projects.push({
                                name: entry.name,
                                description: description || `${entry.name} example project`
                            });
                        }
                    }

                    res.json({ success: true, projects });
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            });

            app.post('/api/demo-projects/copy', async (req, res) => {
                try {
                    const { projectName, targetName } = req.body;

                    if (!projectName) {
                        return res.status(400).json({ error: 'Project name required' });
                    }

                    const demoProjectsDir = path.join(__dirname, '..', 'pithagoras-gpio', 'demo-projects');
                    const sourcePath = path.join(demoProjectsDir, projectName);
                    const finalTargetName = targetName || projectName;
                    const targetPath = path.join(this.options.workspaceRoot, finalTargetName);

                    // Verify source exists
                    try {
                        const stats = await fsPromises.stat(sourcePath);
                        if (!stats.isDirectory()) {
                            return res.status(400).json({ error: 'Invalid demo project' });
                        }
                    } catch (err) {
                        return res.status(404).json({ error: `Demo project '${projectName}' not found` });
                    }

                    // Check if target already exists
                    try {
                        await fsPromises.access(targetPath);
                        return res.json({
                            success: true,
                            message: `Project '${finalTargetName}' already exists`,
                            path: targetPath,
                            alreadyExists: true
                        });
                    } catch (err) {
                        // Doesn't exist, copy it
                    }

                    // Copy project
                    await fsPromises.cp(sourcePath, targetPath, { recursive: true });

                    // Copy GPIO driver (index.js) to the project as gpio-driver.js
                    const driverSource = path.join(__dirname, '..', 'pithagoras-gpio', 'gpio-driver.js');
                    const driverTarget = path.join(targetPath, 'gpio-driver.js');
                    await fsPromises.copyFile(driverSource, driverTarget);

                    // Run npm install in the project directory
                    const { exec } = require('child_process');
                    await new Promise((resolve, reject) => {
                        exec('npm install', { cwd: targetPath }, (error, stdout, stderr) => {
                            if (error) {
                                this.logger.error('npm install failed:', stderr);
                                // Don't reject - project is still usable, just needs manual npm install
                            }
                            resolve();
                        });
                    });

                    res.json({
                        success: true,
                        message: `Demo project '${projectName}' copied to '${finalTargetName}'`,
                        path: targetPath
                    });
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            });
            this.logger.info('* Demo Projects API mounted at /api/demo-projects');

            // Index page
            app.get('/', async (req, res) => {
                const currentSession = this.debugRouter?.sessionManager?.getCurrentSession?.();

                let projects = [];
                try {
                    const files = await fsPromises.readdir(this.options.workspaceRoot);
                    const projectChecks = await Promise.all(
                        files.map(async (name) => {
                            const filePath = path.join(this.options.workspaceRoot, name);
                            const stats = await fsPromises.lstat(filePath);
                            return { name, isDirectory: stats.isDirectory() };
                        })
                    );
                    projects = projectChecks.filter(p => p.isDirectory);
                } catch (err) {
                    // Workspace might not exist yet
                }

                res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Debugger Server</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 900px; margin: 30px auto; padding: 20px; background: #f5f5f5; }
        h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .status { background: #fff; border: 2px solid #333; padding: 20px; margin: 20px 0; }
        .status-row { display: flex; margin: 8px 0; }
        .status-label { font-weight: bold; min-width: 180px; }
        .status-value { color: #0066cc; }
        .form-box { background: #fff; border: 2px solid #333; padding: 20px; margin: 20px 0; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; font-weight: bold; margin-bottom: 5px; }
        .form-group select, .form-group input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-right: 10px; }
        button:hover { background: #1e7e34; }
        button.danger { background: #d32f2f; }
        button.danger:hover { background: #b71c1c; }
        .message { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .message.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .message.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .projects-list { list-style: none; padding: 0; }
        .project-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; margin: 5px 0; background: #f8f9fa; border-radius: 4px; }
        .link-box { background: #fff; border: 1px solid #ddd; padding: 15px; margin: 10px 0; }
        .link-box h3 { margin-top: 0; }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
        #demo-project-description { color: #666; font-style: italic; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>Debugger Server</h1>

    <h2>Server Status</h2>
    <div class="status">
        <div class="status-row"><span class="status-label">HTTP Server:</span><span class="status-value">http://0.0.0.0:${this.options.httpPort}</span></div>
        <div class="status-row"><span class="status-label">Workspace:</span><span class="status-value">${this.options.workspaceRoot}</span></div>
        <div class="status-row"><span class="status-label">Debug WebSocket:</span><span class="status-value">ws://0.0.0.0:${this.options.proxyPort}</span></div>
        <div class="status-row"><span class="status-label">GPIO WebSocket:</span><span class="status-value">ws://0.0.0.0:${this.options.gpioPort}</span></div>
        <div class="status-row"><span class="status-label">Debug Session:</span><span class="status-value">${currentSession ? currentSession.targetFile : 'None'}</span></div>
    </div>

    <h2>Copy Example Project</h2>
    <div class="form-box">
        <div id="demo-message"></div>
        <div class="form-group">
            <label for="demo-project-select">Select Example Project:</label>
            <select id="demo-project-select"><option value="">Loading...</option></select>
        </div>
        <div id="demo-project-description"></div>
        <button onclick="copyDemoProject()">Copy to Workspace</button>
    </div>

    <h2>Workspace Projects</h2>
    <div class="status">
        ${projects.length > 0 ? `
            <ul class="projects-list">
                ${projects.map(p => `<li class="project-item"><span>${p.name}</span><button class="danger" onclick="deleteProject('${p.name}')">Delete</button></li>`).join('')}
            </ul>
        ` : '<p>No projects in workspace</p>'}
    </div>

    <h2>Tools</h2>
    <div class="link-box"><h3>Pithagoras</h3><a href="/app/index.html">Open Pithagoras</a></div>
    <div class="link-box"><h3>Health Check</h3><a href="/health">View Health (JSON)</a></div>

    <script>
        let demoProjects = [];

        function showMessage(msg, isError) {
            const el = document.getElementById('demo-message');
            el.innerHTML = '<div class="message ' + (isError ? 'error' : 'success') + '">' + msg + '</div>';
            setTimeout(() => el.innerHTML = '', 3000);
        }

        async function loadDemoProjects() {
            try {
                const res = await fetch('/api/demo-projects');
                const data = await res.json();
                if (data.success && data.projects) {
                    demoProjects = data.projects;
                    const select = document.getElementById('demo-project-select');
                    select.innerHTML = '<option value="">-- Select --</option>';
                    data.projects.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p.name;
                        opt.textContent = p.name;
                        select.appendChild(opt);
                    });
                    select.onchange = function() {
                        const p = demoProjects.find(x => x.name === this.value);
                        document.getElementById('demo-project-description').textContent = p ? p.description : '';
                    };
                }
            } catch (e) {
                document.getElementById('demo-project-select').innerHTML = '<option>Failed to load</option>';
            }
        }

        async function copyDemoProject() {
            const name = document.getElementById('demo-project-select').value;
            if (!name) { showMessage('Please select a project', true); return; }
            try {
                const res = await fetch('/api/demo-projects/copy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectName: name })
                });
                const data = await res.json();
                showMessage(data.message || data.error, !res.ok);
                if (res.ok) setTimeout(() => location.reload(), 1500);
            } catch (e) { showMessage(e.message, true); }
        }

        async function deleteProject(name) {
            if (!confirm('Delete "' + name + '"?')) return;
            try {
                const res = await fetch('/api/project/' + encodeURIComponent(name), { method: 'DELETE' });
                const data = await res.json();
                if (res.ok) location.reload();
                else alert(data.error);
            } catch (e) { alert(e.message); }
        }

        loadDemoProjects();
    </script>
</body>
</html>
                `);
            });

            // Static files (last)
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

    setupShutdownHandlers() {
        const shutdown = async (signal) => {
            this.logger.info(`\n${signal} received, shutting down...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    async stop() {
        if (!this.isRunning) return;

        this.logger.info('Stopping server...');

        if (this.gpioManager) {
            this.gpioManager.stop();
        }

        if (this.httpServer) {
            await new Promise(resolve => this.httpServer.close(resolve));
        }

        this.httpServer = null;
        this.isRunning = false;
        this.logger.info('Server stopped');
    }
}

// Load config from package.json
function loadConfig() {
    let packageConfig = {};
    try {
        const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
        packageConfig = packageJson['server.config'] || {};
    } catch (err) {
        console.warn('Warning: Could not read server.config from package.json');
    }

    return {
        httpPort: parseInt(process.env.HTTP_PORT) || packageConfig.httpPort || 8080,
        proxyPort: parseInt(process.env.PROXY_PORT) || packageConfig.proxyPort || 8888,
        gpioPort: parseInt(process.env.GPIO_PORT) || packageConfig.gpioPort || 8081,
        inspectPort: parseInt(process.env.INSPECT_PORT) || packageConfig.inspectPort || 9229,
        workspaceRoot: process.env.WORKSPACE_ROOT || packageConfig.workspaceRoot || '/tmp/node-inspector-websocket-proxy',
        staticDirs: process.env.STATIC_DIRS?.split(',') || packageConfig.staticDirs || ['www'],
        logLevels: packageConfig.logLevels || { http: 'info', static: 'info', websocket: 'info' }
    };
}

// Run if executed directly
if (require.main === module) {
    const config = loadConfig();

    console.log('Configuration:');
    console.log('  HTTP Port:', config.httpPort);
    console.log('  Proxy Port:', config.proxyPort);
    console.log('  GPIO Port:', config.gpioPort);
    console.log('  Workspace:', config.workspaceRoot);
    console.log('  Static Dirs:', config.staticDirs);
    console.log('');

    const server = new Server(config);
    server.start().catch(err => {
        console.error('Failed to start:', err);
        process.exit(1);
    });
}

module.exports = { Server, loadConfig };
