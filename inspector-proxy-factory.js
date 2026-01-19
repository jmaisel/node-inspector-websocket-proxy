const { spawn } = require('child_process');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const Logger = require('./util/logger');

/**
 * Bidirectional message proxy between client and Node debugger WebSockets
 */
class Proxy{
    /**
     * Creates a new Proxy instance
     * @param {WebSocket} nws - WebSocket connection to Node debugger
     * @param {WebSocket} cws - WebSocket connection to browser client
     */
    constructor(nws, cws, logLevel){
        this.nodews = nws;
        this.clientws = cws;
        this.logLevel = logLevel || 'debug';
        this.logger = new Logger('Proxy', 'info', this.logLevel);
    }

    /**
     * Sets up bidirectional message forwarding between the two WebSockets
     */
    patch(){

        this.clientws.addEventListener('message', message =>{
            // Logging disabled - causes CPU pegging with high message volume
            // this.logger.info("clientws onmessage", message.data);
            this.nodews.send(message.data);
        });

        this.nodews.on('message', message =>{
            // Logging disabled - causes CPU pegging with high message volume
            // this.logger.info("nodews onmessage", message.toString());
            this.clientws.send(message.toString());
        });

    }

    /**
     * Cleans up proxy resources
     */
    cleanup(){
        // WebSocket connections are managed by their owners
        // This method is here for future extensibility
        this.nodews = null;
        this.clientws = null;
    }
}

/**
 * Proxy server that spawns a Node process with debugging enabled and
 * allows remote clients to connect via WebSocket
 */
class RemoteDebuggerProxyServer {
    /**
     * Creates a new RemoteDebuggerProxyServer instance
     * @param {string} targetScript - Path to the Node script to debug
     * @param {Object} [options={}] - Configuration options
     * @param {number} [options.inspectPort=9229] - Port for Node inspector
     * @param {number} [options.proxyPort=8888] - Port for proxy server
     * @param {string} [options.logLevel='debug'] - Log level for WebSocket operations (debug, info, warn, error)
     */
    constructor(targetScript, options = {}) {
        this.targetScript = path.resolve(targetScript);
        this.inspectPort = options.inspectPort || 9229;
        this.proxyPort = options.proxyPort || 8888;
        this.logLevel = options.logLevel || 'debug';

        this.debuggerURL = '';
        this.wsDebugger = null;
        this.server = null;
        this.appProcess = null;
        this.activeProxies = [];
        this.logger = new Logger('RemoteDebuggerProxyServer', 'info', this.logLevel);
    }

    /**
     * Starts the proxy server and spawns the target process
     */
    start() {
        this.startHttpServer();
        this.setupWebSocketUpgrade();
    }

    /**
     * Starts the HTTP server for handling WebSocket upgrades
     * @private
     */
    startHttpServer() {
        this.server = http.createServer((req, res) => {
            res.writeHead(200);
            res.end('Debugger Proxy API is running.');
        });

        this.server.listen(this.proxyPort, () => {
            this.logger.info(`Proxy API listening on http://localhost:${this.proxyPort}`);
            this.logger.info(`Connect your client to ws://localhost:${this.proxyPort}\n`);
            // Don't spawn process here - wait for client connection
        });
    }

    /**
     * Sets up WebSocket upgrade handling for incoming client connections
     * @private
     */
    setupWebSocketUpgrade() {
        this.server.on('upgrade', (request, socket, head) => {
            const wss = new WebSocket.Server({ noServer: true });
            wss.handleUpgrade(request, socket, head, (wsClient) => {
                this.killChildProcess();
                this.handleNewClient(wsClient);
            });
        });
    }

    /**
     * Handles a new client connection
     * Waits for debugger to be ready before creating proxy
     * @param {WebSocket} wsClient - The client WebSocket connection
     * @private
     */

    handleNewClient(wsClient) {
        this.logger.info('Browser client connected');

        // If a process is being killed, wait for it to exit before spawning new one
        const attemptSpawn = () => {
            if (this.appProcess) {
                this.logger.info(this.appProcess.killed ? 'Process is killed but not exited yet, waiting...' : 'Process still running, waiting...');
                setTimeout(attemptSpawn, 1000);
                return;
            }
            // Process is fully cleaned up, safe to spawn
            // this.spawnTargetProcess();
            this.restartChildProcess();
        };

        attemptSpawn();

        // Event-driven proxy setup (replaces busy-wait polling)
        const setupProxy = () => {
            // Create and patch proxy
            const proxy = new Proxy(this.wsDebugger, wsClient, this.logLevel);
            this.activeProxies.push(proxy);
            proxy.patch();
            this.logger.info('Proxy created and patched');

            // Send ready signal to client
            wsClient.send(JSON.stringify({
                method: 'Proxy.ready',
                params: {}
            }));
        };

        // Set up event listener for when debugger becomes ready
        const onDebuggerReady = () => {
            if (this.wsDebugger && this.wsDebugger.readyState === WebSocket.OPEN) {
                setupProxy();
            } else if (this.wsDebugger) {
                this.wsDebugger.once('open', setupProxy);
            }
        };

        // Check if debugger is already open, otherwise wait for it
        onDebuggerReady();

        // Also check periodically in case wsDebugger gets set after this point
        // (but at a reasonable 100ms interval, not 1ms)
        const checkDebuggerInterval = setInterval(() => {
            if (this.wsDebugger) {
                clearInterval(checkDebuggerInterval);
                onDebuggerReady();
            }
        }, 100);

        // When client closes, kill debugger process
        wsClient.on('close', () => {
            clearInterval(checkDebuggerInterval);
            this.logger.info('Client disconnected, killing debugger process');
            this.activeProxies = this.activeProxies.filter(p => p.clientws !== wsClient);
            this.killChildProcess();
            // Reset state for next connection
            this.wsDebugger = null;
            this.debuggerURL = '';
        });
    }

    /**
     * Spawns the target Node process with debugging enabled
     * Captures the debugger WebSocket URL from process output
     * @private
     */
    spawnTargetProcess() {
        // Don't spawn if already running and alive
        if (this.appProcess && !this.appProcess.killed) {
            this.logger.info('Process already running, skipping spawn');
            return;
        }

        this.logger.info(`Spawning process for: ${this.targetScript}`);

        this.appProcess = spawn('node', [`--inspect=${this.inspectPort}`, this.targetScript]);

        // Parse debugger URL from process output
        const checkOutputForUrl = (data) => {
            const output = data.toString();
            process.stdout.write(output);

            const match = output.match(/(ws:\/\/\S+)/);

            if (match && !this.debuggerURL) {
                this.debuggerURL = match[0];
                const uri = this.debuggerURL.replaceAll('ws://', '');
                let spec = uri.split('/')[0].split(':');
                let host = spec[0];
                let port = spec[1];
                let guid = uri.split('/')[1];

                this.debuggerInf = {host, port, guid};
                this.logger.info(`\n*** Captured Debugger URL: ${this.debuggerURL} ***\n`, this.debuggerInf);
                this.connectToDebugger();
            }
        };

        this.appProcess.stdout.on('data', checkOutputForUrl);
        this.appProcess.stderr.on('data', checkOutputForUrl);

        this.appProcess.on('error', (err) => {
            this.logger.error('Failed to spawn application process:', err);
            this.appProcess = null;
        });

        this.appProcess.on('exit', (code) => {
            this.logger.info(`Process exited with code ${code}`);
            // Clean up reference when process actually exits
            this.appProcess = null;
        });
    }

    /**
     * Establishes WebSocket connection to the Node debugger
     * @private
     */
    connectToDebugger() {
        this.logger.info('attempting to connect to debugger at:', this.debuggerURL);
        this.wsDebugger = new WebSocket(this.debuggerURL);

        this.wsDebugger.on('open', () => {
            this.logger.info('*** Internal connection to Node Debugger established. ***');
        });

        this.wsDebugger.on('close', (code, reason) => {
            this.logger.error(`*** Debugger WebSocket CLOSED: code=${code}, reason=${reason.toString()}`);
        });

        this.wsDebugger.on('error', (err) => {
            this.logger.error('*** INTERNAL PROXY FATAL ERROR:', err.message);
        });
    }

    /**
     * Gets the debugger WebSocket URL
     * @returns {string} The debugger WebSocket URL
     */
    getDebuggerWebSocketUrl() {
        return this.debuggerURL;
    }

    /**
     * Stops the proxy server and cleans up all resources
     */
    killChildProcess() {
        if (this.appProcess) {
            this.logger.info('Killing child process...');
            try {
                this.appProcess.kill();
                // Don't set to null here - let the exit handler do it
            } catch (err) {
                this.logger.error('Error killing process:', err);
                this.appProcess = null;
            }
        }
    }

    restartChildProcess(){

        try{
            this.killChildProcess();
        }
        catch (e){
            console.error(e);
        }

        this.spawnTargetProcess();
    }

    /**
     * Stops the proxy server and cleans up all resources
     */
    stop() {
        if (this.server) this.server.close();
        if (this.wsDebugger) this.wsDebugger.close();
        if (this.appProcess) this.killChildProcess();
        this.activeProxies.forEach(proxy => proxy.cleanup());
    }
}

module.exports = RemoteDebuggerProxyServer;