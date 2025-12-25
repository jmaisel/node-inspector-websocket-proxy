const express = require('express');
const path = require('path');
const RemoteDebuggerProxyServer = require('../inspector-proxy-factory');
const WorkspaceSecurity = require('./workspace-security');
const AuthMiddleware = require('./auth-middleware');

/**
 * Debugger Session Management API
 *
 * Manages debugger sessions tied to workspace files.
 * A session must be started explicitly with a target file from the workspace.
 *
 * Lifecycle:
 * 1. Client establishes workspace (GET /workspace/info)
 * 2. Client browses files (GET /project/*)
 * 3. Client starts debug session (POST /debug/session with {file})
 * 4. Client connects to WebSocket (ws://localhost:8888)
 * 5. Client debugs...
 * 6. Client stops session (DELETE /debug/session/:id)
 * 7. Client can start new session with different file
 */

class DebuggerSessionManager {
    constructor(config = {}) {
        this.sessions = new Map();
        this.nextSessionId = 1;
        this.workspaceSecurity = new WorkspaceSecurity(config.workspaceRoot || process.cwd());
        this.proxyPort = config.proxyPort || 8888;
        this.inspectPort = config.inspectPort || 9229;
    }

    /**
     * Start a new debug session
     * @param {string} targetFile - Relative path to file from workspace root
     * @returns {Promise<Object>} Session info
     */
    async startSession(targetFile) {
        // Validate file is within workspace
        const absolutePath = await this.workspaceSecurity.validatePath(targetFile);

        // Stop any existing session (only one session at a time for now)
        await this.stopAllSessions();

        // Create session ID
        const sessionId = `session-${this.nextSessionId++}`;

        // Create proxy server
        const proxy = new RemoteDebuggerProxyServer(absolutePath, {
            inspectPort: this.inspectPort,
            proxyPort: this.proxyPort
        });

        // Start the proxy (this spawns the Node process)
        proxy.start();

        // Store session
        this.sessions.set(sessionId, {
            id: sessionId,
            targetFile,
            absolutePath,
            proxy,
            startedAt: new Date().toISOString(),
            status: 'running'
        });

        return {
            sessionId,
            targetFile,
            wsUrl: `ws://localhost:${this.proxyPort}`,
            inspectPort: this.inspectPort,
            proxyPort: this.proxyPort,
            status: 'running'
        };
    }

    /**
     * Stop a specific session
     * @param {string} sessionId - Session ID to stop
     */
    async stopSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        // Stop the proxy server (kills Node process)
        if (session.proxy) {
            session.proxy.stop();
        }

        session.status = 'stopped';
        session.stoppedAt = new Date().toISOString();

        this.sessions.delete(sessionId);

        return {
            sessionId,
            status: 'stopped'
        };
    }

    /**
     * Stop all sessions
     */
    async stopAllSessions() {
        const promises = Array.from(this.sessions.keys()).map(id => this.stopSession(id));
        await Promise.all(promises);
    }

    /**
     * Get session info
     * @param {string} sessionId - Session ID
     * @returns {Object} Session info
     */
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        return {
            sessionId: session.id,
            targetFile: session.targetFile,
            absolutePath: session.absolutePath,
            startedAt: session.startedAt,
            status: session.status,
            wsUrl: `ws://localhost:${this.proxyPort}`,
            inspectPort: this.inspectPort,
            proxyPort: this.proxyPort
        };
    }

    /**
     * List all sessions
     * @returns {Array} Array of session info
     */
    listSessions() {
        return Array.from(this.sessions.values()).map(session => ({
            sessionId: session.id,
            targetFile: session.targetFile,
            startedAt: session.startedAt,
            status: session.status
        }));
    }

    /**
     * Get current active session (if any)
     * @returns {Object|null} Current session or null
     */
    getCurrentSession() {
        // For now, we only support one session at a time
        if (this.sessions.size > 0) {
            const sessionId = Array.from(this.sessions.keys())[0];
            return this.getSession(sessionId);
        }
        return null;
    }
}

/**
 * Create debugger session API router
 * @param {Object} config - Configuration
 * @returns {express.Router} Express router
 */
function createDebuggerSessionApi(config = {}) {
    const router = express.Router();
    const sessionManager = new DebuggerSessionManager(config);

    // Optional authentication
    const auth = new AuthMiddleware({
        apiKeys: config.apiKeys || [],
        apiKeyHeader: 'X-Workspace-API-Key'
    });

    // Optionally require auth for starting sessions
    // Use noAuth method when authentication is not required (keeps middleware in place)
    const maybeAuth = config.requireAuth ? auth.requireAuth : auth.noAuth;

    /**
     * POST /debug/session - Start a new debug session
     * Body: { file: "/path/to/script.js" }
     */
    router.post('/session', maybeAuth, async (req, res) => {
        try {
            const { file } = req.body;

            if (!file) {
                return res.status(400).json({
                    error: 'Bad request',
                    message: 'Missing required field: file'
                });
            }

            const session = await sessionManager.startSession(file);

            res.status(201).json({
                success: true,
                session
            });
        } catch (error) {
            console.error('Error starting session:', error);

            if (error.message.includes('Path traversal')) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: error.message
                });
            }

            res.status(500).json({
                error: 'Failed to start session',
                message: error.message
            });
        }
    });

    /**
     * GET /debug/session - Get current session info
     */
    router.get('/session', (req, res) => {
        try {
            const session = sessionManager.getCurrentSession();

            if (!session) {
                return res.status(404).json({
                    error: 'No active session',
                    message: 'No debug session is currently running'
                });
            }

            res.json(session);
        } catch (error) {
            res.status(500).json({
                error: 'Failed to get session',
                message: error.message
            });
        }
    });

    /**
     * GET /debug/sessions - List all sessions
     */
    router.get('/sessions', (req, res) => {
        try {
            const sessions = sessionManager.listSessions();
            res.json({ sessions });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to list sessions',
                message: error.message
            });
        }
    });

    /**
     * GET /debug/session/:id - Get specific session info
     */
    router.get('/session/:id', (req, res) => {
        try {
            const session = sessionManager.getSession(req.params.id);
            res.json(session);
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    error: 'Session not found',
                    message: error.message
                });
            }

            res.status(500).json({
                error: 'Failed to get session',
                message: error.message
            });
        }
    });

    /**
     * DELETE /debug/session/:id - Stop a session
     */
    router.delete('/session/:id', maybeAuth, async (req, res) => {
        try {
            const result = await sessionManager.stopSession(req.params.id);

            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    error: 'Session not found',
                    message: error.message
                });
            }

            res.status(500).json({
                error: 'Failed to stop session',
                message: error.message
            });
        }
    });

    /**
     * DELETE /debug/session - Stop current session
     */
    router.delete('/session', maybeAuth, async (req, res) => {
        try {
            const session = sessionManager.getCurrentSession();

            if (!session) {
                return res.status(404).json({
                    error: 'No active session',
                    message: 'No debug session is currently running'
                });
            }

            const result = await sessionManager.stopSession(session.sessionId);

            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to stop session',
                message: error.message
            });
        }
    });

    // Expose session manager for internal use
    router.sessionManager = sessionManager;

    return router;
}

module.exports = { createDebuggerSessionApi, DebuggerSessionManager };
