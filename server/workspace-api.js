const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const WorkspaceSecurity = require('./workspace-security');
const AuthMiddleware = require('./auth-middleware');
const ZipHandler = require('./zip-handler');

/**
 * Recursively copy directory contents
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 */
async function copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

/**
 * Creates and configures the workspace API router
 * @param {Object} config - Configuration object
 * @param {string} config.workspaceRoot - Absolute path to workspace root
 * @param {string} config.demoProjectPath - Relative path to demo project template
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
     * POST /active-project - Set the active project
     * Body: { project: "project-name" }
     */
    router.post('/active-project', async (req, res) => {
        try {
            const project = req.body.projectPath;

            if (!project) {
                return res.status(400).json({
                    error: 'Bad request',
                    message: 'Missing required field: project'
                });
            }

            // Validate that the project path exists within workspace
            const projectPath = await security.validatePath(project);

            // Check if it exists
            try {
                const stats = await fs.stat(projectPath);
                if (!stats.isDirectory()) {
                    return res.status(400).json({
                        error: 'Bad request',
                        message: 'Project must be a directory'
                    });
                }
            } catch (err) {
                if (err.code === 'ENOENT') {
                    return res.status(404).json({
                        error: 'Not found',
                        message: 'Project directory does not exist',
                        project
                    });
                }
                throw err;
            }

            // Store active project in router state
            router.activeProject = project;

            res.json({
                success: true,
                project,
                projectPath,
                message: 'Active project set successfully'
            });
        } catch (err) {
            console.error('Set active project error:', err);
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
     * GET /active-project - Get the current active project
     */
    router.get('/active-project', (req, res) => {
        if (!router.activeProject) {
            return res.status(404).json({
                error: 'No active project',
                message: 'No project has been selected'
            });
        }

        res.json({
            project: router.activeProject
        });
    });

    /**
     * POST /demo-project - Copy demo project template to workspace
     * Creates a new project from the configured demo template
     */
    router.post('/demo-project', async (req, res) => {
        try {
            if (!config.demoProjectPath) {
                return res.status(500).json({
                    error: 'Configuration error',
                    message: 'Demo project path not configured'
                });
            }

            // Resolve demo project path relative to project root
            const projectRoot = path.resolve(__dirname, '..');
            const demoPath = path.join(projectRoot, config.demoProjectPath);

            // Verify demo project exists
            try {
                const stats = await fs.stat(demoPath);
                if (!stats.isDirectory()) {
                    return res.status(500).json({
                        error: 'Configuration error',
                        message: 'Demo project path is not a directory'
                    });
                }
            } catch (err) {
                if (err.code === 'ENOENT') {
                    return res.status(500).json({
                        error: 'Configuration error',
                        message: `Demo project not found at ${config.demoProjectPath}`
                    });
                }
                throw err;
            }

            // Get target path from request body or use default
            const targetPath = req.body?.targetPath || 'demo-project';
            const workspacePath = await security.validatePath(targetPath);

            // Check if target already exists
            try {
                await fs.access(workspacePath);
                return res.status(409).json({
                    error: 'Conflict',
                    message: `Target path already exists: ${targetPath}`,
                    suggestion: 'Use a different target path or delete the existing directory'
                });
            } catch (err) {
                // Target doesn't exist, which is what we want
            }

            // Copy demo project to workspace
            await copyDirectory(demoPath, workspacePath);

            // Count copied files
            const countFiles = async (dir) => {
                let count = 0;
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        count += await countFiles(path.join(dir, entry.name));
                    } else {
                        count++;
                    }
                }
                return count;
            };

            const fileCount = await countFiles(workspacePath);

            res.status(201).json({
                success: true,
                message: 'Demo project created successfully',
                projectPath: targetPath,
                demoSource: config.demoProjectPath,
                filesCreated: fileCount
            });
        } catch (err) {
            console.error('Demo project creation error:', err);
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
