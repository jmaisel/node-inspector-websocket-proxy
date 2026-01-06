/**
 * Start Script - Launches unified test server with both HTTP and WebSocket servers
 *
 * This starts:
 * - HTTP server on port 8080 (serves test files and debugger UI)
 * - WebSocket proxy on port 8888 (debugging protocol)
 * - Node inspector on port 9229 (spawned when client connects)
 *
 * Configuration priority (highest to lowest):
 * 1. Environment variables (HTTP_PORT, PROXY_PORT, etc.)
 * 2. package.json "server.config" section
 * 3. Hardcoded defaults
 */

const { getServer } = require('./test-server');
const path = require('path');
const fs = require('fs');

// Load configuration from package.json
let packageConfig = {};
try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    packageConfig = packageJson['server.config'] || {};
} catch (err) {
    console.warn('Warning: Could not read server.config from package.json:', err.message);
}

// Hardcoded defaults (lowest priority)
const defaults = {
    httpPort: 8080,
    proxyPort: 8888,
    inspectPort: 9229,
    workspaceRoot: '.',
    staticDirs: [],
    logLevels: {
        http: 'debug',      // HTTP/API server requests (most verbose by default)
        static: 'debug',    // Static file serving (most verbose by default)
        websocket: 'debug'  // WebSocket proxy (most verbose by default)
    }
};

// Build config with priority: env vars > package.json > defaults
const config = {
    httpPort: parseInt(process.env.HTTP_PORT) || packageConfig.httpPort || defaults.httpPort,
    proxyPort: parseInt(process.env.PROXY_PORT) || packageConfig.proxyPort || defaults.proxyPort,
    inspectPort: parseInt(process.env.INSPECT_PORT) || packageConfig.inspectPort || defaults.inspectPort,
    workspaceRoot: process.env.WORKSPACE_ROOT || packageConfig.workspaceRoot || defaults.workspaceRoot,
    demoProjectPath: process.env.DEMO_PROJECT_PATH || packageConfig.demoProjectPath,
    logLevels: {
        http: process.env.LOG_LEVEL_HTTP || packageConfig.logLevels?.http || defaults.logLevels.http,
        static: process.env.LOG_LEVEL_STATIC || packageConfig.logLevels?.static || defaults.logLevels.static,
        websocket: process.env.LOG_LEVEL_WEBSOCKET || packageConfig.logLevels?.websocket || defaults.logLevels.websocket
    }
};

// Resolve workspace root to absolute path
if (config.workspaceRoot === '.') {
    config.workspaceRoot = __dirname;
} else if (!path.isAbsolute(config.workspaceRoot)) {
    config.workspaceRoot = path.join(__dirname, config.workspaceRoot);
}

// Handle static directories
// Priority: env vars > package.json > defaults
let staticDirs = [];

if (process.env.STATIC_DIRS) {
    // Environment variable takes precedence
    staticDirs = process.env.STATIC_DIRS.split(',').map(dir => dir.trim());
} else if (packageConfig.staticDirs && packageConfig.staticDirs.length > 0) {
    // Use package.json config
    staticDirs = packageConfig.staticDirs;
}

if (staticDirs.length > 0) {
    config.staticDirs = staticDirs.map(dir => {
        // Expand ~ to home directory
        if (dir.startsWith('~/')) {
            return path.join(process.env.HOME || process.env.USERPROFILE, dir.slice(2));
        }
        // Resolve relative paths
        if (!path.isAbsolute(dir)) {
            return path.join(__dirname, dir);
        }
        return dir;
    });
    // Add current directory as fallback
    if (!config.staticDirs.includes(__dirname)) {
        config.staticDirs.push(__dirname);
    }
}

// Log configuration source
console.log('Server configuration loaded:');
console.log('  HTTP Port:', config.httpPort, process.env.HTTP_PORT ? '(from env)' : packageConfig.httpPort ? '(from package.json)' : '(default)');
console.log('  Proxy Port:', config.proxyPort, process.env.PROXY_PORT ? '(from env)' : packageConfig.proxyPort ? '(from package.json)' : '(default)');
console.log('  Inspect Port:', config.inspectPort, process.env.INSPECT_PORT ? '(from env)' : packageConfig.inspectPort ? '(from package.json)' : '(default)');
console.log('  Workspace Root:', config.workspaceRoot, process.env.WORKSPACE_ROOT ? '(from env)' : packageConfig.workspaceRoot ? '(from package.json)' : '(default)');
if (config.staticDirs) {
    console.log('  Static Dirs:', config.staticDirs.length, 'directories');
}
console.log('  Log Levels:');
console.log('    HTTP/API:', config.logLevels.http, process.env.LOG_LEVEL_HTTP ? '(from env)' : packageConfig.logLevels?.http ? '(from package.json)' : '(default)');
console.log('    Static:', config.logLevels.static, process.env.LOG_LEVEL_STATIC ? '(from env)' : packageConfig.logLevels?.static ? '(from package.json)' : '(default)');
console.log('    WebSocket:', config.logLevels.websocket, process.env.LOG_LEVEL_WEBSOCKET ? '(from env)' : packageConfig.logLevels?.websocket ? '(from package.json)' : '(default)');
console.log('');

// Get server instance and start
const server = getServer(config);

server.start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});