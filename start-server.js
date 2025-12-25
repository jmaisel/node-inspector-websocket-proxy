/**
 * Start Script - Launches unified test server with both HTTP and WebSocket servers
 *
 * This starts:
 * - HTTP server on port 8080 (serves test files and debugger UI)
 * - WebSocket proxy on port 8888 (debugging protocol)
 * - Node inspector on port 9229 (spawned when client connects)
 */

const { getServer } = require('./test-server');
const path = require('path');

// Configuration from environment variables or defaults
const config = {
    httpPort: parseInt(process.env.HTTP_PORT) || 8080,
    proxyPort: parseInt(process.env.PROXY_PORT) || 8888,
    inspectPort: parseInt(process.env.INSPECT_PORT) || 9229,
    workspaceRoot: process.env.WORKSPACE_ROOT || process.cwd()
};

// Add static directories if specified
// STATIC_DIRS can be a comma-separated list of directories
if (process.env.STATIC_DIRS) {
    const dirs = process.env.STATIC_DIRS.split(',').map(dir => dir.trim());
    config.staticDirs = dirs.map(dir => {
        // Expand ~ to home directory
        if (dir.startsWith('~/')) {
            return path.join(process.env.HOME || process.env.USERPROFILE, dir.slice(2));
        }
        return dir;
    });
    // Add current directory as fallback
    config.staticDirs.push(__dirname);
}

// Get server instance and start
const server = getServer(config);

server.start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});