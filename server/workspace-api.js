const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const WorkspaceSecurity = require('./workspace-security');
const AuthMiddleware = require('./auth-middleware');
const ZipHandler = require('./zip-handler');

/**
 * Creates and configures the workspace API router
 * @param {Object} config - Configuration object
 * @param {string} config.workspaceRoot - Absolute path to workspace root
 * @param {string[]} config.apiKeys - Array of valid API keys for authentication
 * @returns {express.Router} Configured Express router
 */
function createWorkspaceApi(config = {}) {
    const router = express.Router();

    // Initialize security and auth
    const security = new WorkspaceSecurity(config.workspaceRoot || process.cwd());
    const auth = new AuthMiddleware({
        apiKeys: config.apiKeys || [],
        apiKeyHeader: 'X-Workspace-API-Key'
    });

    fsSync.mkdirSync(config.workspaceRoot, { recursive: true });

    /**
     * Workspace info endpoint for handshake
     * GET /workspace/info - Returns workspace metadata
     */
    router.get('/info', async (req, res) => {
        try {
            const workspaceRoot = security.getWorkspaceRoot();
            const stats = await fs.stat(workspaceRoot);

            res.json({
                workspaceRoot,
                exists: true,
                type: stats.isDirectory() ? 'directory' : 'file',
                modified: stats.mtime.toISOString(),
                apiVersion: '1.0',
                features: {
                    upload: true,
                    download: true,
                    zip: true
                }
            });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to get workspace info',
                message: error.message
            });
        }
    });

    /**
     * GET handler - List directory or download file/directory
     */
    router.get('/*', async (req, res) => {
        try {
            const requestedPath = req.params[0] || '/';
            const absolutePath = await security.validatePath(requestedPath);

            // Check if path exists
            let stats;
            try {
                stats = await fs.stat(absolutePath);
            } catch (err) {
                if (err.code === 'ENOENT') {
                    return res.status(404).json({
                        error: 'Not found',
                        message: 'File or directory does not exist',
                        path: requestedPath
                    });
                }
                throw err;
            }

            // Handle directory
            if (stats.isDirectory()) {
                // Check if client wants ZIP
                if (ZipHandler.acceptsZip(req) && req.headers['accept']?.includes('application/zip')) {
                    // Return directory as ZIP
                    await ZipHandler.createZipFromDirectory(
                        absolutePath,
                        res,
                        path.basename(absolutePath || 'workspace') + '.zip'
                    );
                } else {
                    // Return JSON listing
                    const files = await fs.readdir(absolutePath);
                    const contents = await Promise.all(
                        files.map(async (name) => {
                            const filePath = path.join(absolutePath, name);
                            const fileStats = await fs.stat(filePath);
                            return {
                                name,
                                type: fileStats.isDirectory() ? 'directory' : 'file',
                                size: fileStats.size,
                                modified: fileStats.mtime.toISOString()
                            };
                        })
                    );

                    res.json({
                        path: requestedPath,
                        type: 'directory',
                        contents
                    });
                }
            }
            // Handle file
            else {
                // Check if client wants ZIP
                if (req.headers['accept']?.includes('application/zip')) {
                    // Return file as ZIP
                    await ZipHandler.createZipFromFile(
                        absolutePath,
                        res,
                        path.basename(absolutePath) + '.zip'
                    );
                } else {
                    // Return file contents directly
                    const content = await fs.readFile(absolutePath);

                    // Try to detect content type
                    const ext = path.extname(absolutePath).toLowerCase();
                    const contentTypes = {
                        '.js': 'application/javascript',
                        '.json': 'application/json',
                        '.html': 'text/html',
                        '.css': 'text/css',
                        '.txt': 'text/plain',
                        '.md': 'text/markdown',
                        '.xml': 'application/xml',
                        '.pdf': 'application/pdf',
                        '.png': 'image/png',
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                        '.gif': 'image/gif',
                        '.svg': 'image/svg+xml'
                    };

                    const contentType = contentTypes[ext] || 'application/octet-stream';
                    res.setHeader('Content-Type', contentType);
                    res.send(content);
                }
            }
        } catch (err) {
            console.error('GET error:', err);
            if (err.message.includes('Path traversal')) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: err.message
                });
            }
            res.status(500).json({
                error: 'Internal server error',
                message: err.message
            });
        }
    });

    /**
     * PUT/POST/PATCH handlers - Upload and extract ZIP
     */
    const uploadHandler = async (req, res) => {
        try {
            const requestedPath = req.params[0] || '/';
            const absolutePath = await security.validatePath(requestedPath);

            // Verify content type
            if (!ZipHandler.isZipRequest(req)) {
                return res.status(415).json({
                    error: 'Unsupported media type',
                    message: 'Expected Content-Type: application/zip'
                });
            }

            // Extract ZIP to target path
            const result = await ZipHandler.extractZipToDirectory(req, absolutePath);

            res.status(201).json({
                success: true,
                message: 'ZIP extracted successfully',
                ...result
            });
        } catch (err) {
            console.error('Upload error:', err);
            if (err.message.includes('Path traversal')) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: err.message
                });
            }
            res.status(500).json({
                error: 'Internal server error',
                message: err.message
            });
        }
    };

    // Apply authentication to write operations
    // Using noAuth for now - authentication middleware in place but not enforcing
    router.put('/*', auth.noAuth, uploadHandler);
    router.post('/*', auth.noAuth, uploadHandler);
    router.patch('/*', auth.noAuth, uploadHandler);

    return router;
}

module.exports = createWorkspaceApi;
