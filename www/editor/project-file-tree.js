/**
 * ProjectFileTree - Manages the file tree display and interactions
 *
 * This module handles rendering the project file tree, managing expand/collapse
 * state, and coordinating file/folder operations with the API.
 *
 * @class ProjectFileTree
 */
class ProjectFileTree {
    /**
     * Creates a new ProjectFileTree instance
     * @param {ProjectAPI} projectAPI - API instance for file operations
     * @param {ProjectUI} projectUI - UI instance for dialogs
     * @param {Logger} logger - Logger instance for debugging
     */
    constructor(projectAPI, projectUI, logger) {
        this.api = projectAPI;
        this.ui = projectUI;
        this.logger = logger;
        this.onFileOpenCallback = null;
        this.onFileSelectCallback = null;
    }

    /**
     * Set callback for when a file is opened
     * @param {Function} callback - Function(filePath, content) to call when file is opened
     */
    setOnFileOpenCallback(callback) {
        this.onFileOpenCallback = callback;
    }

    /**
     * Set callback for when a file is selected
     * @param {Function} callback - Function(filePath) to call when file is selected
     */
    setOnFileSelectCallback(callback) {
        this.onFileSelectCallback = callback;
    }

    /**
     * Load and render project files into the tree
     * @param {string} projectPath - Path to the project
     * @returns {Promise<void>}
     */
    async loadProjectFilesIntoTree(projectPath) {
        this.logger.info('Loading files into tree for:', projectPath);

        try {
            const files = await this.api.listProjectFiles(projectPath);
            this.logger.info('Files loaded:', files);

            const fileTree = $('#file-tree');
            fileTree.empty();

            if (files.length === 0) {
                fileTree.html('<div class="file-tree-placeholder">No files found in project</div>');
                return;
            }

            // Extract project name from path
            const projectName = projectPath.split('/').filter(p => p).pop() || projectPath;

            // Create root project folder item
            const projectRoot = $(`
                <div class="file-tree-item file-tree-directory file-tree-root" data-dir-path="${projectPath}" data-depth="0">
                    <span class="file-icon dir-icon">▼</span>
                    <span class="file-icon">📁</span>
                    <span class="file-name">${projectName}</span>
                    <span class="file-action-icon add-icon" title="Create new file or folder">➕</span>
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

            // Add icon click handler for root
            projectRoot.find('.add-icon').on('click', async (e) => {
                e.stopPropagation();
                await this.handleCreateItem(projectPath, projectRoot, projectContents, 0);
            });

            // Make root collapsible
            projectRoot.on('click', async (e) => {
                // Don't collapse if clicking the add icon
                if ($(e.target).hasClass('add-icon')) {
                    return;
                }
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

    /**
     * Render file tree items recursively
     * @param {Array} items - Array of file/directory objects
     * @param {string} currentPath - Current directory path
     * @param {jQuery} container - Container element to append items to
     * @param {number} depth - Current nesting depth
     */
    renderFileTreeItems(items, currentPath, container, depth) {
        // Sort items: directories first, then files, alphabetically
        const sortedItems = items.sort((a, b) => {
            if (a.type === 'directory' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
        });

        sortedItems.forEach(item => {
            if (item.type === 'directory') {
                this.renderDirectoryItem(item, currentPath, container, depth);
            } else if (item.type === 'file') {
                this.renderFileItem(item, currentPath, container, depth);
            }
        });
    }

    /**
     * Render a directory item in the file tree
     * @param {Object} item - Directory object
     * @param {string} currentPath - Current directory path
     * @param {jQuery} container - Container element
     * @param {number} depth - Nesting depth
     */
    renderDirectoryItem(item, currentPath, container, depth) {
        const dirItem = $(`
            <div class="file-tree-item file-tree-directory" data-dir-path="${currentPath}/${item.name}" data-depth="${depth}">
                <span class="file-icon dir-icon">▶</span>
                <span class="file-icon">📁</span>
                <span class="file-name">${item.name}</span>
                <span class="file-action-icon add-icon" title="Create new file or folder">➕</span>
            </div>
        `);

        dirItem.css('padding-left', `${depth * 16 + 8}px`);

        const dirContents = $(`
            <div class="file-tree-directory-contents"></div>
        `);

        // Add icon click handler
        dirItem.find('.add-icon').on('click', async (e) => {
            e.stopPropagation();
            await this.handleCreateItem(`${currentPath}/${item.name}`, dirItem, dirContents, depth);
        });

        // Directory click handler
        dirItem.on('click', async (e) => {
            if ($(e.target).hasClass('add-icon')) {
                return;
            }
            e.stopPropagation();
            await this.toggleDirectory(dirItem, dirContents, currentPath, item.name, depth);
        });

        container.append(dirItem);
        container.append(dirContents);
    }

    /**
     * Render a file item in the file tree
     * @param {Object} item - File object
     * @param {string} currentPath - Current directory path
     * @param {jQuery} container - Container element
     * @param {number} depth - Nesting depth
     */
    renderFileItem(item, currentPath, container, depth) {
        const extension = item.name.split('.').pop().toLowerCase();
        const fileIcon = this.getFileIcon(extension);
        const isPackageJson = item.name === 'package.json';

        const gearIconHtml = isPackageJson ? '<span class="file-action-icon gear-icon" title="Run npm install">⚙️</span>' : '';
        const fileItem = $(`
            <div class="file-tree-item file-tree-file" data-file-path="${currentPath}/${item.name}" data-file-name="${item.name}" data-depth="${depth}">
                <span class="file-icon">${fileIcon}</span>
                <span class="file-name">${item.name}</span>
                ${gearIconHtml}
            </div>
        `);

        fileItem.css('padding-left', `${depth * 16 + 8}px`);

        // Gear icon handler for package.json
        if (isPackageJson) {
            fileItem.find('.gear-icon').on('click', async (e) => {
                e.stopPropagation();
                await this.handleNpmInstall(currentPath);
            });
        }

        // Single click to select
        fileItem.on('click', (e) => {
            e.stopPropagation();
            this.handleFileSelect(fileItem, currentPath, item.name);
        });

        // Double click to open
        fileItem.on('dblclick', async (e) => {
            e.stopPropagation();
            await this.handleFileOpen(currentPath, item.name);
        });

        container.append(fileItem);
    }

    /**
     * Get icon for file based on extension
     * @param {string} extension - File extension
     * @returns {string} Icon emoji
     */
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

    /**
     * Toggle directory expansion state
     * @param {jQuery} dirItem - Directory item element
     * @param {jQuery} dirContents - Directory contents container
     * @param {string} parentPath - Parent directory path
     * @param {string} dirName - Directory name
     * @param {number} depth - Current depth
     */
    async toggleDirectory(dirItem, dirContents, parentPath, dirName, depth) {
        const dirIcon = dirItem.find('.dir-icon');
        const isExpanded = dirContents.hasClass('expanded');

        if (isExpanded) {
            // Collapse
            dirIcon.text('▶');
            dirContents.removeClass('expanded');
        } else {
            // Expand
            dirIcon.text('▼');

            // Load contents if not already loaded
            if (dirContents.children().length === 0) {
                try {
                    const dirPath = `${parentPath}/${dirName}`;
                    const files = await this.api.listProjectFiles(dirPath);
                    this.renderFileTreeItems(files, dirPath, dirContents, depth + 1);
                } catch (error) {
                    this.logger.error('Failed to load directory:', error);
                    dirContents.html(`<div style="padding-left: ${(depth + 1) * 16 + 8}px; color: #f44; font-size: 11px;">Error loading directory</div>`);
                }
            }

            dirContents.addClass('expanded');
        }
    }

    /**
     * Handle file selection (single click)
     * @param {jQuery} fileItem - File item element
     * @param {string} projectPath - Project path
     * @param {string} fileName - File name
     */
    handleFileSelect(fileItem, projectPath, fileName) {
        this.logger.info('File selected from tree:', fileName);

        // Remove selected class from all files
        $('.file-tree-file').removeClass('selected');

        // Add selected class
        fileItem.addClass('selected');

        // Notify callback
        const fullPath = `${projectPath}/${fileName}`;
        if (this.onFileSelectCallback) {
            this.onFileSelectCallback(fullPath);
        }
    }

    /**
     * Handle file opening (double click)
     * @param {string} filePath - Directory path
     * @param {string} fileName - File name
     */
    async handleFileOpen(filePath, fileName) {
        this.logger.info('Opening file:', filePath, fileName);

        try {
            const fullPath = `${filePath}/${fileName}`;
            const content = await this.api.getFileContent(fullPath);

            // Notify callback
            if (this.onFileOpenCallback) {
                this.onFileOpenCallback(fullPath, content, fileName);
            }

        } catch (error) {
            this.logger.error('Failed to load file:', error);
            alert(`Failed to open file: ${error.message}`);
        }
    }

    /**
     * Handle npm install request
     * @param {string} projectPath - Project path
     */
    async handleNpmInstall(projectPath) {
        this.logger.info('Running npm install for project:', projectPath);

        try {
            this.ui.showNotification('⚙️ Running npm install...', 'info');

            const result = await this.api.runNpmInstall(projectPath);

            if (result.success) {
                this.ui.showNotification('✓ npm install completed successfully!', 'success');
                this.logger.info('npm install completed successfully');
            } else {
                throw new Error(result.error || 'npm install failed');
            }

        } catch (error) {
            this.logger.error('npm install failed:', error);
            this.ui.showNotification(`⚠️ npm install failed: ${error.message}`, 'error', 5000);
        }
    }

    /**
     * Handle create item request (file or folder)
     * @param {string} directoryPath - Directory where item will be created
     * @param {jQuery} dirItem - Directory item element
     * @param {jQuery} dirContents - Directory contents container
     * @param {number} depth - Current depth
     */
    async handleCreateItem(directoryPath, dirItem, dirContents, depth) {
        this.logger.info('Showing create item dialog for:', directoryPath);

        try {
            await this.ui.showCreateItemDialog(directoryPath, async (itemName, itemType) => {
                await this.createItem(directoryPath, itemName, itemType, dirItem, dirContents, depth);
            });
        } catch (error) {
            this.logger.error('Error in create item flow:', error);
        }
    }

    /**
     * Create a new file or folder
     * @param {string} directoryPath - Parent directory path
     * @param {string} itemName - Name of new item
     * @param {string} itemType - Type: 'file' or 'folder'
     * @param {jQuery} dirItem - Parent directory item element
     * @param {jQuery} dirContents - Parent directory contents container
     * @param {number} depth - Current depth
     */
    async createItem(directoryPath, itemName, itemType, dirItem, dirContents, depth) {
        this.logger.info(`Creating ${itemType}:`, itemName, 'in', directoryPath);

        const fullPath = `${directoryPath}/${itemName}`;

        try {
            if (itemType === 'file') {
                await this.api.saveFile(fullPath, '');
                this.logger.info('File created:', fullPath);
            } else {
                await this.api.createDirectory(fullPath);
                this.logger.info('Folder created:', fullPath);
            }

            // Refresh directory
            await this.refreshDirectory(dirItem, dirContents, directoryPath, depth);

            // Show success
            this.ui.showNotification(`✓ ${itemType === 'file' ? 'File' : 'Folder'} created successfully!`, 'success');

        } catch (error) {
            this.logger.error('Failed to create item:', error);
            throw error;
        }
    }

    /**
     * Refresh a directory's contents
     * @param {jQuery} dirItem - Directory item element
     * @param {jQuery} dirContents - Directory contents container
     * @param {string} directoryPath - Directory path
     * @param {number} depth - Current depth
     */
    async refreshDirectory(dirItem, dirContents, directoryPath, depth) {
        this.logger.info('Refreshing directory:', directoryPath);

        try {
            // Clear current contents
            dirContents.empty();

            // Reload directory contents
            const files = await this.api.listProjectFiles(directoryPath);
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