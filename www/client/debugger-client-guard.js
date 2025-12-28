/**
 * Debugger Client Guard
 *
 * Prevents clients from connecting to debugger WebSocket
 * without first verifying an active session exists.
 *
 * Usage:
 *   const guard = new DebuggerClientGuard('http://localhost:8080');
 *   const session = await guard.getActiveSession(); // Throws if no session
 *   const debugger = BaseDomainController.initialize(session.wsUrl);
 */

class DebuggerClientGuard {
    /**
     * @param {string} apiBaseUrl - Base URL for APIs (e.g., 'http://localhost:8080')
     */
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        this.cachedSession = null;
    }

    /**
     * Check if an active debug session exists
     * @returns {Promise<Object|null>} Session info or null
     */
    async checkSession() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/debug/session`);

            if (response.status === 404) {
                // No active session
                return null;
            }

            if (!response.ok) {
                throw new Error(`Session check failed: ${response.status}`);
            }

            const session = await response.json();
            this.cachedSession = session;
            return session;
        } catch (error) {
            console.error('Session check error:', error);
            return null;
        }
    }

    /**
     * Get active session or throw error
     * @throws {Error} If no active session exists
     * @returns {Promise<Object>} Session info
     */
    async getActiveSession() {
        const session = await this.checkSession();

        if (!session) {
            throw new Error(
                'No active debug session. Start a session first via POST /debug/session or click Debug on a file.'
            );
        }

        return session;
    }

    /**
     * Wait for a session to become active
     * @param {number} timeout - Timeout in milliseconds
     * @param {number} pollInterval - Polling interval in milliseconds
     * @returns {Promise<Object>} Session info
     */
    async waitForSession(timeout = 30000, pollInterval = 1000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const session = await this.checkSession();
            if (session) {
                return session;
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error('Timeout waiting for debug session to start');
    }

    /**
     * Start a debug session for a file
     * @param {string} filePath - Relative path to file in workspace
     * @returns {Promise<Object>} Session info
     */
    async startSession(filePath) {
        const response = await fetch(`${this.apiBaseUrl}/debug/session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ file: filePath })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to start session');
        }

        const result = await response.json();
        this.cachedSession = result.session;
        return result.session;
    }

    /**
     * Stop the current debug session
     * @returns {Promise<void>}
     */
    async stopSession() {
        if (!this.cachedSession) {
            return;
        }

        const response = await fetch(`${this.apiBaseUrl}/debug/session/${this.cachedSession.sessionId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to stop session');
        }

        this.cachedSession = null;
    }

    /**
     * Clear cached session
     */
    clearCache() {
        this.cachedSession = null;
    }

    /**
     * Get cached session (may be stale)
     * @returns {Object|null} Cached session or null
     */
    getCachedSession() {
        return this.cachedSession;
    }
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebuggerClientGuard;
}
