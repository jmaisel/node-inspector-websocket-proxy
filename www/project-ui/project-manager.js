/**
 * BadgerBox Project Manager
 *
 * Handles project lifecycle operations:
 * - Creating new projects
 * - Saving project state (circuit + editor)
 * - Loading projects and restoring state
 * - Exporting/importing project archives
 *
 * Integrates with:
 * - CircuitJS simulator (circuit state)
 * - ACE editor (file state, cursors, breakpoints)
 * - Debugger API (backend communication)
 */

class ProjectManager {
    constructor(context) {
        this.ctx = context;
        this.logger = new Logger('ProjectManager');
        this.currentProject = null;
        this.apiBaseUrl = 'http://localhost:8080/api/project';
        this.workspaceApiBaseUrl = 'http://localhost:8080/workspace';
    }

    /**
     * Initialize project manager
     */
    async initialize() {
        this.logger.info('Initializing project manager');

        // Subscribe to relevant events
        this.ctx.sub(/^editor:/, (event, data) => {
            this._handleEditorEvent(event, data);
        });

        this.ctx.sub(/^circuit:/, (event, data) => {
            this._handleCircuitEvent(event, data);
        });

        // Load current project info from server
        try {
            const response = await this._apiRequest('/current', 'GET');
            if (response.project) {
                this.currentProject = response.project;
                this.logger.info('Current project:', this.currentProject);
                this.ctx.pub('project:loaded', this.currentProject);
            }
        } catch (err) {
            this.logger.warn('No current project:', err.message);
        }
    }

    /**
     * Create new project
     */
    async createProject(name, hardware = 'none', entry = 'src/main.js') {
        try {
            this.logger.info(`Creating new project: ${name}`);

            const response = await this._apiRequest('/new', 'POST', {
                name,
                hardware,
                entry
            });

            this.currentProject = {
                name,
                path: response.projectPath,
                hardware,
                entry
            };

            this.ctx.pub('project:created', this.currentProject);
            this.logger.info('Project created successfully:', response);

            // Auto-load the new project
            await this.loadProject(response.projectPath);

            return response;
        } catch (err) {
            this.logger.error('Failed to create project:', err);
            throw err;
        }
    }

    /**
     * Save current project
     */
    async saveProject() {
        console.log('[ProjectManager] saveProject() called');
        console.log('[ProjectManager] currentProject:', this.currentProject);

        if (!this.currentProject) {
            const errorMsg = 'No project is currently open';
            console.error('[ProjectManager]', errorMsg);
            alert(errorMsg);
            throw new Error(errorMsg);
        }

        try {
            this.logger.info('Saving project:', this.currentProject.path);
            console.log('[ProjectManager] Starting save for:', this.currentProject.path);

            // Collect circuit data
            console.log('[ProjectManager] Collecting circuit data...');
            console.log('[ProjectManager] ctx.simulator:', this.ctx.simulator);
            const circuitData = await this._exportCircuitData();
            console.log('[ProjectManager] Circuit data collected:', circuitData ? `${circuitData.length} chars` : 'NONE');
            this.logger.info('Circuit data collected:', circuitData ? `${circuitData.length} chars` : 'NONE');

            // Collect editor state
            console.log('[ProjectManager] Collecting editor state...');
            const editorState = await this._exportEditorState();
            console.log('[ProjectManager] Editor state collected:', editorState);
            this.logger.info('Editor state collected:', editorState);

            // Send to backend
            console.log('[ProjectManager] Sending to backend...');
            this.logger.info('Sending to backend...');
            const response = await this._apiRequest('/save', 'POST', {
                projectPath: this.currentProject.path,
                circuitData,
                editorState
            });

            console.log('[ProjectManager] Save response:', response);

            this.ctx.pub('project:saved', {
                project: this.currentProject,
                timestamp: response.timestamp
            });

            this.logger.info('Project saved successfully:', response);
            console.log('[ProjectManager] Project saved successfully');
            return response;
        } catch (err) {
            console.error('[ProjectManager] Failed to save project:', err);
            console.error('[ProjectManager] Error stack:', err.stack);
            this.logger.error('Failed to save project:', err);
            alert('Failed to save project: ' + err.message);
            throw err;
        }
    }

    /**
     * Load project
     */
    async loadProject(projectPath, runNpmInstall = true) {
        try {
            this.logger.info('Loading project:', projectPath);

            const response = await this._apiRequest('/load', 'POST', {
                projectPath,
                runNpmInstall
            });

            // Store current project info
            this.currentProject = {
                name: response.packageJson.name,
                path: projectPath,
                hardware: response.packageJson.badgerbox?.hardware || 'none',
                entry: response.packageJson.badgerbox?.entry
            };

            // Import circuit data into simulator
            if (response.circuitData) {
                await this._importCircuitData(response.circuitData);
            }

            // Restore editor state
            if (response.editorState) {
                await this._importEditorState(response.editorState);
            }

            // Restore mode
            if (response.editorState?.mode) {
                this.ctx.pub('mode:change', { mode: response.editorState.mode });
            }

            this.ctx.pub('project:loaded', {
                project: this.currentProject,
                npmInstall: response.npmInstall
            });

            this.logger.info('Project loaded successfully');
            return response;
        } catch (err) {
            this.logger.error('Failed to load project:', err);
            throw err;
        }
    }

    /**
     * Export project as archive (download to browser)
     */
    async exportProject(projectPath = null) {
        const path = projectPath || this.currentProject?.path;

        if (!path) {
            throw new Error('No project to export');
        }

        try {
            this.logger.info('Exporting project:', path);

            // Make request to export endpoint
            const response = await fetch(`${this.apiBaseUrl}/export`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ projectPath: path })
            });

            if (!response.ok) {
                throw new Error(`Export failed: ${response.statusText}`);
            }

            // Get the blob
            const blob = await response.blob();

            // Trigger download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.currentProject.name || 'project'}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.ctx.pub('project:exported', { project: this.currentProject });
            this.logger.info('Project exported successfully');
        } catch (err) {
            this.logger.error('Failed to export project:', err);
            throw err;
        }
    }

    /**
     * Import project from archive
     */
    async importProject(file, targetName = null, runNpmInstall = true) {
        try {
            this.logger.info('Importing project from file:', file.name);

            // Send file to backend
            const response = await fetch(
                `${this.apiBaseUrl}/import?targetName=${encodeURIComponent(targetName || '')}&runNpmInstall=${runNpmInstall}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/zip'
                    },
                    body: file
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Import failed');
            }

            const result = await response.json();

            this.ctx.pub('project:imported', result);
            this.logger.info('Project imported successfully:', result);

            // Auto-load the imported project
            await this.loadProject(result.projectPath);

            return result;
        } catch (err) {
            this.logger.error('Failed to import project:', err);
            throw err;
        }
    }

    /**
     * List all projects
     */
    async listProjects() {
        try {
            const response = await this._apiRequest('/list', 'GET');
            return response.projects || [];
        } catch (err) {
            this.logger.error('Failed to list projects:', err);
            throw err;
        }
    }

    /**
     * Get current project info
     */
    getCurrentProject() {
        return this.currentProject;
    }

    // ===== Private Methods =====

    /**
     * Make API request to project backend
     */
    async _apiRequest(endpoint, method = 'GET', body = null) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || `Request failed: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Export circuit data from simulator
     */
    async _exportCircuitData() {
        console.log('[ProjectManager] _exportCircuitData() called');
        console.log('[ProjectManager] this.ctx:', this.ctx);
        console.log('[ProjectManager] this.ctx.simulator:', this.ctx.simulator);

        if (!this.ctx.simulator) {
            console.warn('[ProjectManager] Simulator not available');
            this.logger.warn('Simulator not available');
            return '';
        }

        try {
            console.log('[ProjectManager] Checking for exportCircuit method...');
            console.log('[ProjectManager] typeof this.ctx.simulator.exportCircuit:', typeof this.ctx.simulator.exportCircuit);

            // CircuitJS1 exports exportCircuit() method
            if (this.ctx.simulator.exportCircuit) {
                console.log('[ProjectManager] Calling exportCircuit()...');
                const circuitText = this.ctx.simulator.exportCircuit();
                console.log('[ProjectManager] exportCircuit() returned:', circuitText ? `${circuitText.length} chars` : 'null/undefined');
                this.logger.info('Exported circuit data:', circuitText.length, 'chars');
                return circuitText;
            }

            console.warn('[ProjectManager] exportCircuit method not available on simulator');
            this.logger.warn('exportCircuit method not available on simulator');
            return '';
        } catch (err) {
            console.error('[ProjectManager] Failed to export circuit data:', err);
            console.error('[ProjectManager] Error stack:', err.stack);
            this.logger.error('Failed to export circuit data:', err);
            return '';
        }
    }

    /**
     * Import circuit data to simulator
     */
    async _importCircuitData(circuitData) {
        if (!this.ctx.simulator) {
            this.logger.warn('Simulator not available');
            return;
        }

        if (!circuitData || typeof circuitData !== 'string') {
            this.logger.warn('No valid circuit data to import');
            return;
        }

        const trimmed = circuitData.trim();
        if (trimmed.length === 0) {
            this.logger.warn('Circuit data is empty');
            return;
        }

        try {
            // CircuitJS1 importCircuit calls readCircuit, which triggers oncircuitread callback
            if (typeof this.ctx.simulator.importCircuit === 'function') {
                this.logger.info('Importing circuit data:', trimmed.length, 'chars');
                this.ctx.simulator.importCircuit(trimmed, false);
                this.logger.info('Circuit imported successfully');
            } else {
                this.logger.warn('importCircuit method not available on simulator');
            }
        } catch (err) {
            // If simulator isn't ready yet, that's okay - circuit will load from file
            this.logger.warn('Could not import circuit data (simulator may not be ready):', err.message);
        }
    }

    /**
     * Export editor state (open files, cursors, breakpoints)
     */
    async _exportEditorState() {
        const state = {
            openFiles: [],
            activeFile: null,
            sessions: {},
            breakpoints: {},
            mode: this.ctx.store?.get('mode') || 'design'
        };

        // Get editor state from ACE controller if available
        if (this.ctx.aceController) {
            const ace = this.ctx.aceController;

            // Open files
            if (ace.openSessions) {
                state.openFiles = Array.from(ace.openSessions.keys());
            }

            // Active file
            state.activeFile = ace.activeFile || null;

            // Session details (cursor position, scroll)
            if (ace.openSessions) {
                for (const [filename, session] of ace.openSessions.entries()) {
                    if (session.aceSession) {
                        const selection = session.aceSession.getSelection();
                        const cursor = selection.getCursor();
                        const scrollTop = session.aceSession.getScrollTop?.() || 0;
                        const scrollLeft = session.aceSession.getScrollLeft?.() || 0;

                        state.sessions[filename] = {
                            cursorPosition: {
                                row: cursor.row,
                                column: cursor.column
                            },
                            scrollTop,
                            scrollLeft
                        };
                    }
                }
            }

            // Breakpoints
            if (ace.debuggerClient) {
                const breakpoints = ace.debuggerClient.getBreakpoints?.();
                if (breakpoints) {
                    state.breakpoints = breakpoints;
                }
            }
        }

        return state;
    }

    /**
     * Import editor state (restore open files, cursors, breakpoints)
     */
    async _importEditorState(editorState) {
        if (!this.ctx.aceController) {
            this.logger.warn('ACE controller not available');
            return;
        }

        const ace = this.ctx.aceController;

        try {
            // Close all currently open files
            if (ace.openSessions) {
                const openFiles = Array.from(ace.openSessions.keys());
                for (const filename of openFiles) {
                    await ace.closeFile?.(filename);
                }
            }

            // Open files from state
            if (editorState.openFiles && editorState.openFiles.length > 0) {
                for (const filename of editorState.openFiles) {
                    try {
                        // Get file content from workspace
                        const content = await this._getFileContent(filename);
                        await ace.openFile?.(filename, content);

                        // Restore session state (cursor, scroll)
                        if (editorState.sessions && editorState.sessions[filename]) {
                            const sessionState = editorState.sessions[filename];
                            const session = ace.openSessions?.get(filename);

                            if (session && session.aceSession) {
                                // Restore cursor position
                                if (sessionState.cursorPosition) {
                                    session.aceSession.getSelection().moveCursorTo(
                                        sessionState.cursorPosition.row,
                                        sessionState.cursorPosition.column
                                    );
                                }

                                // Restore scroll position
                                if (sessionState.scrollTop !== undefined) {
                                    session.aceSession.setScrollTop?.(sessionState.scrollTop);
                                }
                                if (sessionState.scrollLeft !== undefined) {
                                    session.aceSession.setScrollLeft?.(sessionState.scrollLeft);
                                }
                            }
                        }
                    } catch (err) {
                        this.logger.error(`Failed to open file ${filename}:`, err);
                    }
                }

                // Switch to active file
                if (editorState.activeFile) {
                    await ace.switchToFile?.(editorState.activeFile);
                }
            }

            // Restore breakpoints
            if (editorState.breakpoints && ace.debuggerClient) {
                ace.debuggerClient.setBreakpoints?.(editorState.breakpoints);
            }

            this.logger.info('Editor state restored');
        } catch (err) {
            this.logger.error('Failed to import editor state:', err);
        }
    }

    /**
     * Get file content from workspace
     */
    async _getFileContent(filename) {
        // Ensure filename starts with current project path
        let fullPath = filename;
        if (this.currentProject && !filename.startsWith(this.currentProject.path)) {
            fullPath = `${this.currentProject.path}/${filename}`;
        }

        // Ensure fullPath starts with /
        if (!fullPath.startsWith('/')) {
            fullPath = '/' + fullPath;
        }

        const response = await fetch(`${this.workspaceApiBaseUrl}${fullPath}`);
        if (!response.ok) {
            throw new Error(`Failed to load file: ${filename}`);
        }

        return await response.text();
    }

    /**
     * Handle editor events
     */
    _handleEditorEvent(event, data) {
        // Track changes for auto-save, etc.
        this.logger.debug('Editor event:', event, data);
    }

    /**
     * Handle circuit events
     */
    _handleCircuitEvent(event, data) {
        // Track changes for auto-save, etc.
        this.logger.debug('Circuit event:', event, data);
    }
}

// Make ProjectManager available globally for browser use
window.ProjectManager = ProjectManager;