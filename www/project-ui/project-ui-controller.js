/**
 * Project UI Controller
 *
 * Handles UI interactions for project management:
 * - Button click handlers
 * - Dialog interactions
 * - Project list display
 * - Import file handling
 *
 * Coordinates between UI and ProjectManager
 */

class ProjectUIController {
    constructor(projectManager) {
        this.projectManager = projectManager;
        this.logger = new Logger('ProjectUIController');
    }

    /**
     * Initialize UI bindings
     */
    initialize() {
        this.logger.info('Initializing project UI');

        // Bind button click handlers
        $('#project-new-btn').on('click', () => this._handleNewProject());
        $('#project-open-btn').on('click', () => this._handleOpenProject());
        $('#project-save-btn').on('click', () => this._handleSaveProject());
        $('#project-export-btn').on('click', () => this._handleExportProject());
        $('#project-import-btn').on('click', () => this._handleImportProject());

        // Subscribe to project events
        this.projectManager.ctx.sub(/^project:/, (event, data) => {
            this._handleProjectEvent(event, data);
        });
    }

    /**
     * Handle new project button click
     */
    async _handleNewProject() {
        try {
            // Use ACE controller's ProjectHelper to show the new project dialog
            const aceController = this.projectManager.ctx.aceController;
            if (aceController && aceController.projectHelper) {
                await aceController.projectHelper.onCreateNewProject();
            } else {
                this.logger.error('ACE controller or ProjectHelper not available');
                alert('Project system not initialized');
            }
        } catch (err) {
            this.logger.error('Failed to create project:', err);
            alert(`Failed to create project: ${err.message}`);
            this._showStatus('Failed to create project', 'error');
        }
    }

    /**
     * Handle open project button click - uses existing ProjectHelper dialog
     */
    async _handleOpenProject() {
        try {
            this.logger.info('Opening project dialog');

            // Use the existing ProjectHelper dialog
            const aceController = this.projectManager.ctx.aceController;
            if (aceController && aceController.projectHelper) {
                aceController.projectHelper.showProjectDialog();
            } else {
                this.logger.error('ACE controller or ProjectHelper not available');
                alert('Project system not initialized');
            }
        } catch (err) {
            this.logger.error('Failed to open project dialog:', err);
            alert(`Failed to open project dialog: ${err.message}`);
        }
    }

    /**
     * Handle save project button click
     */
    async _handleSaveProject() {
        try {
            // First check if ProjectManager has a current project
            let currentProject = this.projectManager.getCurrentProject();

            // If not, try to get from ACE controller
            const aceController = this.projectManager.ctx.aceController;
            if (!currentProject && aceController && aceController.currentProjectPath) {
                // Sync the current project from aceController to projectManager
                const projectPath = aceController.currentProjectPath;
                this.logger.info('Syncing project from ACE controller:', projectPath);

                // Extract project name from path
                const projectName = projectPath.split('/').filter(p => p).pop();

                // Set it in project manager
                this.projectManager.currentProject = {
                    path: projectName,
                    name: projectName,
                    hardware: 'none', // Unknown, will be read from package.json on save
                    entry: null
                };

                currentProject = this.projectManager.currentProject;
            }

            if (!currentProject) {
                alert('No project is currently open. Please open a project first.');
                return;
            }

            this.logger.info('Saving project:', currentProject.name);
            this._showStatus(`Saving ${currentProject.name}...`);

            // Save project
            await this.projectManager.saveProject();

            this._showStatus(`Saved ${currentProject.name}!`, 'success');
        } catch (err) {
            this.logger.error('Failed to save project:', err);
            alert(`Failed to save project: ${err.message}`);
            this._showStatus('Failed to save project', 'error');
        }
    }

    /**
     * Handle export project button click
     */
    async _handleExportProject() {
        try {
            // First check if ProjectManager has a current project
            let currentProject = this.projectManager.getCurrentProject();

            // If not, try to get from ACE controller
            const aceController = this.projectManager.ctx.aceController;
            if (!currentProject && aceController && aceController.currentProjectPath) {
                // Sync the current project from aceController to projectManager
                const projectPath = aceController.currentProjectPath;
                this.logger.info('Syncing project from ACE controller for export:', projectPath);

                // Extract project name from path
                const projectName = projectPath.split('/').filter(p => p).pop();

                // Set it in project manager
                this.projectManager.currentProject = {
                    path: projectName,
                    name: projectName,
                    hardware: 'none',
                    entry: null
                };

                currentProject = this.projectManager.currentProject;
            }

            if (!currentProject) {
                alert('No project is currently open. Please open a project first.');
                return;
            }

            this.logger.info('Exporting project:', currentProject.name);
            this._showStatus(`Exporting ${currentProject.name}...`);

            // Export project (triggers download)
            await this.projectManager.exportProject();

            this._showStatus(`Exported ${currentProject.name}!`, 'success');
        } catch (err) {
            this.logger.error('Failed to export project:', err);
            alert(`Failed to export project: ${err.message}`);
            this._showStatus('Failed to export project', 'error');
        }
    }

    /**
     * Handle import project button click
     */
    _handleImportProject() {
        // Create hidden file input if it doesn't exist
        let fileInput = $('#project-import-file');
        if (fileInput.length === 0) {
            fileInput = $('<input type="file" id="project-import-file" accept=".zip" style="display: none;">');
            $('body').append(fileInput);

            // Handle file selection
            fileInput.on('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    this.logger.info('Importing project from file:', file.name);
                    this._showStatus(`Importing ${file.name}...`);

                    // Import project
                    await this.projectManager.importProject(file);

                    this._showStatus('Project imported successfully!', 'success');

                    // Reset file input
                    fileInput.val('');
                } catch (err) {
                    this.logger.error('Failed to import project:', err);
                    alert(`Failed to import project: ${err.message}`);
                    this._showStatus('Failed to import project', 'error');
                }
            });
        }

        // Trigger file selection
        fileInput.click();
    }

    /**
     * Show project list dialog
     */
    async _showProjectListDialog(projects) {
        return new Promise((resolve) => {
            // Create dialog HTML
            const dialogHtml = `
                <div id="project-list-dialog" title="Open Project" style="display:none;">
                    <div style="margin-bottom: 10px;">
                        <label for="project-filter">Filter:</label>
                        <input type="text" id="project-filter" style="width: 100%; margin-top: 5px;" placeholder="Type to filter...">
                    </div>
                    <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ccc; padding: 10px;">
                        ${projects.map(p => `
                            <div class="project-item" data-path="${p.path}" style="padding: 10px; margin-bottom: 5px; border: 1px solid #ddd; cursor: pointer; border-radius: 3px;">
                                <div style="font-weight: bold;">${p.name}</div>
                                <div style="font-size: 11px; color: #666;">
                                    Hardware: ${p.hardware} | Modified: ${new Date(p.modified).toLocaleDateString()}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            // Add dialog to page
            $(dialogHtml).appendTo('body');

            // Initialize jQuery UI dialog
            const dialog = $('#project-list-dialog').dialog({
                modal: true,
                width: 500,
                buttons: {
                    Cancel: function() {
                        $(this).dialog('close');
                        resolve(null);
                    }
                },
                close: function() {
                    $(this).remove();
                }
            });

            // Project item click handler
            $('.project-item').on('click', function() {
                const path = $(this).data('path');
                dialog.dialog('close');
                resolve(path);
            });

            // Filter functionality
            $('#project-filter').on('keyup', function() {
                const filter = $(this).val().toLowerCase();
                $('.project-item').each(function() {
                    const name = $(this).text().toLowerCase();
                    $(this).toggle(name.includes(filter));
                });
            });

            // Highlight on hover
            $('.project-item').hover(
                function() { $(this).css('background-color', '#e8e8e8'); },
                function() { $(this).css('background-color', ''); }
            );
        });
    }

    /**
     * Show status message
     */
    _showStatus(message, type = 'info') {
        // Find or create status display
        let statusBar = $('#project-status-bar');

        if (statusBar.length === 0) {
            statusBar = $('<div id="project-status-bar" style="position: fixed; bottom: 20px; right: 20px; padding: 10px 15px; border-radius: 3px; background: #333; color: #fff; z-index: 10000; font-size: 13px;"></div>');
            $('body').append(statusBar);
        }

        // Set color based on type
        const colors = {
            info: '#3498db',
            success: '#27ae60',
            error: '#e74c3c'
        };

        statusBar.css('background', colors[type] || colors.info);
        statusBar.text(message);
        statusBar.fadeIn();

        // Auto-hide after 3 seconds
        setTimeout(() => {
            statusBar.fadeOut();
        }, 3000);
    }

    /**
     * Handle project events from manager
     */
    _handleProjectEvent(event, data) {
        this.logger.debug('Project event:', event, data);

        switch (event) {
            case 'project:created':
                this._onProjectCreated(data);
                break;
            case 'project:loaded':
                this._onProjectLoaded(data);
                break;
            case 'project:saved':
                this._onProjectSaved(data);
                break;
            case 'project:exported':
                this._onProjectExported(data);
                break;
            case 'project:imported':
                this._onProjectImported(data);
                break;
        }
    }

    /**
     * Handle project created event
     */
    _onProjectCreated(data) {
        this.logger.info('Project created:', data);
        // UI updates can go here
    }

    /**
     * Handle project loaded event
     */
    _onProjectLoaded(data) {
        this.logger.info('Project loaded:', data);

        // Show npm install output if available
        if (data.npmInstall && !data.npmInstall.success) {
            console.warn('npm install had issues:', data.npmInstall);
        }

        // UI updates can go here
    }

    /**
     * Handle project saved event
     */
    _onProjectSaved(data) {
        this.logger.info('Project saved:', data);
        // UI updates can go here
    }

    /**
     * Handle project exported event
     */
    _onProjectExported(data) {
        this.logger.info('Project exported:', data);
        // UI updates can go here
    }

    /**
     * Handle project imported event
     */
    _onProjectImported(data) {
        this.logger.info('Project imported:', data);
        // UI updates can go here
    }
}

// Make ProjectUIController available globally for browser use
window.ProjectUIController = ProjectUIController;