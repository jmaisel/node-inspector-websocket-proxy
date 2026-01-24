class AceController {
    constructor() {
        this.logger = new Logger('AceController');
        this.editor = null;
        this.editorFrame = null;
        this.currentFile = null;  // Keep for backward compatibility
        this.currentDebugLine = null;
        this.debuggerClientLoaded = false;

        // Debugger API client for communicating with node-inspector-websocket-proxy server
        this.debuggerApiClient = new DebuggerApiClient('http://localhost:8080');
        this.selectedProject = null;
        this.selectedEntryPoint = null;
        this.currentProjectPath = null;
        this.selectedFileForDebugging = null;

        // Initialize scripts map
        this.scripts = new Map();

        // MDI (Multiple Document Interface) state
        this.openSessions = new Map();  // filePath -> {session, isDirty, fileName}
        this.activeFile = null;
        this.tabManager = null;  // Will be initialized after editor loads

        // Console UI components
        this.consoleModel = new ConsoleUIModel(1000);
        this.consoleView = null; // Created after DOM ready
        this.consoleController = new ConsoleUIController();

        // Toolbar detachment state
        this.isToolbarDetached = false;
        this.detachedToolbar = null;

        // Initialize domain helpers
        this.projectHelper = new ProjectHelper(this);
        this.debuggerConnectionHelper = new DebuggerConnectionHelper(this);
        this.debuggerEventHelper = new DebuggerEventHelper(this);
        this.editorHelper = new EditorHelper(this);
        this.toolbarHelper = new ToolbarHelper(this);

        // Load debugger client dependencies
        this.loadDebuggerClient().then(() => {
            this.logger.info('Debugger client loaded');
            this.debuggerClientLoaded = true;
            this.bind();
        }).catch((error) => {
            this.logger.error('Failed to load debugger client:', error);
            this.bind(); // Continue anyway, debugger features will be disabled
        });
    }

    /**
     * Dynamically load debugger client scripts
     * @returns {Promise}
     */
    async loadDebuggerClient() {
        this.logger.info('Loading debugger client scripts...');

        // Load from node-inspector-websocket-proxy server
        const baseUrl = 'http://localhost:8080';
        const scripts = [
            `${baseUrl}/client/inspector-constants.js`,
            `${baseUrl}/client/regex-pubsub.js`,
            `${baseUrl}/client/inspector-browser-proxy.js`,
            `${baseUrl}/client/inspector-controllers.js`,
            `${baseUrl}/client/inspector-factory.js`
        ];

        // Load scripts sequentially to maintain dependency order
        for (const src of scripts) {
            this.logger.info(`Loading script: ${src}`);
            await this.loadScript(src);
        }

        this.logger.info('All debugger client scripts loaded successfully');

        // Verify BaseDomainController is available
        if (typeof BaseDomainController === 'undefined') {
            this.logger.error('BaseDomainController not found after loading scripts!');
            throw new Error('Debugger client failed to initialize properly');
        }

        this.logger.info('BaseDomainController is available');
    }

    /**
     * Load a single script dynamically
     * @param {string} src - Script URL
     * @returns {Promise}
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                this.logger.info(`Loaded: ${src}`);
                resolve();
            };
            script.onerror = () => {
                this.logger.error(`Failed to load: ${src}`);
                reject(new Error(`Failed to load script: ${src}`));
            };
            document.head.appendChild(script);
        });
    }

    bind() {
        this.logger.info('bind()');

        // Get reference to the iframe
        this.editorFrame = $('#code')[0];

        // Wait for iframe to load and get editor instance
        if (this.editorFrame && this.editorFrame.contentWindow) {
            this.editor = this.editorFrame.contentWindow.editor;

            if (this.editor) {
                this.logger.info('Ace editor instance acquired');
                this.editorHelper.setupEditor();

                // Initialize tab manager after editor is setup
                this.initTabManager(this.editorHelper);
            } else {
                this.logger.warn('Ace editor not yet available, will retry');
                // Retry after a short delay
                setTimeout(() => this.bind(), 100);
            }
        }

        // Bind Open Project button
        this.bindOpenProjectButton();

        // Bind Connect button
        this.bindConnectButton();

        // Bind debug control buttons
        this.bindDebugControls();

        // Note: Console initialization happens in setCtx() when application context is available
    }

    initializeConsole() {
        this.logger.info('initializeConsole()');

        // Create console view (only once)
        if (!this.consoleView) {
            this.consoleView = new ConsoleUIView('#console-panel', this.consoleModel);
        }

        // Set dependencies for console controller and bind
        if (this.application) {
            this.consoleController.setModel(this.consoleModel);
            this.consoleController.setCtx(this.application);
            this.consoleController.setView(this.consoleView);
            this.consoleController.bind();
            this.logger.info('Console UI initialized and bound');
        } else {
            this.logger.warn('Application context not available, cannot initialize console');
        }
    }

    bindOpenProjectButton() {
        this.logger.info('bindOpenProjectButton()');

        const openProjectBtn = $('#open-project-btn');

        openProjectBtn.on('click', () => {
            this.logger.info('Open Project button clicked');
            this.projectHelper.showProjectDialog();
        });
    }

    bindConnectButton() {
        this.logger.info('bindConnectButton()');

        const debugStartBtn = $('#debug-start-btn');

        debugStartBtn.on('click', () => {
            this.logger.info('Debug button clicked');
            this.debuggerConnectionHelper.connectToDebuggerWithSelectedFile();
        });
    }

    bindDebugControls() {
        this.logger.info('bindDebugControls()');

        // Continue/Resume button
        $('#debug-continue').on('click', () => {
            if (!this.inspectorProxy) {
                alert('Not connected to debugger');
                return;
            }

            // Reset simulator before resuming
            if (this.application && this.application.simulator) {
                this.logger.info('Resetting simulator on Resume button click');
                if (this.application.simulator.menuPerformed) {
                    this.application.simulator.menuPerformed('main', 'reset');
                }
            }

            this.inspectorProxy.debuggerController.resume();
        });

        // Pause button
        $('#debug-pause').on('click', () => {
            if (!this.inspectorProxy) {
                alert('Not connected to debugger');
                return;
            }

            // Stop simulator when pausing
            if (this.application && this.application.simulator) {
                this.logger.info('Stopping simulator on Pause button click');
                this.application.simulator.setSimRunning(false);
            }

            this.inspectorProxy.debuggerController.pause();
        });

        // Step Over button
        $('#debug-step-over').on('click', () => {
            if (!this.inspectorProxy) {
                alert('Not connected to debugger');
                return;
            }
            this.inspectorProxy.debuggerController.stepOver();
        });

        // Step Into button
        $('#debug-step-into').on('click', () => {
            if (!this.inspectorProxy) {
                alert('Not connected to debugger');
                return;
            }
            this.inspectorProxy.debuggerController.stepInto();
        });

        // Step Out button
        $('#debug-step-out').on('click', () => {
            if (!this.inspectorProxy) {
                alert('Not connected to debugger');
                return;
            }
            this.inspectorProxy.debuggerController.stepOut();
        });

        // Stop button
        $('#debug-stop').on('click', async () => {
            if (!this.inspectorProxy) {
                alert('Not connected to debugger');
                return;
            }

            // Stop simulator when stopping debugger
            if (this.application && this.application.simulator) {
                this.logger.info('Stopping simulator on Stop button click');
                this.application.simulator.setSimRunning(false);
            }

            try {
                await this.inspectorProxy.debuggerController.disable();

                if (this.inspectorProxy.ws) {
                    this.inspectorProxy.ws.close();
                }

                this.clearDebugMarkers();
                if (this.scripts) {
                    this.scripts.clear();
                }

                this.inspectorProxy = null;
                this.hideDebugControls();

                alert('Disconnected from debugger');
            } catch (error) {
                this.logger.error('Failed to stop debugger:', error);
                alert(`Failed to stop debugger: ${error.message}`);
            }
        });

        // Toolbar detach button
        $('#toolbar-detach-btn').on('click', () => {
            this.logger.info('Toolbar detach button clicked');
            this.toolbarHelper.detachToolbar();
        });

        this.logger.info('Debug controls bound');
    }

    // Delegation methods to helpers

    setCtx(ctx) {
        this.logger.info('setCtx', ctx);
        this.application = ctx;

        // Initialize console now that we have the application context
        if (!this.consoleController.application) {
            this.initializeConsole();
        }
    }

    // Editor delegation methods
    focus() { return this.editorHelper.focus(); }
    resize() { return this.editorHelper.resize(); }
    getCurrentFile() { return this.editorHelper.getCurrentFile(); }
    getCursorPosition() { return this.editorHelper.getCursorPosition(); }
    gotoLine(line, column) { return this.editorHelper.gotoLine(line, column); }
    getValue() { return this.editorHelper.getValue(); }
    setValue(content) { return this.editorHelper.setValue(content); }
    loadFile(filename, content) { return this.editorHelper.loadFile(filename, content); }
    clearDebugMarkers() { return this.editorHelper.clearDebugMarkers(); }
    hideDebugControls() { return this.debuggerConnectionHelper.hideDebugControls(); }

    // === MDI (Multiple Document Interface) Methods ===

    /**
     * Create or get an existing Ace editor session for a file
     * @param {string} filePath - Full path to the file
     * @param {string} content - File content
     * @param {string} mode - Ace mode (e.g., 'ace/mode/javascript')
     * @returns {object} Session data object
     */
    createOrGetSession(filePath, content, mode) {
        if (this.openSessions.has(filePath)) {
            return this.openSessions.get(filePath);
        }

        // Get Ace constructor from iframe
        const ace = this.editorFrame.contentWindow.ace;

        // Create Ace session - automatically handles undo/redo, cursor, scroll position
        const session = ace.createEditSession(content || '', mode);

        const sessionData = {
            session: session,
            isDirty: false,
            filePath: filePath,
            fileName: this.getFileName(filePath)
        };

        this.openSessions.set(filePath, sessionData);
        this.logger.info(`Created session for ${filePath}`);
        return sessionData;
    }

    /**
     * Switch to an existing session
     * @param {string} filePath - Full path to the file
     * @returns {boolean} True if switched successfully
     */
    switchToSession(filePath) {
        const sessionData = this.openSessions.get(filePath);
        if (!sessionData) {
            this.logger.warn(`No session found for ${filePath}`);
            return false;
        }

        // Switch session - Ace automatically restores all state
        this.editor.setSession(sessionData.session);
        this.activeFile = filePath;
        this.currentFile = filePath;  // Keep in sync for backward compatibility
        this.logger.info(`Switched to session: ${filePath}`);
        return true;
    }

    /**
     * Close a session
     * @param {string} filePath - Full path to the file
     */
    closeSession(filePath) {
        this.openSessions.delete(filePath);
        this.logger.info(`Closed session: ${filePath}`);

        if (this.activeFile === filePath) {
            // Switch to another session or clear editor
            const remaining = this.getOpenFiles();
            if (remaining.length > 0) {
                this.switchToSession(remaining[0]);
            } else {
                this.activeFile = null;
                this.currentFile = null;
                // Clear the editor
                if (this.editor) {
                    this.editor.setValue('');
                }
            }
        }
    }

    /**
     * Get list of all open file paths
     * @returns {string[]} Array of file paths
     */
    getOpenFiles() {
        return Array.from(this.openSessions.keys());
    }

    /**
     * Mark a file as dirty (has unsaved changes)
     * @param {string} filePath - Full path to the file
     */
    markDirty(filePath) {
        const sessionData = this.openSessions.get(filePath);
        if (sessionData) {
            sessionData.isDirty = true;
            this.logger.debug(`Marked as dirty: ${filePath}`);
        }
    }

    /**
     * Mark a file as clean (saved)
     * @param {string} filePath - Full path to the file
     */
    markClean(filePath) {
        const sessionData = this.openSessions.get(filePath);
        if (sessionData) {
            sessionData.isDirty = false;
            this.logger.debug(`Marked as clean: ${filePath}`);
        }
    }

    /**
     * Extract filename from full path
     * @param {string} filePath - Full path to the file
     * @returns {string} Just the filename
     */
    getFileName(filePath) {
        return filePath.split('/').pop();
    }

    /**
     * Initialize the tab manager after editor is ready
     * @param {EditorHelper} editorHelper - Reference to editor helper
     */
    initTabManager(editorHelper) {
        this.tabManager = new AceTabManager(this, editorHelper);
        this.logger.info('Tab manager initialized');
    }
}
