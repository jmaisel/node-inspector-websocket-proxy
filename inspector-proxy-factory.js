const { spawn } = require('child_process');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const Logger = require("./util/logger")

class Proxy{
    constructor(nws, cws){
        this.nodews = nws;
        this.clientws = cws;
        this.logger = new Logger("Proxy");
    }

    patch(){
        this.clientws.addEventListener("message", message =>{
            this.logger.info("clientws onmessage", message.data);
            this.nodews.send(message.data);
            // this.nodews.send(message);
        });

        this.nodews.on("message", message =>{
            this.logger.info("nodews onmessage", message.toString());
            // this.clientws.send(message);
            this.clientws.send(message.toString());
        });
    }
}

class RemoteDebuggerProxyServer {
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

    start() {
        this.startHttpServer();
        this.setupWebSocketUpgrade();
    }

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

    setupWebSocketUpgrade() {
        this.server.on('upgrade', (request, socket, head) => {
            const wss = new WebSocket.Server({ noServer: true });
            wss.handleUpgrade(request, socket, head, (wsClient) => {
                this.handleNewClient(wsClient);
            });
        });
    }

    handleNewClient(wsClient) {

        if(this.logger)
        this.logger.info('Browser client connected, waiting for debugger to start');

        if(!this.timer){
            let that = this;
            this.timer = setInterval(()=>{
                if(that.wsDebugger != null){
                    this.logger.info('Debugger ready, creating proxy');

                    let proxy = new Proxy(that.wsDebugger, wsClient);
                    proxy.patch();

                    this.logger.info('Proxy ready');

                    this.activeProxies.push(proxy);

                    wsClient.on('close', () => {
                        this.activeProxies = this.activeProxies.filter(p => p !== proxy);
                    });

                    clearInterval(that.timer);
                    delete that.timer;
                }
            }, 100);
        }
    }

    spawnTargetProcess() {
        this.logger.info(`Spawning process for: ${this.targetScript}`);

        // this.appProcess = spawn('node', [`--inspect-brk=${this.inspectPort}`, this.targetScript]);
        this.appProcess = spawn('node', [`--inspect=${this.inspectPort}`, this.targetScript]);

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

    setupAllDebuggerForwarding() {
        this.logger.info(`Setting up debugger forwarding for ${this.activeProxies.length} active client(s)...`);
        this.activeProxies.forEach(proxy => proxy.setupDebuggerForwarding());
    }

    flushAllBuffers() {
        this.activeProxies.forEach(proxy => proxy.flushBuffer());
    }

    stop() {
        if (this.server) this.server.close();
        if (this.wsDebugger) this.wsDebugger.close();
        if (this.appProcess) this.appProcess.kill();
        this.activeProxies.forEach(proxy => proxy.cleanup());
    }
}

// Usage:
const proxy = new RemoteDebuggerProxyServer('./test/fixtures/busy-script.js', {
    inspectPort: 9229,
    proxyPort: 8888
});
proxy.start();

module.exports = RemoteDebuggerProxyServer;