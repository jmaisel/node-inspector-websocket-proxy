const { spawn } = require('child_process');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const Logger = require("./util/logger")

/**
 * Bidirectional message proxy between client and Node debugger WebSockets
 */
class Proxy{
    /**
     * Creates a new Proxy instance
     * @param {WebSocket} nws - WebSocket connection to Node debugger
     * @param {WebSocket} cws - WebSocket connection to browser client
     */
    constructor(nws, cws){
        this.nodews = nws;
        this.clientws = cws;
        this.logger = new Logger("Proxy");
    }

    /**
     * Sets up bidirectional message forwarding between the two WebSockets
     */
    patch(){

        this.clientws.addEventListener("message", message =>{
            this.logger.info("clientws onmessage", message.data);
            this.nodews.send(message.data);
        });

        this.nodews.on("message", message =>{
            this.logger.info("nodews onmessage", message.toString());
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
     */
    constructor(targetScript, options = {}) {
        this.targetScript = path.resolve(targetScript);
        this.inspectPort = options.inspectPort || 9229;
        this.proxyPort = options.proxyPort || 8888;

        this.debuggerURL = '';
        this.wsDebugger = null;
        this.server = null;
        this.appProcess = null;
        this.activeProxies = [];
        this.logger = new Logger("RemoteDebuggerProxyServer");
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
            this.spawnTargetProcess();
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
        // this.killChildProcess();

        // Create proxy immediately
        const proxy = new Proxy(this.wsDebugger, wsClient);
        this.activeProxies.push(proxy);

        // If debugger is already ready, patch now
        if (this.wsDebugger && this.wsDebugger.readyState === WebSocket.OPEN) {
            proxy.patch();
            this.logger.info('Proxy patched immediately');
        } else {
            // Wait for debugger to be ready
            const clientTimer = setInterval(() => {
                if(this.wsDebugger && this.wsDebugger.readyState === WebSocket.OPEN){
                    proxy.patch();
                    this.logger.info('Proxy patched after wait');
                    clearInterval(clientTimer);
                }
            }, 100);
        }

        wsClient.on('close', () => {
            this.activeProxies = this.activeProxies.filter(p => p !== proxy);
        });
    }

    /**
     * Spawns the target Node process with debugging enabled
     * Captures the debugger WebSocket URL from process output
     * @private
     */
    spawnTargetProcess() {
        this.logger.info(`Spawning process for: ${this.targetScript}`);

        this.appProcess = spawn('node', [`--inspect=${this.inspectPort}`, this.targetScript]);

        // Parse debugger URL from process output
        const checkOutputForUrl = (data) => {
            const output = data.toString();
            process.stdout.write(output);

            const match = output.match(/(ws:\/\/\S+)/);

            if (match && !this.debuggerURL) {
                this.debuggerURL = match[0];
                const uri = this.debuggerURL.replaceAll("ws://", "");
                let spec = uri.split("/")[0].split(":");
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
        });

        this.appProcess.on('exit', (code) => {
            this.logger.info(`Process exited with code ${code}`);
        });
    }

    /**
     * Establishes WebSocket connection to the Node debugger
     * @private
     */
    connectToDebugger() {
        this.logger.info("attempting to connect to debugger at:", this.debuggerURL);
        this.wsDebugger = new WebSocket(this.debuggerURL);

        this.wsDebugger.on('open', () => {
            this.logger.info('*** Internal connection to Node Debugger established. ***');
            this.setupAllDebuggerForwarding();
            this.flushAllBuffers();
        });

        this.wsDebugger.on('close', (code, reason) => {
            this.logger.error(`*** Debugger WebSocket CLOSED: code=${code}, reason=${reason.toString()}`);
        });

        this.wsDebugger.on('error', (err) => {
            this.logger.error('*** INTERNAL PROXY FATAL ERROR:', err.message);
        });
    }

    /**
     * Sets up message forwarding for all active proxies
     * @private
     */
    setupAllDebuggerForwarding() {
        this.logger.info(`Setting up debugger forwarding for ${this.activeProxies.length} active client(s)...`);
        this.activeProxies.forEach(proxy => proxy.setupDebuggerForwarding());
    }

    /**
     * Flushes buffered messages for all active proxies
     * @private
     */
    flushAllBuffers() {
        this.activeProxies.forEach(proxy => proxy.flushBuffer());
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
        this.appProcess.kill();
    }

    restartChildProcess(){
        this.appProcess.kill();
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