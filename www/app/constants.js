/**
 * Application Constants
 * Centralized configuration values used across the application
 */

// Server Ports (defaults - actual values loaded from server/package.json)
const PORTS = {
    HTTP: 8080,
    GPIO_WS: 8081,
    PROXY_WS: 8888,
    INSPECT: 9229
};

// Default URLs (fallback if application.store not available)
const DEFAULT_URLS = {
    HTTP_BASE: `http://localhost:${PORTS.HTTP}`,
    GPIO_WS: `ws://localhost:${PORTS.GPIO_WS}`,
    PROXY_WS: `ws://localhost:${PORTS.PROXY_WS}`,
    INSPECT_WS: `ws://localhost:${PORTS.INSPECT}`
};

/**
 * Get server URLs from application store
 * Falls back to DEFAULT_URLS if store is not available
 * @param {Object} application - The application context with store
 * @returns {Object} Server URLs object
 */
function getServerUrls(application) {
    if (application && application.store && application.store.has('serverUrls')) {
        return application.store.get('serverUrls');
    }
    // Fallback to defaults
    return {
        hostname: 'localhost',
        httpPort: PORTS.HTTP,
        proxyPort: PORTS.PROXY_WS,
        gpioPort: PORTS.GPIO_WS,
        inspectPort: PORTS.INSPECT,
        httpBase: DEFAULT_URLS.HTTP_BASE,
        proxyWs: DEFAULT_URLS.PROXY_WS,
        gpioWs: DEFAULT_URLS.GPIO_WS,
        inspectWs: DEFAULT_URLS.INSPECT_WS,
        apiProject: '/api/project',
        apiWorkspace: '/workspace',
        apiDebugSession: '/debug/session'
    };
}

// API Endpoints
const API_ENDPOINTS = {
    PROJECT: '/api/project',
    WORKSPACE: '/workspace',
    DEBUG_SESSION: '/debug/session'
};

// WebSocket Message Types
const WS_MESSAGE_TYPES = {
    // Registration
    REGISTER: 'register',
    REGISTERED: 'registered',

    // GPIO Commands
    SET_GPIO_INPUT: 'setGPIOInput',
    SET_GPIO_INPUT_STATE: 'setGPIOInputState',
    GET_GPIO_INPUT_STATE: 'getGPIOInputState',
    GET_GPIO_OUTPUT_STATE: 'getGPIOOutputState',
    REGISTER_GPIO_OUTPUT_CALLBACK: 'registerGPIOOutputCallback',
    CREATE_GPIO_INPUT: 'createGPIOInput',
    CREATE_GPIO_OUTPUT: 'createGPIOOutput',
    REMOVE_ALL_GPIO_PINS: 'removeAllGPIOPins',
    GPIO_OUTPUT_CHANGED: 'gpioOutputChanged',

    // Generic
    RESPONSE: 'response',
    ERROR: 'error'
};

// Reconnect Settings
const RECONNECT = {
    DELAY: 3000,
    ENABLED: true
};

// WebSocket Close Codes
const WS_CLOSE_CODES = {
    NORMAL: 1000,
    GOING_AWAY: 1001,
    PROTOCOL_ERROR: 1002,
    UNSUPPORTED_DATA: 1003
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.APP_CONSTANTS = {
        PORTS,
        DEFAULT_URLS,
        API_ENDPOINTS,
        WS_MESSAGE_TYPES,
        RECONNECT,
        WS_CLOSE_CODES,
        getServerUrls
    };
}

// Also support module exports for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PORTS,
        DEFAULT_URLS,
        API_ENDPOINTS,
        WS_MESSAGE_TYPES,
        RECONNECT,
        WS_CLOSE_CODES,
        getServerUrls
    };
}