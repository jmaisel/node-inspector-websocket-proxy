/**
 * Session Guard Middleware
 *
 * Enforces that debugger WebSocket connections can only be made
 * when an active debug session exists.
 *
 * This prevents clients from connecting to ws://localhost:8888
 * without first starting a session via POST /debug/session.
 */

class SessionGuard {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
    }

    /**
     * Check if a session exists before allowing connection
     * @returns {boolean} True if session exists
     */
    hasActiveSession() {
        const session = this.sessionManager.getCurrentSession();
        return session !== null && session.status === 'running';
    }

    /**
     * Get current session or throw error
     * @throws {Error} If no active session
     * @returns {Object} Current session
     */
    requireActiveSession() {
        if (!this.hasActiveSession()) {
            throw new Error(
                'No active debug session. Start a session first via POST /debug/session'
            );
        }
        return this.sessionManager.getCurrentSession();
    }

    /**
     * Express middleware to check for active session
     * Returns 503 Service Unavailable if no session
     */
    checkSessionMiddleware = (req, res, next) => {
        if (!this.hasActiveSession()) {
            return res.status(503).json({
                error: 'No active debug session',
                message: 'Start a debug session first via POST /debug/session',
                hint: 'Use the Workspace Browser to select a file and click Debug'
            });
        }
        next();
    };
}

module.exports = SessionGuard;
