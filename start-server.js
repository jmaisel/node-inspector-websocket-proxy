const RemoteDebuggerProxyServer = require("./inspector-proxy-factory")

// Usage example (commented out to prevent auto-start):
const proxy = new RemoteDebuggerProxyServer('./test/fixtures/busy-script.js', {
    inspectPort: 9229,
    proxyPort: 8888
});
proxy.start();