/**
 * ProjectHelper - Coordinates project selection, file tree, and file loading
 *
 * This class orchestrates the three specialized modules:
 * - ProjectAPI: Server communication
 * - ProjectUI: Dialog and UI rendering
 * - ProjectFileTree: File tree management
 *
 * @class ProjectHelper
 */
class ProjectHelper {
    /**
     * Creates a new ProjectHelper instance
     * @param {Object} aceController - The Ace editor controller
     */
    constructor(aceController) {
        this.ace = aceController;
        this.logger = new Logger('ProjectHelper');

        // Initialize specialized modules
        this.api = new ProjectAPI(aceController.debuggerApiClient, this.logger);
        this.ui = new ProjectUI(this.logger);
        this.fileTree = new ProjectFileTree(this.api, this.ui, this.logger);

        // Setup file tree callbacks
        this.fileTree.setOnFileOpenCallback((filePath, content, fileName) => {
            this.onFileOpened(filePath, content, fileName);
        });

        this.fileTree.setOnFileSelectCallback((filePath) => {
            this.onFileSelected(filePath);
        });
    }

    /**
     * Show the project selection dialog
     * @returns {Promise<void>}
     */
    async showProjectDialog() {
        this.logger.info('showProjectDialog()');

        // Check server health first
        const isServerHealthy = await this.api.checkServerHealth();
        if (!isServerHealthy) {
            this.ui.showServerOfflineError(() => this.showProjectDialog());
            return;
        }

        // Create dialog HTML if it doesn't exist
        if (!$('#project-dialog').length) {
            const dialogHtml = this.ui.buildProjectDialogHtml();
            $('body').append(dialogHtml);
        }

        // Reset selection state
        this.ace.selectedProject = null;
        this.ace.selectedEntryPoint = null;

        // Show the dialog
        const dialog = $('#project-dialog').dialog({
            autoOpen: true,
            modal: true,
            width: 550,
            buttons: {
                'Select': () => {
                    this.onProjectSelectButtonClick(dialog);
                },
                'Cancel': function() {
                    $(this).dialog('close');
                }
            },
            open: () => {
                // Disable Select button initially
                $(".ui-dialog-buttonpane button:contains('Select')").prop('disabled', true);

                // Bind create buttons
                this.bindCreateButtons();

                // Load projects
                this.loadProjectsIntoDialog();
            },
            close: function() {
                // Optional: cleanup or reset
            }
        });
    }

    /**
     * Bind handlers to create project buttons
     */
    bindCreateButtons() {
        this.logger.info('bindCreateButtons()');

        const createNewBtn = $('#create-new-btn');
        const createDemoBtn = $('#create-demo-btn');

        if (createNewBtn.length === 0 || createDemoBtn.length === 0) {
            this.logger.error('Create buttons not found in DOM!');
            return;
        }

        createNewBtn.off('click').on('click', () => {
            this.logger.info('Create New button clicked');
            this.onCreateNewProject();
        });

        createDemoBtn.off('click').on('click', () => {
            this.logger.info('Create Demo button clicked');
            this.onCreateDemoProject();
        });

        this.logger.info('Create buttons bound successfully');
    }

    /**
     * Load workspace items into the project dialog
     * @returns {Promise<void>}
     */
    async loadProjectsIntoDialog() {
        this.ui.showLoadingState();

        try {
            const workspaceItems = await this.api.listWorkspaceItems();

            this.ui.renderWorkspaceItems(workspaceItems, (item, element) => {
                this.onWorkspaceItemSelected(item.name, item.type, element);
            });

        } catch (error) {
            this.logger.error('Failed to load workspace:', error);
            this.ui.showErrorState(error.message);
        }
    }

    /**
     * Handle workspace item selection
     * @param {string} itemName - Name of the selected item
     * @param {string} itemType - Type: 'directory' or 'file'
     * @param {jQuery} itemElement - The selected element
     */
    async onWorkspaceItemSelected(itemName, itemType, itemElement) {
        this.logger.info('Workspace item selected:', itemName, itemType);

        // Update UI
        $('.project-item').removeClass('selected');
        itemElement.addClass('selected');

        // Store selection
        this.ace.selectedProject = itemName;
        this.ace.selectedItemType = itemType;

        // Update UI
        this.ui.updateSelectedInfo(itemName, itemType);

        // Enable Select button
        $(".ui-dialog-buttonpane button:contains('Select')").prop('disabled', false);
    }

    /**
     * Handle create new project button click
     * @returns {Promise<void>}
     */
    async onCreateNewProject() {
        this.logger.info('Creating new project');

        const projectName = prompt('Enter a name for the new project:', 'my-project');

        if (!projectName) {
            this.logger.info('Project creation cancelled');
            return;
        }

        // Validate project name
        if (!/^[a-zA-Z0-9_-]+$/.test(projectName)) {
            alert('Invalid project name. Please use only letters, numbers, hyphens, and underscores.');
            return;
        }

        const createBtn = $('#create-new-btn');
        const originalText = createBtn.html();

        try {
            createBtn.prop('disabled', true).html('Creating...');

            const projectPath = `/${projectName}`;

            try {
                await this.api.setActiveProject(projectPath);
                this.ace.currentProjectPath = projectPath;

                alert(`Note: Please create the directory '${projectName}' in your workspace manually.\nFor now, you can use the demo project or upload files.`);

            } catch (error) {
                this.logger.warn('Cannot set active project for non-existent directory:', error);
                alert(`To create a new project:\n1. Create a folder named '${projectName}' in your workspace\n2. Add your JavaScript files\n3. Refresh and select it from the project list`);
            }

            // Reload project list
            await this.loadProjectsIntoDialog();

        } catch (error) {
            this.logger.error('Failed to create new project:', error);
            alert(`Failed to create project: ${error.message}`);
        } finally {
            createBtn.prop('disabled', false).html(originalText);
        }
    }

    /**
     * Handle create demo project button click
     * @returns {Promise<void>}
     */
    async onCreateDemoProject() {
        this.logger.info('onCreateDemoProject called');

        try {
            const projects = await this.api.listDemoProjects();
            this.logger.info('Available demo projects:', projects);

            if (projects.length === 0) {
                alert('No demo projects available');
                return;
            }

            // Show selection dialog
            await this.ui.showDemoProjectSelectionDialog(projects, async (projectName) => {
                await this.copyDemoProject(projectName);
            });

        } catch (error) {
            this.logger.error('Failed to load demo projects:', error);
            alert(`Failed to load demo projects: ${error.message || error.toString()}`);
        }
    }

    /**
     * Copy a demo project to the workspace
     * @param {string} projectName - Name of the demo project
     * @returns {Promise<void>}
     */
    async copyDemoProject(projectName) {
        try {
            const result = await this.api.copyDemoProject(projectName);
            this.logger.info('Demo project copied:', result);

            await this.loadProjectsIntoDialog();

            // Auto-select the copied project
            if (result.path) {
                const projectItem = $(`.project-item[data-item-path="/${projectName}"]`);
                if (projectItem.length) {
                    this.onWorkspaceItemSelected(projectName, 'directory', projectItem);
                }
            }

            alert(result.message || 'Demo project copied successfully!');

        } catch (error) {
            this.logger.error('Failed to copy demo project:', error);
            alert(`Failed to copy demo project: ${error.message}`);
        }
    }

    /**
     * Handle Select button click in project dialog
     * @param {jQuery} dialog - The dialog element
     * @returns {Promise<void>}
     */
    async onProjectSelectButtonClick(dialog) {
        if (!this.ace.selectedProject) {
            alert('Please select an item first');
            return;
        }

        this.logger.info(`Loading selected item: ${this.ace.selectedProject} (${this.ace.selectedItemType})`);

        try {
            const itemPath = `/${this.ace.selectedProject}`;

            if (this.ace.selectedItemType === 'directory') {
                // Directory - load as project
                await this.loadProject(itemPath);

            } else if (this.ace.selectedItemType === 'file') {
                // File - open directly
                await this.loadSingleFile(itemPath);
            }

            // Close dialog
            dialog.dialog('close');

        } catch (error) {
            this.logger.error('Failed to load selected item:', error);
            alert(`Failed to load: ${error.message}`);
        }
    }

    /**
     * Load a project directory
     * @param {string} projectPath - Path to the project
     * @returns {Promise<void>}
     */
    async loadProject(projectPath) {
        this.ace.currentProjectPath = projectPath;

        // Set as active project
        await this.api.setActiveProject(projectPath);

        // Load via ProjectManager if available
        const projectManager = window.application?.projectManager;
        if (projectManager) {
            this.logger.info('Loading project via ProjectManager:', projectPath);
            await projectManager.loadProject(projectPath, false);
        }

        // Load files into tree
        await this.fileTree.loadProjectFilesIntoTree(projectPath);

        // Show file tree panel if collapsed
        const fileTreePanel = $('#file-tree-panel');
        const wasCollapsed = fileTreePanel.hasClass('collapsed');

        if (wasCollapsed) {
            $('#toggle-filetree').click();
        }
    }

    /**
     * Load a single file (not a project)
     * @param {string} filePath - Path to the file
     * @returns {Promise<void>}
     */
    async loadSingleFile(filePath) {
        const fileName = filePath.split('/').pop();
        const content = await this.api.getFileContent(filePath);

        if (this.ace.editor) {
            this.ace.editor.setValue(content, -1);
            this.ace.currentFile = filePath;
            this.logger.info('File loaded into editor:', fileName);

            // Enable debug button for .js files
            if (fileName.endsWith('.js')) {
                this.ace.selectedFileForDebugging = filePath;
                $('#debug-start-btn').prop('disabled', false);
                $('#debug-filename').text(fileName);
            }
        }
    }

    /**
     * Callback when file is opened from file tree
     * @param {string} filePath - Full file path
     * @param {string} content - File content
     * @param {string} fileName - File name
     */
    onFileOpened(filePath, content, fileName) {
        this.logger.info('File opened:', fileName);

        // Check if file is already open
        if (this.ace.openSessions && this.ace.openSessions.has(filePath)) {
            this.logger.info('File already open, switching to it:', filePath);
            this.ace.editorHelper.switchToFile(filePath);

            // Enable debug button
            this.ace.selectedFileForDebugging = filePath;
            $('#debug-start-btn').prop('disabled', false);
            $('#debug-filename').text(fileName);
            return;
        }

        // Open file
        if (this.ace.editor && this.ace.editorHelper && this.ace.editorHelper.openFile) {
            this.ace.editorHelper.openFile(filePath, content);
            this.logger.info('File loaded into ace with new session:', fileName);
        } else if (this.ace.editor) {
            // Fallback
            this.logger.info('Using fallback loadFile method');
            this.ace.editorHelper.loadFile(filePath, content);
        } else {
            this.logger.warn('Ace editor not available yet');
        }

        // Enable debug button
        this.ace.selectedFileForDebugging = filePath;
        $('#debug-start-btn').prop('disabled', false);
        $('#debug-filename').text(fileName);
    }

    /**
     * Callback when file is selected from file tree
     * @param {string} filePath - Full file path
     */
    onFileSelected(filePath) {
        this.logger.info('File selected:', filePath);

        // Store for debugging
        this.ace.selectedFileForDebugging = filePath;

        // Enable connect button
        $('#connect-debugger-btn').prop('disabled', false);
    }

    /**
     * Load project files into the file tree
     * (Public method for external callers)
     * @param {string} projectPath - Path to the project
     * @returns {Promise<void>}
     */
    async loadProjectFilesIntoTree(projectPath) {
        return await this.fileTree.loadProjectFilesIntoTree(projectPath);
    }
}