/**
 * EditorHelper - Handles ACE editor operations and debug markers
 */
class EditorHelper {
    constructor(aceController) {
        this.ace = aceController;
        this.logger = new Logger('EditorHelper');
    }

    setupEditor() {
        this.logger.info('setupEditor()');

        // Configure editor options
        this.ace.editor.setOptions({
            showGutter: true,
            showLineNumbers: true,
            highlightActiveLine: true,
            highlightGutterLine: true
        });

        // Track content changes for dirty state (using editor-level change event)
        this.ace.editor.on('change', () => {
            const activeFile = this.ace.activeFile;
            if (activeFile) {
                this.ace.markDirty(activeFile);
                // Update tab UI to show dirty indicator
                if (this.ace.tabManager) {
                    this.ace.tabManager.markTabDirty(activeFile);
                }
            }

            if (this.ace.application) {
                this.ace.application.pub('editor:content:changed', {
                    file: this.ace.currentFile,
                    content: this.ace.editor.getValue(),
                    timestamp: Date.now()
                });
            }
        });

        // Track cursor position changes
        this.ace.editor.on('changeSelection', () => {
            const cursor = this.ace.editor.getCursorPosition();
            if (this.ace.application) {
                this.ace.application.pub('editor:cursor:moved', {
                    row: cursor.row,
                    column: cursor.column,
                    timestamp: Date.now()
                });
            }
        });

        // Setup keyboard shortcuts using Ace's command system
        this.setupAceKeyboardShortcuts();

        // Setup keyboard shortcuts for tab navigation (parent document)
        this.setupKeyboardShortcuts();

        this.logger.info('Editor setup complete');
    }

    loadFile(filename, content) {
        this.logger.info('loadFile', filename);
        this.ace.currentFile = filename;

        if (this.ace.editor) {
            this.ace.editor.setValue(content || '', -1); // -1 moves cursor to start
            this.clearDebugMarkers();

            // Determine mode based on file extension
            const extension = filename.split('.').pop();
            this.setMode(extension);

            if (this.ace.application) {
                this.ace.application.pub('editor:file:loaded', {
                    filename: filename,
                    timestamp: Date.now()
                });
            }
        }
    }

    setMode(extension) {
        const modeMap = {
            'js': 'javascript',
            'py': 'python',
            'java': 'java',
            'cpp': 'c_cpp',
            'c': 'c_cpp',
            'h': 'c_cpp',
            'hpp': 'c_cpp',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'xml': 'xml',
            'md': 'markdown'
        };

        const mode = modeMap[extension] || 'text';
        this.logger.info('Setting editor mode to', mode);

        if (this.ace.editor) {
            this.ace.editor.session.setMode(`ace/mode/${mode}`);
        }
    }

    getValue() {
        return this.ace.editor ? this.ace.editor.getValue() : null;
    }

    setValue(content) {
        if (this.ace.editor) {
            this.ace.editor.setValue(content || '', -1);
        }
    }

    setDebugLine(row) {
        this.logger.info('setDebugLine', row);

        // Clear previous debug line
        this.clearDebugLine();

        if (this.ace.editor && row !== null && row !== undefined) {
            this.ace.currentDebugLine = row;

            // Add marker for current execution line
            const Range = this.ace.editorFrame.contentWindow.ace.require('ace/range').Range;
            const range = new Range(row, 0, row, 1);

            this.ace.debugMarker = this.ace.editor.session.addMarker(
                range,
                'ace_active-line ace_debug-line',
                'fullLine'
            );

            // Scroll to the debug line
            this.ace.editor.scrollToLine(row, true, true, () => {});

            // Optionally highlight gutter
            this.ace.editor.session.addGutterDecoration(row, 'ace_debug-gutter');

            if (this.ace.application) {
                this.ace.application.pub('debugger:line:set', {
                    file: this.ace.currentFile,
                    line: row,
                    timestamp: Date.now()
                });
            }
        }
    }

    clearDebugLine() {
        this.logger.info('clearDebugLine');

        if (this.ace.editor && this.ace.currentDebugLine !== null) {
            // Remove marker
            if (this.ace.debugMarker) {
                this.ace.editor.session.removeMarker(this.ace.debugMarker);
                this.ace.debugMarker = null;
            }

            // Remove gutter decoration
            this.ace.editor.session.removeGutterDecoration(this.ace.currentDebugLine, 'ace_debug-gutter');

            this.ace.currentDebugLine = null;
        }
    }

    clearDebugMarkers() {
        this.logger.info('clearDebugMarkers');
        this.clearDebugLine();
    }

    focus() {
        if (this.ace.editor) {
            this.ace.editor.focus();
        }
    }

    resize() {
        if (this.ace.editor) {
            this.ace.editor.resize();
        }
    }

    getCurrentFile() {
        return this.ace.currentFile;
    }

    getCursorPosition() {
        return this.ace.editor ? this.ace.editor.getCursorPosition() : null;
    }

    gotoLine(line, column = 0) {
        if (this.ace.editor) {
            this.ace.editor.gotoLine(line + 1, column, true); // Ace uses 1-based line numbers
        }
    }

    setupBreakpoints(debugToolbarHelper) {
        this.logger.info('setupBreakpoints');
        this.debugToolbarHelper = debugToolbarHelper;

        if (!this.ace.editor) {
            this.logger.error('Cannot setup breakpoints: editor not initialized');
            return;
        }

        // Add gutter click event to toggle breakpoints
        this.ace.editor.on('guttermousedown', (e) => {
            const target = e.domEvent.target;

            // Only handle clicks on the gutter (line numbers area)
            if (target.className.indexOf('ace_gutter-cell') === -1) {
                return;
            }

            const row = e.getDocumentPosition().row;
            const breakpoints = this.ace.editor.session.getBreakpoints();

            this.logger.info('Gutter clicked at row', row, 'existing breakpoint:', !!breakpoints[row]);

            // Toggle breakpoint
            if (breakpoints[row]) {
                // Remove breakpoint
                this.ace.editor.session.clearBreakpoint(row);

                // Notify debug toolbar helper
                if (this.debugToolbarHelper) {
                    this.debugToolbarHelper.onBreakpointRemoved(this.ace.currentFile, row);
                }
            } else {
                // Add breakpoint
                this.ace.editor.session.setBreakpoint(row, 'ace_breakpoint');

                // Notify debug toolbar helper
                if (this.debugToolbarHelper) {
                    this.debugToolbarHelper.onBreakpointAdded(this.ace.currentFile, row);
                }
            }

            e.stop();
        });

        this.logger.info('Breakpoint gutter clicks enabled');
    }

    // === MDI (Multiple Document Interface) Methods ===

    /**
     * Get Ace mode for a file extension
     * @param {string} extension - File extension
     * @returns {string} Ace mode string (e.g., 'ace/mode/javascript')
     */
    getModeForExtension(extension) {
        const modeMap = {
            'js': 'javascript',
            'py': 'python',
            'java': 'java',
            'cpp': 'c_cpp',
            'c': 'c_cpp',
            'h': 'c_cpp',
            'hpp': 'c_cpp',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'xml': 'xml',
            'md': 'markdown'
        };

        const mode = modeMap[extension] || 'text';
        return `ace/mode/${mode}`;
    }

    /**
     * Open a file in a new or existing session
     * @param {string} filename - File path
     * @param {string} content - File content
     */
    openFile(filename, content) {
        this.logger.info('openFile', filename);

        const extension = filename.split('.').pop();
        const mode = this.getModeForExtension(extension);

        // Create or get existing session
        const sessionData = this.ace.createOrGetSession(filename, content, mode);

        // Switch to this session (state auto-restored by Ace)
        this.ace.switchToSession(filename);

        // Clear debug markers for this file
        this.clearDebugMarkers();

        // Create tab if tab manager exists
        if (this.ace.tabManager) {
            this.ace.tabManager.createTab(filename, this.ace.getFileName(filename));
        }

        if (this.ace.application) {
            this.ace.application.pub('editor:file:loaded', {
                filename: filename,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Switch to an already open file
     * @param {string} filename - File path
     */
    switchToFile(filename) {
        this.logger.info('switchToFile', filename);

        if (this.ace.switchToSession(filename)) {
            // Ace automatically restores cursor, scroll, undo/redo
            // Update tab UI if it exists
            if (this.ace.tabManager) {
                this.ace.tabManager.setActiveTab(filename);
            }

            if (this.ace.application) {
                this.ace.application.pub('editor:file:switched', {
                    filename: filename,
                    timestamp: Date.now()
                });
            }
        }
    }

    /**
     * Close a file's session
     * @param {string} filename - File path
     * @returns {boolean} True if closed, false if cancelled
     */
    closeFile(filename) {
        this.logger.info('closeFile', filename);

        // Check if dirty
        const sessionData = this.ace.openSessions.get(filename);
        if (sessionData && sessionData.isDirty) {
            if (!confirm(`${filename} has unsaved changes. Close anyway?`)) {
                return false;
            }
        }

        // Close tab if tab manager exists
        if (this.ace.tabManager) {
            this.ace.tabManager.removeTab(filename);
        }

        this.ace.closeSession(filename);

        if (this.ace.application) {
            this.ace.application.pub('editor:file:closed', {
                filename: filename,
                timestamp: Date.now()
            });
        }

        return true;
    }

    /**
     * Setup keyboard shortcuts using Ace's command system
     * This properly handles keyboard events within the editor iframe
     */
    setupAceKeyboardShortcuts() {
        this.logger.info('setupAceKeyboardShortcuts');

        if (!this.ace.editor) {
            this.logger.error('Cannot setup Ace keyboard shortcuts: editor not initialized');
            return;
        }

        // Add Ctrl+S command to Ace editor
        this.ace.editor.commands.addCommand({
            name: 'saveFile',
            bindKey: {
                win: 'Ctrl-S',
                mac: 'Command-S'
            },
            exec: (editor) => {
                this.logger.info('Ctrl+S triggered in editor');
                this.saveCurrentFile();
            },
            readOnly: false
        });

        this.logger.info('Ace keyboard shortcuts enabled');
    }

    /**
     * Setup keyboard shortcuts for tab navigation
     */
    setupKeyboardShortcuts() {
        this.logger.info('setupKeyboardShortcuts');

        document.addEventListener('keydown', (e) => {
            // Ctrl+Tab - Next tab
            if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                this.switchToNextTab();
            }

            // Ctrl+Shift+Tab - Previous tab
            if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
                e.preventDefault();
                this.switchToPreviousTab();
            }

            // Ctrl+W - Close current tab
            if (e.ctrlKey && e.key === 'w') {
                e.preventDefault();
                const activeFile = this.ace.activeFile;
                if (activeFile) {
                    this.closeFile(activeFile);
                }
            }
        });

        this.logger.info('Keyboard shortcuts enabled');
    }

    /**
     * Save the currently active file to the workspace
     */
    async saveCurrentFile() {
        this.logger.info('saveCurrentFile');

        const activeFile = this.ace.activeFile;
        if (!activeFile) {
            this.logger.warn('No active file to save');
            return;
        }

        // Check if file is from debugger workspace (starts with /)
        if (!activeFile.startsWith('/')) {
            this.logger.warn('Cannot save file - not from debugger workspace:', activeFile);
            alert('Only files loaded from the debugger workspace can be saved.');
            return;
        }

        try {
            // Get current content from editor
            const content = this.getValue();

            // Show saving indicator (optional - could add UI feedback here)
            this.logger.info(`Saving ${activeFile}...`);

            // Call API to save file
            const response = await this.ace.debuggerApiClient.saveFile(activeFile, content);

            this.logger.info('File saved successfully:', response);

            // Mark file as clean (no unsaved changes)
            this.ace.markClean(activeFile);

            // Update tab UI to clear dirty indicator
            if (this.ace.tabManager) {
                this.ace.tabManager.markTabClean(activeFile);
            }

            // Publish save event
            if (this.ace.application) {
                this.ace.application.pub('editor:file:saved', {
                    filename: activeFile,
                    size: response.size,
                    modified: response.modified,
                    timestamp: Date.now()
                });
            }

            // Optional: Show brief success message (could use toast notification)
            this.logger.info(`File saved: ${activeFile}`);

        } catch (error) {
            this.logger.error('Failed to save file:', error);
            alert(`Failed to save file: ${error.message}`);
        }
    }

    /**
     * Switch to the next tab
     */
    switchToNextTab() {
        const openFiles = this.ace.getOpenFiles();
        if (openFiles.length === 0) return;

        const currentIndex = openFiles.indexOf(this.ace.activeFile);
        const nextIndex = (currentIndex + 1) % openFiles.length;
        this.switchToFile(openFiles[nextIndex]);
    }

    /**
     * Switch to the previous tab
     */
    switchToPreviousTab() {
        const openFiles = this.ace.getOpenFiles();
        if (openFiles.length === 0) return;

        const currentIndex = openFiles.indexOf(this.ace.activeFile);
        const prevIndex = (currentIndex - 1 + openFiles.length) % openFiles.length;
        this.switchToFile(openFiles[prevIndex]);
    }
}
