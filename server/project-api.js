/**
 * BadgerBox Project Management API
 *
 * Provides endpoints for:
 * - Creating new projects with package.json structure
 * - Saving project state (circuit + editor)
 * - Loading projects and restoring state
 * - Exporting/importing projects as archives
 * - Listing available projects
 *
 * Project structure:
 * /project-name/
 *   package.json          # Node-standard + badgerbox config
 *   circuit.circuitjs     # Main circuit file
 *   bin/                  # Scripts, executables
 *   src/                  # All user code
 *   .badgerbox/          # Internal config, meta, cached state
 *     state.json         # Editor state (cursors, breakpoints, open files)
 */

const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const archiver = require('archiver');
const unzipper = require('unzipper');
const WorkspaceSecurity = require('./workspace-security');

const execAsync = promisify(exec);

class ProjectManager {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.currentProject = null;
        this.security = new WorkspaceSecurity(workspaceRoot);
    }

    /**
     * Validate project name (alphanumeric, dash, underscore only)
     */
    validateProjectName(name) {
        return /^[a-zA-Z0-9_-]+$/.test(name);
    }

    /**
     * Check if path should be excluded from archives
     */
    shouldExcludeFromArchive(filePath) {
        const excludePatterns = [
            'node_modules',
            '.git',
            '__pycache__',
            '.DS_Store',
            'Thumbs.db',
            '*.pyc'
        ];

        return excludePatterns.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace('*', '.*'));
                return regex.test(filePath);
            }
            return filePath.includes(pattern);
        });
    }

    /**
     * Create new project with standard structure
     */
    async createProject(name, hardware = 'none', entry = 'src/main.js') {
        if (!this.validateProjectName(name)) {
            throw new Error('Invalid project name. Use only alphanumeric, dash, underscore.');
        }

        const projectPath = await this.security.validatePath(name);

        // Check if project already exists
        try {
            await fs.access(projectPath);
            throw new Error(`Project '${name}' already exists`);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }

        // Create directory structure
        await fs.mkdir(projectPath, { recursive: true });
        await fs.mkdir(path.join(projectPath, 'bin'));
        await fs.mkdir(path.join(projectPath, 'src'));
        await fs.mkdir(path.join(projectPath, '.badgerbox'));

        // Create package.json
        const packageJson = {
            name,
            version: '1.0.0',
            badgerbox: {
                circuit: 'circuit.circuitjs',
                hardware,
                entry
            }
        };

        await fs.writeFile(
            path.join(projectPath, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );

        // Create empty circuit file
        const emptyCircuit = '$ 1 0.000005 10.20027730826997 50 5 50 5e-11\n';
        await fs.writeFile(
            path.join(projectPath, 'circuit.circuitjs'),
            emptyCircuit
        );

        // Create entry file
        const entryPath = path.join(projectPath, entry);
        await fs.mkdir(path.dirname(entryPath), { recursive: true });

        let entryContent = '';
        if (entry.endsWith('.py')) {
            entryContent = '# BadgerBox Project\nprint("Hello from BadgerBox!")\n';
        } else if (entry.endsWith('.js')) {
            entryContent = '// BadgerBox Project\nconsole.log("Hello from BadgerBox!");\n';
        } else {
            entryContent = '# Entry point\n';
        }

        await fs.writeFile(entryPath, entryContent);

        // Create initial state file
        const state = {
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            editorState: {
                openFiles: [entry],
                activeFile: entry,
                sessions: {},
                breakpoints: {}
            },
            mode: 'design'
        };

        await fs.writeFile(
            path.join(projectPath, '.badgerbox', 'state.json'),
            JSON.stringify(state, null, 2)
        );

        this.currentProject = projectPath;

        return {
            success: true,
            projectPath: name,
            name,
            structure: {
                'package.json': true,
                'circuit.circuitjs': true,
                'bin/': true,
                'src/': true,
                '.badgerbox/': true
            }
        };
    }

    /**
     * Save project state
     */
    async saveProject(projectPath, circuitData, editorState) {
        const absolutePath = await this.security.validatePath(projectPath);

        // Check if project exists
        try {
            await fs.access(absolutePath);
        } catch (err) {
            throw new Error(`Project not found: ${projectPath}`);
        }

        // Load package.json to get circuit filename
        const packageJsonPath = path.join(absolutePath, 'package.json');
        let circuitFilename = 'circuit.circuitjs';

        try {
            const packageData = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            circuitFilename = packageData.badgerbox?.circuit || 'circuit.circuitjs';
        } catch (err) {
            // Use default if package.json doesn't exist or is invalid
        }

        // Save circuit file
        await fs.writeFile(
            path.join(absolutePath, circuitFilename),
            circuitData || ''
        );

        // Update state file
        const badgerboxDir = path.join(absolutePath, '.badgerbox');
        await fs.mkdir(badgerboxDir, { recursive: true });

        const stateFile = path.join(badgerboxDir, 'state.json');
        const state = {
            modified: new Date().toISOString(),
            editorState,
            mode: editorState.mode || 'design'
        };

        // Preserve created timestamp if exists
        try {
            const oldState = JSON.parse(await fs.readFile(stateFile, 'utf8'));
            state.created = oldState.created || new Date().toISOString();
        } catch (err) {
            state.created = new Date().toISOString();
        }

        await fs.writeFile(stateFile, JSON.stringify(state, null, 2));

        this.currentProject = absolutePath;

        return {
            success: true,
            projectPath,
            saved: {
                circuit: circuitFilename,
                state: '.badgerbox/state.json'
            },
            timestamp: state.modified
        };
    }

    /**
     * Load project and restore state
     */
    async loadProject(projectPath, runNpmInstall = true) {
        const absolutePath = await this.security.validatePath(projectPath);

        // Validate project structure
        const packageJsonPath = path.join(absolutePath, 'package.json');
        try {
            await fs.access(packageJsonPath);
        } catch (err) {
            throw new Error('Invalid project: package.json not found');
        }

        // Load package.json
        const packageData = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        const badgerboxConfig = packageData.badgerbox || {};
        const circuitFilename = badgerboxConfig.circuit || 'circuit.circuitjs';

        // Load circuit file
        let circuitData = '';
        const circuitPath = path.join(absolutePath, circuitFilename);
        try {
            circuitData = await fs.readFile(circuitPath, 'utf8');
        } catch (err) {
            // Circuit file may not exist yet
        }

        // Load state file
        let editorState = {
            openFiles: [],
            activeFile: null,
            sessions: {},
            breakpoints: {}
        };

        const stateFile = path.join(absolutePath, '.badgerbox', 'state.json');
        try {
            const state = JSON.parse(await fs.readFile(stateFile, 'utf8'));
            editorState = state.editorState || editorState;
        } catch (err) {
            // State file may not exist
        }

        // Run npm install if requested
        let npmOutput = null;
        if (runNpmInstall) {
            try {
                const { stdout, stderr } = await execAsync('npm install', {
                    cwd: absolutePath,
                    timeout: 300000 // 5 minute timeout
                });
                npmOutput = {
                    success: true,
                    stdout,
                    stderr
                };
            } catch (err) {
                npmOutput = {
                    success: false,
                    error: err.message,
                    stdout: err.stdout,
                    stderr: err.stderr
                };
            }
        }

        this.currentProject = absolutePath;

        return {
            success: true,
            projectPath,
            packageJson: packageData,
            circuitData,
            editorState,
            npmInstall: npmOutput
        };
    }

    /**
     * Export project as zip archive (excluding node_modules)
     */
    async exportProject(projectPath, res) {
        const absolutePath = await this.security.validatePath(projectPath);

        // Check if project exists
        try {
            await fs.access(absolutePath);
        } catch (err) {
            throw new Error(`Project not found: ${projectPath}`);
        }

        const projectName = path.basename(absolutePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        // Set response headers
        res.attachment(`${projectName}.zip`);
        res.setHeader('Content-Type', 'application/zip');

        // Pipe archive to response
        archive.pipe(res);

        // Add files to archive (excluding node_modules, etc.)
        const addDirectoryToArchive = async (dirPath, archivePath = '') => {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const relPath = path.join(archivePath, entry.name);

                // Skip excluded paths
                if (this.shouldExcludeFromArchive(relPath)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    await addDirectoryToArchive(fullPath, relPath);
                } else {
                    archive.file(fullPath, { name: path.join(projectName, relPath) });
                }
            }
        };

        await addDirectoryToArchive(absolutePath);

        // Finalize archive
        await archive.finalize();

        return new Promise((resolve, reject) => {
            archive.on('end', resolve);
            archive.on('error', reject);
        });
    }

    /**
     * Import project from zip archive
     */
    async importProject(zipStream, targetName = null, runNpmInstall = true) {
        const tempExtractPath = path.join(this.workspaceRoot, '.tmp-extract-' + Date.now());

        try {
            // Extract zip to temporary directory
            await fs.mkdir(tempExtractPath, { recursive: true });

            await new Promise((resolve, reject) => {
                zipStream
                    .pipe(unzipper.Extract({ path: tempExtractPath }))
                    .on('close', resolve)
                    .on('error', reject);
            });

            // Find the project root (contains package.json)
            const findProjectRoot = async (dir) => {
                const entries = await fs.readdir(dir, { withFileTypes: true });

                // Check if package.json exists in this directory
                if (entries.some(e => e.name === 'package.json')) {
                    return dir;
                }

                // Check subdirectories
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const found = await findProjectRoot(path.join(dir, entry.name));
                        if (found) return found;
                    }
                }

                return null;
            };

            const projectRoot = await findProjectRoot(tempExtractPath);
            if (!projectRoot) {
                throw new Error('Invalid project archive: no package.json found');
            }

            // Load package.json to get project name
            const packageData = JSON.parse(
                await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8')
            );

            let projectName = targetName || packageData.name || 'imported-project';

            // Ensure valid project name
            if (!this.validateProjectName(projectName)) {
                projectName = 'imported-project';
            }

            // Determine final destination
            let finalPath = await this.security.validatePath(projectName);
            let counter = 1;

            while (true) {
                try {
                    await fs.access(finalPath);
                    // Exists, try next name
                    finalPath = await this.security.validatePath(`${projectName}-${counter}`);
                    counter++;
                } catch (err) {
                    // Doesn't exist, use this path
                    break;
                }
            }

            // Move project to final location
            await fs.rename(projectRoot, finalPath);

            // Run npm install if requested
            let npmOutput = null;
            if (runNpmInstall) {
                try {
                    const { stdout, stderr } = await execAsync('npm install', {
                        cwd: finalPath,
                        timeout: 300000
                    });
                    npmOutput = {
                        success: true,
                        stdout,
                        stderr
                    };
                } catch (err) {
                    npmOutput = {
                        success: false,
                        error: err.message,
                        stdout: err.stdout,
                        stderr: err.stderr
                    };
                }
            }

            this.currentProject = finalPath;

            return {
                success: true,
                projectPath: path.basename(finalPath),
                projectName: path.basename(finalPath),
                npmInstall: npmOutput
            };
        } finally {
            // Clean up temporary directory
            try {
                await fs.rm(tempExtractPath, { recursive: true, force: true });
            } catch (err) {
                // Ignore cleanup errors
            }
        }
    }

    /**
     * List all projects in workspace
     */
    async listProjects() {
        const projects = [];
        const entries = await fs.readdir(this.workspaceRoot, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (entry.name.startsWith('.tmp-')) continue;

            const projectPath = path.join(this.workspaceRoot, entry.name);
            const packageJsonPath = path.join(projectPath, 'package.json');

            try {
                const packageData = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

                // Get state info if available
                let modified = null;
                const stateFile = path.join(projectPath, '.badgerbox', 'state.json');
                try {
                    const state = JSON.parse(await fs.readFile(stateFile, 'utf8'));
                    modified = state.modified;
                } catch (err) {
                    // Use directory mtime if state doesn't exist
                    const stats = await fs.stat(projectPath);
                    modified = stats.mtime.toISOString();
                }

                projects.push({
                    name: packageData.name || entry.name,
                    path: entry.name,
                    hardware: packageData.badgerbox?.hardware || 'none',
                    modified
                });
            } catch (err) {
                // Skip invalid projects
                continue;
            }
        }

        // Sort by modified time (most recent first)
        projects.sort((a, b) => {
            const aTime = new Date(a.modified || 0);
            const bTime = new Date(b.modified || 0);
            return bTime - aTime;
        });

        return projects;
    }

    /**
     * Get current project info
     */
    async getCurrentProject() {
        if (!this.currentProject) {
            return null;
        }

        try {
            const packageJsonPath = path.join(this.currentProject, 'package.json');
            const packageData = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

            return {
                path: path.basename(this.currentProject),
                name: packageData.name,
                hardware: packageData.badgerbox?.hardware || 'none',
                entry: packageData.badgerbox?.entry
            };
        } catch (err) {
            return null;
        }
    }
}

/**
 * Create and configure project API router
 */
function createProjectApi(config = {}) {
    const router = express.Router();
    const manager = new ProjectManager(config.workspaceRoot || process.cwd());

    /**
     * POST /api/project/new - Create new project
     */
    router.post('/new', async (req, res) => {
        try {
            const { name, hardware = 'none', entry = 'src/main.js' } = req.body;

            if (!name) {
                return res.status(400).json({
                    error: 'Project name is required'
                });
            }

            const result = await manager.createProject(name, hardware, entry);
            res.status(201).json(result);
        } catch (err) {
            console.error('Create project error:', err);
            res.status(err.message.includes('already exists') ? 409 : 500).json({
                error: err.message
            });
        }
    });

    /**
     * POST /api/project/save - Save project state
     */
    router.post('/save', async (req, res) => {
        try {
            const { projectPath, circuitData = '', editorState = {} } = req.body;

            if (!projectPath) {
                return res.status(400).json({
                    error: 'Project path is required'
                });
            }

            const result = await manager.saveProject(projectPath, circuitData, editorState);
            res.json(result);
        } catch (err) {
            console.error('Save project error:', err);
            res.status(err.message.includes('not found') ? 404 : 500).json({
                error: err.message
            });
        }
    });

    /**
     * POST /api/project/load - Load project and restore state
     */
    router.post('/load', async (req, res) => {
        try {
            const { projectPath, runNpmInstall = true } = req.body;

            if (!projectPath) {
                return res.status(400).json({
                    error: 'Project path is required'
                });
            }

            const result = await manager.loadProject(projectPath, runNpmInstall);
            res.json(result);
        } catch (err) {
            console.error('Load project error:', err);
            res.status(err.message.includes('not found') ? 404 : 500).json({
                error: err.message
            });
        }
    });

    /**
     * POST /api/project/export - Export project as zip
     */
    router.post('/export', async (req, res) => {
        try {
            const { projectPath } = req.body;

            if (!projectPath) {
                return res.status(400).json({
                    error: 'Project path is required'
                });
            }

            await manager.exportProject(projectPath, res);
        } catch (err) {
            console.error('Export project error:', err);
            if (!res.headersSent) {
                res.status(err.message.includes('not found') ? 404 : 500).json({
                    error: err.message
                });
            }
        }
    });

    /**
     * POST /api/project/import - Import project from zip
     */
    router.post('/import', async (req, res) => {
        try {
            const contentType = req.headers['content-type'] || '';

            if (!contentType.includes('application/zip') && !contentType.includes('application/octet-stream')) {
                return res.status(415).json({
                    error: 'Content-Type must be application/zip'
                });
            }

            const targetName = req.query.targetName || null;
            const runNpmInstall = req.query.runNpmInstall !== 'false';

            const result = await manager.importProject(req, targetName, runNpmInstall);
            res.status(201).json(result);
        } catch (err) {
            console.error('Import project error:', err);
            res.status(500).json({
                error: err.message
            });
        }
    });

    /**
     * GET /api/project/list - List all projects
     */
    router.get('/list', async (req, res) => {
        try {
            const projects = await manager.listProjects();
            res.json({
                success: true,
                projects
            });
        } catch (err) {
            console.error('List projects error:', err);
            res.status(500).json({
                error: err.message
            });
        }
    });

    /**
     * GET /api/project/current - Get current project info
     */
    router.get('/current', async (req, res) => {
        try {
            const current = await manager.getCurrentProject();
            res.json({
                success: true,
                project: current
            });
        } catch (err) {
            console.error('Get current project error:', err);
            res.status(500).json({
                error: err.message
            });
        }
    });

    return router;
}

module.exports = { createProjectApi, ProjectManager };