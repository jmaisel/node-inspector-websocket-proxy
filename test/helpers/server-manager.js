/**
 * Shared server lifecycle management for tests
 * Handles starting/stopping servers with proper port checking and cleanup
 */

const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const { promisify } = require('util');
const sleep = promisify(setTimeout);
const path = require('path');
const RemoteDebuggerProxyServer = require('../../inspector-proxy-factory');

/**
 * Check if a port is in use
 * @param {number} port - Port to check
 * @returns {Promise<boolean>} - True if port is in use
 */
async function isPortInUse(port) {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(true);
            } else {
                resolve(false);
            }
        });

        server.once('listening', () => {
            server.close();
            resolve(false);
        });

        server.listen(port);
    });
}

/**
 * Check if HTTP server is responding on a port
 * @param {number} port - Port to check
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<boolean>} - True if server is responding
 */
async function isServerResponding(port, timeout = 1000) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}`, { timeout }, (res) => {
            resolve(res.statusCode < 500);
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
    });
}

/**
 * Wait for a server to be ready
 * @param {number} port - Port to check
 * @param {number} maxAttempts - Maximum number of attempts
 * @param {number} interval - Interval between attempts in ms
 * @returns {Promise<boolean>} - True if server is ready
 */
async function waitForServer(port, maxAttempts = 30, interval = 500) {
    for (let i = 0; i < maxAttempts; i++) {
        if (await isServerResponding(port)) {
            return true;
        }
        await sleep(interval);
    }
    return false;
}

/**
 * Server manager for test lifecycle
 */
class ServerManager {
    constructor(options = {}) {
        this.options = {
            proxyPort: 8888,
            inspectPort: 9229,
            httpPort: 8080,
            debugScript: 'test/fixtures/busy-script.js',
            checkExisting: true,  // Check if servers already running
            ...options
        };

        this.proxyServer = null;
        this.debuggeeProcess = null;
        this.httpServer = null;

        // Track what we spawned (so we only kill what we started)
        this.spawnedProxy = false;
        this.spawnedDebuggee = false;
        this.spawnedHttp = false;
    }

    /**
     * Start all required servers
     * Checks if servers are already running before spawning
     * @returns {Promise<Object>} - Status of each server
     */
    async start() {
        const status = {
            proxy: { running: false, spawned: false },
            debuggee: { running: false, spawned: false },
            http: { running: false, spawned: false }
        };

        // Check if debuggee port is already in use
        // RemoteDebuggerProxyServer needs this port free to spawn its own debuggee
        if (await isPortInUse(this.options.inspectPort)) {
            throw new Error(
                `Port ${this.options.inspectPort} is already in use!\n` +
                `The proxy server needs this port free to manage the debuggee lifecycle.\n` +
                `Please stop any manually-running debuggee processes before running tests.\n` +
                `Use: pkill -f "node --inspect=${this.options.inspectPort}"`
            );
        }

        // Check proxy server (port 8888)
        if (this.options.checkExisting && await isPortInUse(this.options.proxyPort)) {
            console.log(`Proxy server already running on port ${this.options.proxyPort}`);
            status.proxy.running = true;
        } else {
            await this._startProxyServer();
            status.proxy.running = true;
            status.proxy.spawned = true;
            this.spawnedProxy = true;
        }

        console.log(`Proxy will spawn debuggee on port ${this.options.inspectPort} when clients connect`);

        // Check HTTP server (port 8080) - optional
        if (this.options.checkExisting && await isPortInUse(this.options.httpPort)) {
            console.log(`HTTP server already running on port ${this.options.httpPort}`);
            status.http.running = true;
        }
        // Note: We don't spawn HTTP server - user should run it manually with http-server

        return status;
    }

    /**
     * Start proxy server using RemoteDebuggerProxyServer class
     * @private
     */
    async _startProxyServer() {
        console.log('Starting proxy server...');

        // Instantiate RemoteDebuggerProxyServer with target script
        const scriptPath = path.resolve(this.options.debugScript);
        this.proxyServer = new RemoteDebuggerProxyServer(scriptPath, {
            inspectPort: this.options.inspectPort,
            proxyPort: this.options.proxyPort
        });

        // Start the proxy server
        this.proxyServer.start();

        // Wait for proxy server to be ready
        const ready = await waitForServer(this.options.proxyPort, 30, 500);
        if (!ready) {
            throw new Error('Proxy server failed to start');
        }

        console.log(`Proxy server ready on port ${this.options.proxyPort}`);
    }

    /**
     * Start debuggee process with --inspect flag
     * @private
     */
    async _startDebuggee() {
        console.log('Starting debuggee process...');

        this.debuggeeProcess = spawn('node', [
            `--inspect=${this.options.inspectPort}`,
            this.options.debugScript
        ], {
            stdio: 'pipe',
            detached: false
        });

        this.debuggeeProcess.stdout.on('data', (data) => {
            if (process.env.DEBUG_TESTS) {
                console.log(`[Debuggee] ${data.toString().trim()}`);
            }
        });

        this.debuggeeProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes('Debugger listening') || msg.includes('Debugger attached')) {
                console.log('Debuggee ready');
            }
            if (process.env.DEBUG_TESTS) {
                console.error(`[Debuggee] ${msg.trim()}`);
            }
        });

        this.debuggeeProcess.on('exit', (code, signal) => {
            if (code !== null && code !== 0 && this.spawnedDebuggee) {
                console.error(`Debuggee exited with code ${code}`);
            }
        });

        // Wait for debuggee to be ready (inspector port to be listening)
        await sleep(2000);

        const isReady = await isPortInUse(this.options.inspectPort);
        if (!isReady) {
            throw new Error('Debuggee failed to start inspector');
        }
    }

    /**
     * Stop all servers that we spawned
     * Only kills processes that this instance started
     */
    async stop() {
        console.log('Stopping servers...');

        const cleanupPromises = [];

        // Stop proxy server if we spawned it
        if (this.proxyServer && this.spawnedProxy) {
            console.log('Stopping proxy server...');
            try {
                this.proxyServer.stop();
                this.proxyServer = null;
            } catch (err) {
                console.error('Error stopping proxy server:', err.message);
            }
        }

        // Stop debuggee process if we spawned it
        if (this.debuggeeProcess && this.spawnedDebuggee) {
            cleanupPromises.push(this._stopProcess(this.debuggeeProcess, 'Debuggee'));
            this.debuggeeProcess = null;
        }

        await Promise.all(cleanupPromises);

        console.log('Server cleanup complete');
    }

    /**
     * Stop a process gracefully with timeout
     * @private
     */
    async _stopProcess(process, name) {
        return new Promise((resolve) => {
            if (!process || process.killed) {
                resolve();
                return;
            }

            const timeout = setTimeout(() => {
                if (!process.killed) {
                    console.log(`Force killing ${name}...`);
                    process.kill('SIGKILL');
                }
                resolve();
            }, 5000);

            process.once('exit', () => {
                clearTimeout(timeout);
                resolve();
            });

            process.kill('SIGTERM');
        });
    }
}

/**
 * Create a server manager instance
 * @param {Object} options - Configuration options
 * @returns {ServerManager}
 */
function createServerManager(options) {
    return new ServerManager(options);
}

module.exports = {
    ServerManager,
    createServerManager,
    isPortInUse,
    isServerResponding,
    waitForServer
};