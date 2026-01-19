/**
 * ProjectHelper - Handles project selection, file tree, and file loading
 */
class ProjectHelper {
    constructor(aceController) {
        this.ace = aceController;
        this.logger = new Logger('ProjectHelper');
    }

    async showProjectDialog() {
        this.logger.info('showProjectDialog()');

        // Check server health first
        const isServerHealthy = await this.ace.debuggerApiClient.checkServerHealth();
        if (!isServerHealthy) {
            this.showServerOfflineError();
            return;
        }

        // Create dialog HTML if it doesn't exist
        if (!$('#project-dialog').length) {
            const dialogHtml = this.buildProjectDialogHtml();
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

                // Bind the create buttons first (before loading projects)
                this.bindCreateButtons();

                // Load projects when dialog opens
                this.loadProjectsIntoDialog();
            },
            close: function() {
                // Optional: cleanup or reset
            }
        });
    }

    buildProjectDialogHtml() {
        return `
            <div id="project-dialog" title="Select or Create Project" style="display: none;">
                <div style="padding: 15px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold; font-size: 13px;">Workspace Files & Folders:</label>
                    <div id="project-list" style="max-height: 300px; overflow-y: auto; border: 1px solid #ccc; border-radius: 4px; padding: 10px; margin-bottom: 15px; background: #f9f9f9;">
                        <div class="loading-spinner">
                            Loading workspace contents...
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <button id="create-new-btn" style="flex: 1; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">
                            📁 Create New Project
                        </button>
                        <button id="create-demo-btn" style="flex: 1; padding: 10px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">
                            📋 Copy Demo Project
                        </button>
                    </div>

                    <div id="selected-project-info" style="padding: 10px; background: #f4f4f4; border-radius: 4px; font-size: 12px; display: none;">
                        <span class="info-label">Selected:</span>
                        <span id="selected-project-name" class="info-value" style="font-family: monospace;"></span>
                    </div>
                </div>
            </div>
        `;
    }

    bindCreateButtons() {
        this.logger.info('bindCreateButtons()');

        const createNewBtn = $('#create-new-btn');
        const createDemoBtn = $('#create-demo-btn');

        this.logger.info(`Found create buttons: new=${createNewBtn.length}, demo=${createDemoBtn.length}`);

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

    async loadProjectsIntoDialog() {
        const projectListContainer = $('#project-list');

        try {
            projectListContainer.html('<div class="loading-spinner">Loading workspace contents...</div>');

            const workspaceItems = await this.ace.debuggerApiClient.listWorkspace();

            if (workspaceItems.length === 0) {
                this.showEmptyProjectState();
                return;
            }

            // Clear loading spinner
            projectListContainer.empty();

            // Sort items: directories first, then files
            const sortedItems = workspaceItems.sort((a, b) => {
                if (a.type === b.type) {
                    return a.name.localeCompare(b.name);
                }
                return a.type === 'directory' ? -1 : 1;
            });

            // Add each item as a selectable item
            sortedItems.forEach(item => {
                const icon = item.type === 'directory' ? '📁' : '📄';
                const itemType = item.type === 'directory' ? 'folder' : 'file';

                const workspaceItem = $(`
                    <div class="project-item ${itemType}" data-item-path="/${item.name}" data-item-type="${item.type}">
                        <span style="margin-right: 8px;">${icon}</span>
                        <div style="flex: 1;">
                            <div class="project-item-name">${item.name}</div>
                            <div class="project-item-path" style="font-size: 11px; color: #666;">/${item.name} ${item.type === 'directory' ? '' : '(' + this.formatFileSize(item.size) + ')'}</div>
                        </div>
                    </div>
                `);

                workspaceItem.on('click', () => {
                    this.onWorkspaceItemSelected(item.name, item.type, workspaceItem);
                });

                projectListContainer.append(workspaceItem);
            });

        } catch (error) {
            this.logger.error('Failed to load workspace:', error);
            projectListContainer.html(`
                <div class="error-message">
                    Failed to load workspace: ${error.message}
                </div>
            `);
        }
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    showEmptyProjectState() {
        $('#project-list').html(`
            <div class="empty-state">
                <div style="font-size: 48px; margin-bottom: 10px;">📁</div>
                <div style="font-size: 14px; margin-bottom: 20px; color: #999;">
                    No files or folders found in workspace.<br>
                    Create a new project or copy the demo project to get started!
                </div>
            </div>
        `);
    }

    async onWorkspaceItemSelected(itemName, itemType, itemElement) {
        this.logger.info('Workspace item selected:', itemName, itemType);

        // Remove selected class from all items
        $('.project-item').removeClass('selected');

        // Add selected class to clicked item
        itemElement.addClass('selected');

        // Store selected item
        this.ace.selectedProject = itemName;
        this.ace.selectedItemType = itemType;

        // Show selected item info
        $('#selected-project-info').show();
        const displayText = itemType === 'directory' ? `📁 ${itemName}` : `📄 ${itemName}`;
        $('#selected-project-name').text(displayText);

        // Enable Select button
        $(".ui-dialog-buttonpane button:contains('Select')").prop('disabled', false);
    }

    async findEntryPoint(projectName) {
        try {
            const projectPath = `/${projectName}`;
            const files = await this.ace.debuggerApiClient.listProjectFiles(projectPath);

            this.logger.info('Project files:', files);

            // Look for conventional entry points
            const entryPoints = ['index.js', 'main.js'];
            for (const entry of entryPoints) {
                if (files.some(f => f.name === entry && f.type === 'file')) {
                    return entry;
                }
            }

            // No conventional entry point found - look for any .js file
            const jsFiles = files.filter(f => f.type === 'file' && f.name.endsWith('.js'));

            if (jsFiles.length === 0) {
                throw new Error('No JavaScript files found in project');
            }

            // If there's only one .js file, use it
            if (jsFiles.length === 1) {
                return jsFiles[0].name;
            }

            // Multiple JS files - show file picker
            return await this.showFilePicker(projectName, jsFiles);

        } catch (error) {
            this.logger.error('Error finding entry point:', error);
            throw error;
        }
    }

    async showFilePicker(projectName, jsFiles) {
        return new Promise((resolve, reject) => {
            // Create file picker dialog
            const filePickerHtml = `
                <div id="file-picker-dialog" title="Select Entry Point" style="display: none;">
                    <div style="padding: 15px;">
                        <p style="margin-bottom: 10px;">Multiple JavaScript files found. Please select the entry point:</p>
                        <div id="file-picker-list" style="max-height: 200px; overflow-y: auto; border: 1px solid #ccc; border-radius: 4px; padding: 10px; background: #f9f9f9;">
                        </div>
                    </div>
                </div>
            `;

            if (!$('#file-picker-dialog').length) {
                $('body').append(filePickerHtml);
            }

            const filePickerList = $('#file-picker-list');
            filePickerList.empty();

            let selectedFile = null;

            jsFiles.forEach(file => {
                const fileItem = $(`
                    <div class="file-picker-item" style="padding: 8px; margin: 3px 0; background: white; border: 2px solid #ddd; border-radius: 3px; cursor: pointer;">
                        ${file.name}
                    </div>
                `);

                fileItem.on('click', function() {
                    $('.file-picker-item').css('background', 'white').css('border-color', '#ddd');
                    $(this).css('background', '#4caf50').css('color', 'white').css('border-color', '#2e7d32');
                    selectedFile = file.name;
                });

                filePickerList.append(fileItem);
            });

            $('#file-picker-dialog').dialog({
                modal: true,
                width: 400,
                buttons: {
                    'Select': function() {
                        if (selectedFile) {
                            $(this).dialog('close');
                            resolve(selectedFile);
                        } else {
                            alert('Please select a file');
                        }
                    },
                    'Cancel': function() {
                        $(this).dialog('close');
                        reject(new Error('File selection cancelled'));
                    }
                },
                close: function() {
                    $(this).remove();
                }
            });
        });
    }

    async onCreateNewProject() {
        this.logger.info('Creating new project');

        // Prompt user for project name
        const projectName = prompt('Enter a name for the new project:', 'my-project');

        if (!projectName) {
            this.logger.info('Project creation cancelled');
            return;
        }

        // Validate project name (basic validation)
        if (!/^[a-zA-Z0-9_-]+$/.test(projectName)) {
            alert('Invalid project name. Please use only letters, numbers, hyphens, and underscores.');
            return;
        }

        const createBtn = $('#create-new-btn');
        const originalText = createBtn.html();

        try {
            // Disable button and show loading state
            createBtn.prop('disabled', true).html('Creating...');

            const projectPath = `/${projectName}`;

            try {
                await this.ace.debuggerApiClient.setActiveProject(projectPath);
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
            // Re-enable button
            createBtn.prop('disabled', false).html(originalText);
        }
    }

    async onCreateDemoProject() {
        this.logger.info('onCreateDemoProject called');

        try {
            // Fetch available demo projects
            const projects = await this.ace.debuggerApiClient.listDemoProjects();
            this.logger.info('Available demo projects:', projects);

            if (projects.length === 0) {
                alert('No demo projects available');
                return;
            }

            // Show selection dialog
            await this.showDemoProjectSelectionDialog(projects);

        } catch (error) {
            this.logger.error('Failed to load demo projects:', error);
            alert(`Failed to load demo projects: ${error.message || error.toString()}`);
        }
    }

    async showDemoProjectSelectionDialog(projects) {
        return new Promise((resolve) => {
            const dialogHtml = `
                <div id="demo-project-dialog" title="Select Demo Project" style="display: none;">
                    <div style="padding: 15px;">
                        <p style="margin-bottom: 15px;">Select an example project to copy to your workspace:</p>
                        <div id="demo-project-list" style="max-height: 300px; overflow-y: auto;">
                            ${projects.map(p => `
                                <div class="demo-project-item" data-name="${p.name}" style="padding: 12px; margin: 8px 0; background: #f9f9f9; border: 2px solid #ddd; border-radius: 4px; cursor: pointer;">
                                    <div style="font-weight: bold; font-size: 14px;">${p.name}</div>
                                    <div style="font-size: 12px; color: #666; margin-top: 4px;">${p.description || 'No description'}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;

            $('#demo-project-dialog').remove();
            $('body').append(dialogHtml);

            let selectedProject = null;

            $('.demo-project-item').on('click', function() {
                $('.demo-project-item').css({ 'background': '#f9f9f9', 'border-color': '#ddd' });
                $(this).css({ 'background': '#e3f2fd', 'border-color': '#2196F3' });
                selectedProject = $(this).data('name');
            });

            $('#demo-project-dialog').dialog({
                modal: true,
                width: 450,
                buttons: {
                    'Copy to Workspace': async () => {
                        if (!selectedProject) {
                            alert('Please select a project');
                            return;
                        }

                        $('#demo-project-dialog').dialog('close');

                        try {
                            const result = await this.ace.debuggerApiClient.copyDemoProject(selectedProject);
                            this.logger.info('Demo project copied:', result);

                            await this.loadProjectsIntoDialog();

                            if (result.path) {
                                const projectItem = $(`.project-item[data-item-path="/${selectedProject}"]`);
                                if (projectItem.length) {
                                    this.onWorkspaceItemSelected(selectedProject, 'directory', projectItem);
                                }
                            }

                            alert(result.message || 'Demo project copied successfully!');

                        } catch (error) {
                            this.logger.error('Failed to copy demo project:', error);
                            alert(`Failed to copy demo project: ${error.message}`);
                        }

                        resolve();
                    },
                    'Cancel': function() {
                        $(this).dialog('close');
                        resolve();
                    }
                },
                close: function() {
                    $(this).remove();
                }
            });
        });
    }

    async onProjectSelectButtonClick(dialog) {
        if (!this.ace.selectedProject) {
            alert('Please select an item first');
            return;
        }

        this.logger.info(`Loading selected item: ${this.ace.selectedProject} (${this.ace.selectedItemType})`);

        try {
            const itemPath = `/${this.ace.selectedProject}`;

            if (this.ace.selectedItemType === 'directory') {
                // It's a directory - load it as a project
                this.ace.currentProjectPath = itemPath;

                // Set as active project
                await this.ace.debuggerApiClient.setActiveProject(itemPath);

                // Load the project using ProjectManager (this loads circuit, editor state, etc.)
                const projectManager = window.application?.projectManager;
                if (projectManager) {
                    this.logger.info('Loading project via ProjectManager:', itemPath);
                    await projectManager.loadProject(itemPath, false); // false = don't run npm install
                }

                // Load files into the file tree (always do this)
                await this.loadProjectFilesIntoTree(this.ace.currentProjectPath);

                // Show the file tree panel if it's collapsed
                const fileTreePanel = $('#file-tree-panel');
                const wasCollapsed = fileTreePanel.hasClass('collapsed');

                if (wasCollapsed) {
                    $('#toggle-filetree').click();
                }

            } else if (this.ace.selectedItemType === 'file') {
                // It's a file - open it directly
                const fileName = this.ace.selectedProject;

                // Load the file content
                const content = await this.ace.debuggerApiClient.getFileContent(itemPath);

                // Open in editor
                if (this.ace.editor) {
                    this.ace.editor.setValue(content, -1);
                    this.ace.currentFile = itemPath;
                    this.logger.info('File loaded into editor:', fileName);

                    // Enable debug button for .js files
                    if (fileName.endsWith('.js')) {
                        this.ace.selectedFileForDebugging = itemPath;
                        $('#debug-start-btn').prop('disabled', false);
                        $('#debug-filename').text(fileName);
                    }
                }
            }

            // Close the project dialog
            dialog.dialog('close');

        } catch (error) {
            this.logger.error('Failed to load selected item:', error);
            alert(`Failed to load: ${error.message}`);
        }
    }

    async loadProjectFilesIntoTree(projectPath) {
        this.logger.info('Loading files into tree for:', projectPath);

        try {
            const files = await this.ace.debuggerApiClient.listProjectFiles(projectPath);
            this.logger.info('Files loaded:', files);

            const fileTree = $('#file-tree');
            fileTree.empty();

            if (files.length === 0) {
                fileTree.html('<div class="file-tree-placeholder">No files found in project</div>');
                return;
            }

            // Extract project name from path (e.g., "/demo-project" -> "demo-project")
            const projectName = projectPath.split('/').filter(p => p).pop() || projectPath;

            // Create root project folder item
            const projectRoot = $(`
                <div class="file-tree-item file-tree-directory file-tree-root" data-dir-path="${projectPath}" data-depth="0">
                    <span class="file-icon dir-icon">▼</span>
                    <span class="file-icon">📁</span>
                    <span class="file-name">${projectName}</span>
                </div>
            `);

            // Create container for project contents (already expanded)
            const projectContents = $(`
                <div class="file-tree-directory-contents expanded"></div>
            `);

            // Render files inside the project root
            this.renderFileTreeItems(files, projectPath, projectContents, 1);

            fileTree.append(projectRoot);
            fileTree.append(projectContents);

            // Make root collapsible
            projectRoot.on('click', async (e) => {
                e.stopPropagation();
                const dirIcon = projectRoot.find('.dir-icon');
                const isExpanded = projectContents.hasClass('expanded');

                if (isExpanded) {
                    dirIcon.text('▶');
                    projectContents.removeClass('expanded');
                } else {
                    dirIcon.text('▼');
                    projectContents.addClass('expanded');
                }
            });

        } catch (error) {
            this.logger.error('Failed to load project files:', error);
            throw error;
        }
    }

    renderFileTreeItems(items, currentPath, container, depth) {
        // Sort items: directories first, then files, alphabetically within each group
        const sortedItems = items.sort((a, b) => {
            // Directories come before files
            if (a.type === 'directory' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'directory') return 1;
            // Within the same type, sort alphabetically
            return a.name.localeCompare(b.name);
        });

        sortedItems.forEach(item => {
            if (item.type === 'directory') {
                // Create directory item with expand/collapse and add icon
                const dirItem = $(`
                    <div class="file-tree-item file-tree-directory" data-dir-path="${currentPath}/${item.name}" data-depth="${depth}">
                        <span class="file-icon dir-icon">▶</span>
                        <span class="file-icon">📁</span>
                        <span class="file-name">${item.name}</span>
                        <span class="file-action-icon add-icon" title="Create new file or folder">➕</span>
                    </div>
                `);

                // Apply padding based on depth
                dirItem.css('padding-left', `${depth * 16 + 8}px`);

                // Create container for directory contents
                const dirContents = $(`
                    <div class="file-tree-directory-contents"></div>
                `);

                // Add click handler for the add icon
                dirItem.find('.add-icon').on('click', async (e) => {
                    e.stopPropagation();
                    await this.showCreateItemDialog(`${currentPath}/${item.name}`, dirItem, dirContents, depth);
                });

                // Toggle directory on click (but not when clicking the add icon)
                dirItem.on('click', async (e) => {
                    // Don't toggle if clicking the add icon
                    if ($(e.target).hasClass('add-icon')) {
                        return;
                    }
                    e.stopPropagation();
                    await this.toggleDirectory(dirItem, dirContents, currentPath, item.name, depth);
                });

                container.append(dirItem);
                container.append(dirContents);

            } else if (item.type === 'file') {
                // Get file extension for icon
                const extension = item.name.split('.').pop().toLowerCase();
                const fileIcon = this.getFileIcon(extension);

                // Check if this is package.json
                const isPackageJson = item.name === 'package.json';

                // Create file item with optional gear icon
                const gearIconHtml = isPackageJson ? '<span class="file-action-icon gear-icon" title="Run npm install">⚙️</span>' : '';
                const fileItem = $(`
                    <div class="file-tree-item file-tree-file" data-file-path="${currentPath}/${item.name}" data-file-name="${item.name}" data-depth="${depth}">
                        <span class="file-icon">${fileIcon}</span>
                        <span class="file-name">${item.name}</span>
                        ${gearIconHtml}
                    </div>
                `);

                // Apply padding based on depth
                fileItem.css('padding-left', `${depth * 16 + 8}px`);

                // Add click handler for gear icon if it's package.json
                if (isPackageJson) {
                    fileItem.find('.gear-icon').on('click', async (e) => {
                        e.stopPropagation();
                        await this.runNpmInstall(currentPath);
                    });
                }

                // Single click to select
                fileItem.on('click', (e) => {
                    e.stopPropagation();
                    this.onFileTreeItemSelected(fileItem, currentPath, item.name);
                });

                // Double click to open
                fileItem.on('dblclick', async (e) => {
                    e.stopPropagation();
                    await this.openFileInAce(currentPath, item.name);
                });

                container.append(fileItem);
            }
        });
    }

    getFileIcon(extension) {
        const iconMap = {
            'js': '📜',
            'json': '📋',
            'html': '🌐',
            'css': '🎨',
            'md': '📝',
            'txt': '📄',
            'png': '🖼️',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'gif': '🖼️',
            'svg': '🖼️',
            'pdf': '📕',
            'zip': '📦',
            'xml': '📰',
            'py': '🐍',
            'java': '☕',
            'cpp': '⚙️',
            'c': '⚙️',
            'h': '⚙️'
        };
        return iconMap[extension] || '📄';
    }

    async toggleDirectory(dirItem, dirContents, parentPath, dirName, depth) {
        const dirIcon = dirItem.find('.dir-icon');
        const isExpanded = dirContents.hasClass('expanded');

        if (isExpanded) {
            // Collapse directory
            dirIcon.text('▶');
            dirContents.removeClass('expanded');
        } else {
            // Expand directory
            dirIcon.text('▼');

            // Load directory contents if not already loaded
            if (dirContents.children().length === 0) {
                try {
                    const dirPath = `${parentPath}/${dirName}`;
                    const files = await this.ace.debuggerApiClient.listProjectFiles(dirPath);
                    this.renderFileTreeItems(files, dirPath, dirContents, depth + 1);
                } catch (error) {
                    this.logger.error('Failed to load directory:', error);
                    dirContents.html(`<div style="padding-left: ${(depth + 1) * 16 + 8}px; color: #f44; font-size: 11px;">Error loading directory</div>`);
                }
            }

            dirContents.addClass('expanded');
        }
    }

    onFileTreeItemSelected(fileItem, projectPath, fileName) {
        this.logger.info('File selected from tree:', fileName);

        // Remove selected class from all file items
        $('.file-tree-file').removeClass('selected');

        // Add selected class to clicked item
        fileItem.addClass('selected');

        // Store selected file
        this.ace.selectedFileForDebugging = `${projectPath}/${fileName}`;

        // Enable Connect button
        $('#connect-debugger-btn').prop('disabled', false);

        this.logger.info('Selected file for debugging:', this.ace.selectedFileForDebugging);
    }

    async openFileInAce(filePath, fileName) {
        this.logger.info('Opening file in ace:', filePath, fileName);

        try {
            const fullPath = `${filePath}/${fileName}`;

            // Check if file is already open - just switch to it
            // Only if openSessions exists (MDI is initialized)
            if (this.ace.openSessions && this.ace.openSessions.has(fullPath)) {
                this.logger.info('File already open, switching to it:', fullPath);
                this.ace.editorHelper.switchToFile(fullPath);

                // Enable debug button
                this.ace.selectedFileForDebugging = fullPath;
                $('#debug-start-btn').prop('disabled', false);
                $('#debug-filename').text(fileName);
                return;
            }

            // Fetch file content from server using the API client
            const content = await this.ace.debuggerApiClient.getFileContent(fullPath);

            // Open file with new session-based method if available, otherwise use old method
            if (this.ace.editor && this.ace.editorHelper && this.ace.editorHelper.openFile) {
                this.ace.editorHelper.openFile(fullPath, content);
                this.logger.info('File loaded into ace with new session:', fileName);
            } else if (this.ace.editor) {
                // Fallback to old method if MDI not available
                this.logger.info('Using fallback loadFile method');
                this.ace.editorHelper.loadFile(fullPath, content);
            } else {
                this.logger.warn('Ace editor not available yet');
            }

            // Enable debug button now that we have a file loaded
            this.ace.selectedFileForDebugging = fullPath;
            $('#debug-start-btn').prop('disabled', false);
            $('#debug-filename').text(fileName);

        } catch (error) {
            this.logger.error('Failed to load file:', error);
            alert(`Failed to open file: ${error.message}`);
        }
    }

    showServerOfflineError() {
        const errorHtml = `
            <div id="server-error-dialog" title="Server Not Available" style="display: none;">
                <div style="padding: 15px;">
                    <div class="error-message" style="background: #ffebee; border-left: 4px solid #f44336; padding: 12px; margin: 10px 0; border-radius: 4px; color: #c62828;">
                        <strong>⚠️ Cannot connect to debugger server</strong><br><br>
                        Please ensure the node-inspector-websocket-proxy server is running:<br><br>
                        <code style="background: #f5f5f5; padding: 8px; display: block; margin: 10px 0; font-family: monospace;">
                        cd ../node-inspector-websocket-proxy<br>
                        node server.js
                        </code><br>
                        Server should be running at: <code>http://localhost:8080</code>
                    </div>
                </div>
            </div>
        `;

        if (!$('#server-error-dialog').length) {
            $('body').append(errorHtml);
        }

        $('#server-error-dialog').dialog({
            modal: true,
            width: 500,
            buttons: {
                'Retry': () => {
                    $('#server-error-dialog').dialog('close');
                    this.showProjectDialog();
                },
                'Cancel': function() {
                    $(this).dialog('close');
                }
            }
        });
    }

    async runNpmInstall(projectPath) {
        this.logger.info('Running npm install for project:', projectPath);

        try {
            // Show a status notification
            const statusMsg = $('<div class="npm-install-status" style="position: fixed; bottom: 20px; right: 20px; background: #2196F3; color: white; padding: 12px 20px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 10001; font-size: 13px;">⚙️ Running npm install...</div>');
            $('body').append(statusMsg);

            // Call the API to run npm install
            const result = await this.ace.debuggerApiClient.runNpmInstall(projectPath);

            // Remove status message
            statusMsg.remove();

            if (result.success) {
                // Show success message
                const successMsg = $('<div class="npm-install-success" style="position: fixed; bottom: 20px; right: 20px; background: #4CAF50; color: white; padding: 12px 20px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 10001; font-size: 13px;">✓ npm install completed successfully!</div>');
                $('body').append(successMsg);
                setTimeout(() => successMsg.fadeOut(() => successMsg.remove()), 3000);

                this.logger.info('npm install completed successfully');
            } else {
                // Show error
                throw new Error(result.error || 'npm install failed');
            }

        } catch (error) {
            this.logger.error('npm install failed:', error);

            // Remove any existing status messages
            $('.npm-install-status').remove();

            // Show error message
            const errorMsg = $(`<div class="npm-install-error" style="position: fixed; bottom: 20px; right: 20px; background: #f44336; color: white; padding: 12px 20px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 10001; font-size: 13px; max-width: 400px;">⚠️ npm install failed: ${error.message}</div>`);
            $('body').append(errorMsg);
            setTimeout(() => errorMsg.fadeOut(() => errorMsg.remove()), 5000);
        }
    }

    async showCreateItemDialog(directoryPath, dirItem, dirContents, depth) {
        this.logger.info('Showing create item dialog for:', directoryPath);

        return new Promise((resolve) => {
            // Create dialog HTML
            const dialogHtml = `
                <div id="create-item-dialog" title="Create New Item" style="display: none;">
                    <div style="padding: 15px;">
                        <p style="margin-bottom: 15px;">What would you like to create in <strong>${directoryPath.split('/').pop()}</strong>?</p>
                        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                            <button id="create-file-btn" style="flex: 1; padding: 15px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">
                                📄 New File
                            </button>
                            <button id="create-folder-btn" style="flex: 1; padding: 15px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">
                                📁 New Folder
                            </button>
                        </div>
                        <input type="text" id="new-item-name" placeholder="Enter name..." style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;">
                    </div>
                </div>
            `;

            // Remove existing dialog if present
            $('#create-item-dialog').remove();

            // Add to DOM
            $('body').append(dialogHtml);

            let itemType = null;

            // Button handlers
            $('#create-file-btn').on('click', () => {
                itemType = 'file';
                $('#create-file-btn').css('background', '#1976D2');
                $('#create-folder-btn').css('background', '#4CAF50');
                $('#new-item-name').focus();
            });

            $('#create-folder-btn').on('click', () => {
                itemType = 'folder';
                $('#create-folder-btn').css('background', '#388E3C');
                $('#create-file-btn').css('background', '#2196F3');
                $('#new-item-name').focus();
            });

            // Show dialog
            $('#create-item-dialog').dialog({
                modal: true,
                width: 400,
                buttons: {
                    'Create': async () => {
                        const itemName = $('#new-item-name').val().trim();

                        if (!itemName) {
                            alert('Please enter a name');
                            return;
                        }

                        if (!itemType) {
                            alert('Please select File or Folder');
                            return;
                        }

                        // Validate name
                        if (!/^[a-zA-Z0-9_.-]+$/.test(itemName)) {
                            alert('Invalid name. Use only letters, numbers, dots, hyphens, and underscores.');
                            return;
                        }

                        $('#create-item-dialog').dialog('close');

                        try {
                            await this.createItem(directoryPath, itemName, itemType, dirItem, dirContents, depth);
                            resolve();
                        } catch (error) {
                            this.logger.error('Failed to create item:', error);
                            alert(`Failed to create ${itemType}: ${error.message}`);
                        }
                    },
                    'Cancel': function() {
                        $(this).dialog('close');
                        resolve();
                    }
                },
                close: function() {
                    $(this).remove();
                }
            });

            // Focus input
            $('#new-item-name').focus();

            // Handle Enter key
            $('#new-item-name').on('keypress', (e) => {
                if (e.which === 13) {
                    $(".ui-dialog-buttonpane button:contains('Create')").click();
                }
            });
        });
    }

    async createItem(directoryPath, itemName, itemType, dirItem, dirContents, depth) {
        this.logger.info(`Creating ${itemType}:`, itemName, 'in', directoryPath);

        const fullPath = `${directoryPath}/${itemName}`;

        try {
            if (itemType === 'file') {
                // Create empty file by saving empty content
                await this.ace.debuggerApiClient.saveFile(fullPath, '');
                this.logger.info('File created:', fullPath);
            } else {
                // Create folder via API (we need to add this endpoint)
                await this.ace.debuggerApiClient.createDirectory(fullPath);
                this.logger.info('Folder created:', fullPath);
            }

            // Refresh the directory contents
            await this.refreshDirectory(dirItem, dirContents, directoryPath, depth);

            // Show success message
            const successMsg = $(`<div style="position: fixed; bottom: 20px; right: 20px; background: #4CAF50; color: white; padding: 12px 20px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 10001; font-size: 13px;">✓ ${itemType === 'file' ? 'File' : 'Folder'} created successfully!</div>`);
            $('body').append(successMsg);
            setTimeout(() => successMsg.fadeOut(() => successMsg.remove()), 3000);

        } catch (error) {
            this.logger.error('Failed to create item:', error);
            throw error;
        }
    }

    async refreshDirectory(dirItem, dirContents, directoryPath, depth) {
        this.logger.info('Refreshing directory:', directoryPath);

        try {
            // Clear current contents
            dirContents.empty();

            // Reload directory contents
            const files = await this.ace.debuggerApiClient.listProjectFiles(directoryPath);
            this.renderFileTreeItems(files, directoryPath, dirContents, depth + 1);

            // Ensure directory is expanded
            const dirIcon = dirItem.find('.dir-icon');
            dirIcon.text('▼');
            dirContents.addClass('expanded');

        } catch (error) {
            this.logger.error('Failed to refresh directory:', error);
            throw error;
        }
    }
}
