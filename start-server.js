/**
 * Start Script - Launches unified test server with both HTTP and WebSocket servers
 *
 * This starts:
 * - HTTP server on port 8080 (serves test files and debugger UI)
 * - WebSocket proxy on port 8888 (debugging protocol)
 * - Node inspector on port 9229 (spawned when client connects)
 */

const { getServer } = require('./test-server');

// Configuration from environment variables or defaults
const config = {
    httpPort: parseInt(process.env.HTTP_PORT) || 8080,
    proxyPort: parseInt(process.env.PROXY_PORT) || 8888,
    inspectPort: parseInt(process.env.INSPECT_PORT) || 9229,
    debugScript: process.env.DEBUG_SCRIPT || './test/fixtures/steppable-script.js'
};

// Get server instance and start
const server = getServer(config);

server.start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});