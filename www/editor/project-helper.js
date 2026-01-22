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
            position: { my: "center", at: "center", of: window },
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
        const importBtn = $('#import-project-btn');

        if (createNewBtn.length === 0 || createDemoBtn.length === 0 || importBtn.length === 0) {
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

        importBtn.off('click').on('click', () => {
            this.logger.info('Import button clicked');
            this.onImportProject();
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

            await this.ui.renderWorkspaceItems(
                workspaceItems,
                (item, element, packageInfo) => {
                    this.onWorkspaceItemSelected(item.name, item.type, element, packageInfo);
                },
                (item, element) => {
                    this.onWorkspaceItemDelete(item.name, item.type, element);
                }
            );

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
     * @param {Object} packageInfo - Package.json data (optional)
     */
    async onWorkspaceItemSelected(itemName, itemType, itemElement, packageInfo) {
        this.logger.info('Workspace item selected:', itemName, itemType);

        // Update UI
        $('.project-item').removeClass('selected');
        itemElement.addClass('selected');

        // Store selection
        this.ace.selectedProject = itemName;
        this.ace.selectedItemType = itemType;

        // Get last modified date for directories
        let itemMetadata = null;
        if (itemType === 'directory') {
            try {
                const files = await this.api.listProjectFiles(`/${itemName}`);
                if (files.length > 0) {
                    // Find the most recent modification date
                    const dates = files
                        .filter(f => f.modified)
                        .map(f => new Date(f.modified));

                    if (dates.length > 0) {
                        const mostRecent = new Date(Math.max(...dates));
                        itemMetadata = { modified: mostRecent.toISOString() };
                    }
                }
            } catch (error) {
                this.logger.warn('Could not get last modified date:', error);
            }
        } else if (itemType === 'file') {
            // For files, get the file's own modified date
            try {
                const files = await this.api.listWorkspaceItems();
                const fileItem = files.find(f => f.name === itemName && f.type === 'file');
                if (fileItem && fileItem.modified) {
                    itemMetadata = { modified: fileItem.modified };
                }
            } catch (error) {
                this.logger.warn('Could not get file modified date:', error);
            }
        }

        // Update UI with package info and metadata
        this.ui.updateSelectedInfo(itemName, itemType, packageInfo, itemMetadata);

        // Enable Select button
        $(".ui-dialog-buttonpane button:contains('Select')").prop('disabled', false);
    }

    /**
     * Handle workspace item delete
     * @param {string} itemName - Name of the item to delete
     * @param {string} itemType - Type: 'directory' or 'file'
     * @param {jQuery} itemElement - The item element
     */
    async onWorkspaceItemDelete(itemName, itemType, itemElement) {
        this.logger.info('Delete requested for:', itemName, itemType);

        const itemTypeLabel = itemType === 'directory' ? 'project' : 'file';

        // Confirm deletion
        const confirmMsg = `Are you sure you want to delete the ${itemTypeLabel} "${itemName}"?\n\nThis action cannot be undone.`;
        if (!confirm(confirmMsg)) {
            this.logger.info('Delete cancelled by user');
            return;
        }

        try {
            const itemPath = `/${itemName}`;

            // Call API to delete
            this.logger.info('Deleting item:', itemPath);
            const response = await fetch(`http://localhost:8080/workspace${itemPath}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                let errorMessage = 'Failed to delete';
                try {
                    const error = await response.json();
                    errorMessage = error.error || errorMessage;
                } catch (e) {
                    // Response is not JSON, try to get text
                    const text = await response.text();
                    errorMessage = text || `Server error: ${response.status}`;
                }
                throw new Error(errorMessage);
            }

            this.logger.info('Item deleted successfully');

            // Remove from UI
            itemElement.fadeOut(300, function() {
                $(this).remove();
            });

            // If it was the selected item, clear selection
            if (this.ace.selectedProject === itemName) {
                this.ace.selectedProject = null;
                this.ace.selectedItemType = null;
                $('#selected-project-info').hide();
                $(".ui-dialog-buttonpane button:contains('Select')").prop('disabled', true);
            }

            // Show success message
            this.ui.showNotification(`✓ ${itemTypeLabel.charAt(0).toUpperCase() + itemTypeLabel.slice(1)} "${itemName}" deleted successfully.`, 'success');

        } catch (error) {
            this.logger.error('Failed to delete item:', error);
            this.ui.showNotification(`⚠️ Failed to delete ${itemTypeLabel}: ${error.message}`, 'error', 5000);
        }
    }

    /**
     * Handle create new project button click
     * @returns {Promise<void>}
     */
    async onCreateNewProject() {
        this.logger.info('Creating new project');

        // Show new project dialog
        const projectInfo = await this.ui.showNewProjectDialog();

        if (!projectInfo) {
            this.logger.info('Project creation cancelled');
            return;
        }

        const createBtn = $('#create-new-btn');
        const originalText = createBtn.html();

        try {
            createBtn.prop('disabled', true).html('Creating...');

            const projectPath = `/${projectInfo.name}`;

            // Create the project directory
            this.logger.info('Creating project directory:', projectPath);
            await this.api.createDirectory(projectPath);

            // Create index.js with template content
            const indexContent = `/**
 * ${projectInfo.name} - Pithagoras Simulator Project
 *
 * ${projectInfo.description || 'This is a blank project for working with the CircuitJS1 simulator.'}
 * Run this while node-inspector-websocket-proxy is running and Pithagoras is connected.
 */

async function main() {
    console.log('Starting ${projectInfo.name}...');

    // Your code here

    console.log('Ready!');
}

main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
`;
            this.logger.info('Creating index.js...');
            await this.api.saveFile(`${projectPath}/index.js`, indexContent);

            // Create package.json
            const packageJson = {
                name: projectInfo.name,
                version: projectInfo.version,
                description: projectInfo.description || "A Pithagoras simulator project",
                main: "index.js",
                dependencies: {}
            };

            // Add optional fields if provided
            if (projectInfo.author) {
                packageJson.author = projectInfo.author;
            }
            if (projectInfo.license) {
                packageJson.license = projectInfo.license;
            }
            if (projectInfo.platform) {
                packageJson.platform = projectInfo.platform;
            }

            this.logger.info('Creating package.json...');
            await this.api.saveFile(`${projectPath}/package.json`, JSON.stringify(packageJson, null, 2));

            this.logger.info('Project files created successfully');

            // Close the dialog
            $('#project-dialog').dialog('close');

            // Run the existing open project logic
            await this.loadProject(projectPath);

        } catch (error) {
            this.logger.error('Failed to create new project:', error);
            this.ui.showNotification(`⚠️ Failed to create project: ${error.message}`, 'error', 5000);
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
                this.ui.showNotification('ℹ️ No demo projects available', 'info');
                return;
            }

            // Show selection dialog
            await this.ui.showDemoProjectSelectionDialog(projects, async (projectName) => {
                await this.copyDemoProject(projectName);
            });

        } catch (error) {
            this.logger.error('Failed to load demo projects:', error);
            this.ui.showNotification(`⚠️ Failed to load demo projects: ${error.message || error.toString()}`, 'error', 5000);
        }
    }

    /**
     * Handle import project button click
     * @returns {Promise<void>}
     */
    async onImportProject() {
        this.logger.info('Importing project from file');

        // Create hidden file input if it doesn't exist
        let fileInput = $('#project-dialog-import-file');
        if (fileInput.length === 0) {
            fileInput = $('<input type="file" id="project-dialog-import-file" accept=".zip" style="display: none;">');
            $('body').append(fileInput);

            // Handle file selection
            fileInput.on('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    this.logger.info('Importing project from file:', file.name);

                    // Use ProjectManager if available
                    const projectManager = window.application?.projectManager;
                    if (projectManager) {
                        await projectManager.importProject(file);
                        this.ui.showNotification('✓ Project imported successfully!', 'success');

                        // Close dialog
                        $('#project-dialog').dialog('close');

                        // Reload project list
                        await this.loadProjectsIntoDialog();
                    } else {
                        throw new Error('ProjectManager not available');
                    }

                    // Reset file input
                    fileInput.val('');
                } catch (err) {
                    this.logger.error('Failed to import project:', err);
                    this.ui.showNotification(`⚠️ Failed to import project: ${err.message}`, 'error', 5000);
                }
            });
        }

        // Trigger file selection
        fileInput.click();
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
                    // Read package info for the copied project
                    const packageInfo = await this.ui.readPackageJson(projectName);
                    this.onWorkspaceItemSelected(projectName, 'directory', projectItem, packageInfo);
                }
            }

            this.ui.showNotification(`✓ ${result.message || 'Demo project copied successfully!'}`, 'success');

        } catch (error) {
            this.logger.error('Failed to copy demo project:', error);
            this.ui.showNotification(`⚠️ Failed to copy demo project: ${error.message}`, 'error', 5000);
        }
    }

    /**
     * Handle Select button click in project dialog
     * @param {jQuery} dialog - The dialog element
     * @returns {Promise<void>}
     */
    async onProjectSelectButtonClick(dialog) {
        if (!this.ace.selectedProject) {
            this.ui.showNotification('ℹ️ Please select an item first', 'info');
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
            this.ui.showNotification(`⚠️ Failed to load: ${error.message}`, 'error', 5000);
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