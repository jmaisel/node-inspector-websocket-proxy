/**
 * AuthMiddleware - Handles API key authentication for workspace operations
 * Designed to be pluggable for future mTLS support
 */
class AuthMiddleware {
    /**
     * Creates a new AuthMiddleware instance
     * @param {Object} config - Configuration object
     * @param {string[]} config.apiKeys - Array of valid API keys
     * @param {string} [config.apiKeyHeader='X-Workspace-API-Key'] - Header name for API key
     */
    constructor(config = {}) {
        this.apiKeys = config.apiKeys || [];
        this.apiKeyHeader = config.apiKeyHeader || 'X-Workspace-API-Key';
    }

    /**
     * Express middleware that requires authentication
     * Checks for valid API key in request headers
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     * @param {Function} next - Express next function
     */
    requireAuth = (req, res, next) => {
        const apiKey = req.headers[this.apiKeyHeader.toLowerCase()];

        if (!apiKey) {
            return res.status(401).json({
                error: 'Authentication required',
                message: `Missing ${this.apiKeyHeader} header`
            });
        }

        if (!this.validateApiKey(apiKey)) {
            return res.status(403).json({
                error: 'Authentication failed',
                message: 'Invalid API key'
            });
        }

        // Authentication successful
        next();
    };

    /**
     * Express middleware that allows all requests (no authentication)
     * Use this for development or when authentication is not required
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     * @param {Function} next - Express next function
     */
    noAuth = (req, res, next) => {
        // No authentication required, just pass through
        next();
    };

    /**
     * Validates an API key
     * @param {string} key - API key to validate
     * @returns {boolean} True if key is valid
     */
    validateApiKey(key) {
        return this.apiKeys.includes(key);
    }

    /**
     * Adds an API key to the list of valid keys
     * @param {string} key - API key to add
     */
    addApiKey(key) {
        if (!this.apiKeys.includes(key)) {
            this.apiKeys.push(key);
        }
    }

    /**
     * Removes an API key from the list of valid keys
     * @param {string} key - API key to remove
     */
    removeApiKey(key) {
        const index = this.apiKeys.indexOf(key);
        if (index > -1) {
            this.apiKeys.splice(index, 1);
        }
    }
}

module.exports = AuthMiddleware;
