/**
 * ProjectUI - Handles all UI and dialog rendering for project management
 *
 * This module is responsible for creating and managing all project-related
 * dialogs including project selection, file picking, demo project selection,
 * and error displays.
 *
 * @class ProjectUI
 */
class ProjectUI {
    /**
     * Creates a new ProjectUI instance
     * @param {Logger} logger - Logger instance for debugging
     */
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Build the HTML for the project selection dialog
     * @returns {string} HTML string for the dialog
     */
    buildProjectDialogHtml() {
        return `
            <div id="project-dialog" title="Select or Create Project" style="display: none;">
                <div style="padding: 15px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold; font-size: 13px; color: var(--color-text-primary);">Projects:</label>
                    <div id="project-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--color-border-default); border-radius: 4px; padding: 10px; margin-bottom: 15px; background: var(--color-bg-secondary);">
                        <div class="loading-spinner" style="color: var(--color-text-secondary);">
                            Loading workspace contents...
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <button id="create-new-btn" style="flex: 1; padding: 10px; background: var(--color-status-success); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">
                            📁 Create New
                        </button>
                        <button id="create-demo-btn" style="flex: 1; padding: 10px; background: var(--color-status-info); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">
                            📋 Copy Demo
                        </button>
                        <button id="import-project-btn" style="flex: 1; padding: 10px; background: var(--color-status-warning); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">
                            📥 Import
                        </button>
                    </div>

                    <div id="selected-project-info" style="padding: 15px; background: var(--color-bg-tertiary); border: 2px solid var(--color-border-default); border-radius: 6px; font-size: 13px; display: none;">
                        <div style="display: flex; align-items: flex-start; gap: 15px;">
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">
                                    <span id="selected-project-name" style="font-family: var(--font-family-mono); color: var(--color-text-primary);"></span>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
                                    <div id="selected-project-version" style="color: var(--color-text-muted); font-size: 12px; display: none;"></div>
                                    <div id="selected-project-author" style="color: var(--color-text-muted); font-size: 12px; display: none;"></div>
                                    <div id="selected-project-platform" style="color: var(--color-text-muted); font-size: 12px; display: none;"></div>
                                    <div id="selected-project-license" style="color: var(--color-text-muted); font-size: 12px; display: none;"></div>
                                    <div id="selected-project-modified" style="color: var(--color-text-muted); font-size: 12px; display: none;"></div>
                                </div>
                                <div id="selected-project-description" style="color: var(--color-text-secondary); font-size: 12px; line-height: 1.4; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--color-border-subtle); display: none;"></div>
                            </div>
                            <div id="selected-project-icon" style="flex-shrink: 0; width: 64px; height: 64px; display: none;">
                                <img src="" alt="Project icon" style="width: 100%; height: 100%; object-fit: contain; border-radius: 4px;">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Show new project creation dialog
     * @returns {Promise<Object|null>} Project info object or null if cancelled
     */
    async showNewProjectDialog() {
        return new Promise((resolve) => {
            const dialogHtml = `
                <div id="new-project-dialog" title="Create New Project" style="display: none;">
                    <div style="padding: 15px;">
                        <form id="new-project-form" style="display: flex; flex-direction: column; gap: 15px;">
                            <div>
                                <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px; color: var(--color-text-primary);">
                                    Project Name <span style="color: var(--color-status-error);">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="new-project-name"
                                    placeholder="my-project"
                                    required
                                    pattern="[a-zA-Z0-9_-]+"
                                    style="width: 100%; padding: 8px; background: var(--color-bg-secondary); color: var(--color-text-primary); border: 1px solid var(--color-border-default); border-radius: 4px; font-family: var(--font-family-mono); font-size: 13px;"
                                />
                                <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 4px;">
                                    Letters, numbers, hyphens, and underscores only
                                </div>
                            </div>

                            <div>
                                <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px; color: var(--color-text-primary);">
                                    Description
                                </label>
                                <textarea
                                    id="new-project-description"
                                    placeholder="A brief description of your project"
                                    rows="2"
                                    style="width: 100%; padding: 8px; background: var(--color-bg-secondary); color: var(--color-text-primary); border: 1px solid var(--color-border-default); border-radius: 4px; font-family: var(--font-family-base); font-size: 13px; resize: vertical;"
                                ></textarea>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div>
                                    <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px; color: var(--color-text-primary);">
                                        Author
                                    </label>
                                    <input
                                        type="text"
                                        id="new-project-author"
                                        placeholder="Your Name"
                                        style="width: 100%; padding: 8px; background: var(--color-bg-secondary); color: var(--color-text-primary); border: 1px solid var(--color-border-default); border-radius: 4px; font-size: 13px;"
                                    />
                                </div>

                                <div>
                                    <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px; color: var(--color-text-primary);">
                                        Version
                                    </label>
                                    <input
                                        type="text"
                                        id="new-project-version"
                                        value="1.0.0"
                                        style="width: 100%; padding: 8px; background: var(--color-bg-secondary); color: var(--color-text-primary); border: 1px solid var(--color-border-default); border-radius: 4px; font-family: var(--font-family-mono); font-size: 13px;"
                                    />
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div>
                                    <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px; color: var(--color-text-primary);">
                                        Platform
                                    </label>
                                    <select
                                        id="new-project-platform"
                                        style="width: 100%; padding: 8px; background: var(--color-bg-secondary); color: var(--color-text-primary); border: 1px solid var(--color-border-default); border-radius: 4px; font-size: 13px;"
                                    >
                                        <option value="">Select platform...</option>
                                        <option value="RPI">Raspberry Pi</option>
                                        <option value="ESP32">ESP32</option>
                                        <option value="ESP8266">ESP8266</option>
                                        <option value="ATmega">ATmega (Arduino)</option>
                                        <option value="ATtiny">ATtiny</option>
                                        <option value="STM32">STM32</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px; color: var(--color-text-primary);">
                                        License
                                    </label>
                                    <select
                                        id="new-project-license"
                                        style="width: 100%; padding: 8px; background: var(--color-bg-secondary); color: var(--color-text-primary); border: 1px solid var(--color-border-default); border-radius: 4px; font-size: 13px;"
                                    >
                                        <option value="">Select license...</option>
                                        <option value="MIT">MIT</option>
                                        <option value="Apache-2.0">Apache 2.0</option>
                                        <option value="GPL-3.0">GPL-3.0</option>
                                        <option value="BSD-3-Clause">BSD 3-Clause</option>
                                        <option value="ISC">ISC</option>
                                        <option value="Unlicense">Unlicense</option>
                                        <option value="Proprietary">Proprietary</option>
                                    </select>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            `;

            $('#new-project-dialog').remove();
            $('body').append(dialogHtml);

            $('#new-project-dialog').dialog({
                modal: true,
                width: 600,
                position: { my: "center", at: "center top+80", of: window },
                closeOnEscape: true,
                buttons: {
                    'Create': function() {
                        const name = $('#new-project-name').val().trim();

                        // Validate project name
                        if (!name) {
                            alert('Project name is required');
                            return;
                        }

                        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
                            alert('Invalid project name. Please use only letters, numbers, hyphens, and underscores.');
                            return;
                        }

                        const projectInfo = {
                            name: name,
                            description: $('#new-project-description').val().trim(),
                            author: $('#new-project-author').val().trim(),
                            version: $('#new-project-version').val().trim() || '1.0.0',
                            platform: $('#new-project-platform').val(),
                            license: $('#new-project-license').val()
                        };

                        $(this).dialog('close');
                        resolve(projectInfo);
                    },
                    'Cancel': function() {
                        $(this).dialog('close');
                        resolve(null);
                    }
                },
                close: function() {
                    $(this).remove();
                }
            });

            // Focus on name field
            setTimeout(() => $('#new-project-name').focus(), 100);

            // Handle Enter key in name field
            $('#new-project-name').on('keypress', function(e) {
                if (e.which === 13) { // Enter key
                    e.preventDefault();
                    $('.ui-dialog-buttonpane button:contains("Create")').click();
                }
            });
        });
    }

    /**
     * Show error dialog when server is offline
     * @param {Function} retryCallback - Function to call when user clicks Retry
     */
    showServerOfflineError(retryCallback) {
        const errorHtml = `
            <div id="server-error-dialog" title="Server Not Available" style="display: none;">
                <div style="padding: 15px;">
                    <div class="error-message" style="background: var(--color-bg-tertiary); border-left: 4px solid var(--color-status-error); padding: 12px; margin: 10px 0; border-radius: 4px; color: var(--color-status-error);">
                        <strong>⚠️ Cannot connect to debugger server</strong><br><br>
                        <span style="color: var(--color-text-primary);">Please ensure the node-inspector-websocket-proxy server is running:</span><br><br>
                        <code style="background: var(--color-bg-secondary); color: var(--color-text-primary); padding: 8px; display: block; margin: 10px 0; font-family: var(--font-family-mono); border: 1px solid var(--color-border-default); border-radius: 4px;">
                        cd ../node-inspector-websocket-proxy<br>
                        node server.js
                        </code><br>
                        <span style="color: var(--color-text-primary);">Server should be running at: <code style="background: var(--color-bg-secondary); padding: 2px 6px; border-radius: 3px; color: var(--brand-accent);">http://localhost:8080</code></span>
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
            position: { my: "center", at: "center top+80", of: window },
            buttons: {
                'Retry': () => {
                    $('#server-error-dialog').dialog('close');
                    if (retryCallback) retryCallback();
                },
                'Cancel': function() {
                    $(this).dialog('close');
                }
            }
        });
    }

    /**
     * Render workspace items in the project list container
     * @param {Array} items - Array of workspace items
     * @param {Function} onItemClick - Callback when item is clicked (item, element, packageInfo)
     * @param {Function} onItemDelete - Callback when delete button is clicked (item, element)
     */
    async renderWorkspaceItems(items, onItemClick, onItemDelete = null) {
        const projectListContainer = $('#project-list');
        projectListContainer.empty();

        if (items.length === 0) {
            this.showEmptyProjectState();
            return;
        }

        // Sort items: directories first, then files
        const sortedItems = items.sort((a, b) => {
            if (a.type === b.type) {
                return a.name.localeCompare(b.name);
            }
            return a.type === 'directory' ? -1 : 1;
        });

        // Add each item as a selectable item
        for (const item of sortedItems) {
            const icon = item.type === 'directory' ? '📁' : '📄';
            const itemType = item.type === 'directory' ? 'folder' : 'file';

            // For directories, try to read package.json
            let packageInfo = null;
            if (item.type === 'directory') {
                packageInfo = await this.readPackageJson(item.name);
            }

            // Build metadata display (just show file size for files)
            let metaHtml = '';
            if (item.type === 'file') {
                metaHtml = `<div class="project-item-path" style="font-size: 11px; color: #666;">(${this.formatFileSize(item.size)})</div>`;
            }

            const workspaceItem = $(`
                <div class="project-item ${itemType}" data-item-path="/${item.name}" data-item-type="${item.type}">
                    <span style="margin-right: 8px;">${icon}</span>
                    <div style="flex: 1;">
                        <div class="project-item-name">${item.name}</div>
                        <div class="project-item-path" style="font-size: 11px; color: #666;">/${item.name}</div>
                        ${metaHtml}
                    </div>
                    ${onItemDelete ? `
                        <button class="project-item-delete" title="Delete ${item.name}" style="
                            padding: 4px 8px;
                            background: var(--color-status-error);
                            color: white;
                            border: none;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 11px;
                            margin-left: 8px;
                            opacity: 0.7;
                            transition: opacity 0.2s;
                        ">
                            🗑️ Delete
                        </button>
                    ` : ''}
                </div>
            `);

            workspaceItem.on('click', (e) => {
                // Don't trigger if clicking the delete button
                if ($(e.target).hasClass('project-item-delete') || $(e.target).closest('.project-item-delete').length) {
                    return;
                }
                onItemClick(item, workspaceItem, packageInfo);
            });

            // Bind delete button if callback provided
            if (onItemDelete) {
                workspaceItem.find('.project-item-delete').on('click', (e) => {
                    e.stopPropagation();
                    onItemDelete(item, workspaceItem);
                });

                // Show delete button on hover
                workspaceItem.on('mouseenter', function() {
                    $(this).find('.project-item-delete').css('opacity', '1');
                });
                workspaceItem.on('mouseleave', function() {
                    $(this).find('.project-item-delete').css('opacity', '0.7');
                });
            }

            projectListContainer.append(workspaceItem);
        }
    }

    /**
     * Read package.json from a project directory
     * @param {string} projectName - Name of the project directory
     * @returns {Promise<Object|null>} Package.json content or null if not found
     */
    async readPackageJson(projectName) {
        try {
            const response = await fetch(`/workspace/${projectName}/package.json`);
            if (!response.ok) {
                return null;
            }
            const packageJson = await response.json();
            return packageJson;
        } catch (error) {
            this.logger?.debug?.(`Could not read package.json for ${projectName}:`, error);
            return null;
        }
    }

    /**
     * Show empty state when no projects exist
     */
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

    /**
     * Show loading spinner in project list
     */
    showLoadingState() {
        $('#project-list').html('<div class="loading-spinner">Loading workspace contents...</div>');
    }

    /**
     * Show error in project list
     * @param {string} errorMessage - Error message to display
     */
    showErrorState(errorMessage) {
        $('#project-list').html(`
            <div class="error-message">
                Failed to load workspace: ${errorMessage}
            </div>
        `);
    }

    /**
     * Update the selected project info display
     * @param {string} itemName - Name of the selected item
     * @param {string} itemType - Type of the item ('directory' or 'file')
     * @param {Object} packageInfo - Package.json data (optional)
     */
    updateSelectedInfo(itemName, itemType, packageInfo = null, itemMetadata = null) {
        this.logger?.debug?.('updateSelectedInfo:', itemName, itemType, packageInfo, itemMetadata);
        $('#selected-project-info').show();

        // Update name
        const displayText = itemType === 'directory' ? `📁 ${itemName}` : `📄 ${itemName}`;
        $('#selected-project-name').text(displayText);

        // Show/hide and update icon
        if (packageInfo && packageInfo.icon) {
            this.logger?.debug?.('Showing icon:', packageInfo.icon);
            $('#selected-project-icon').show();
            $('#selected-project-icon img').attr('src', packageInfo.icon);
        } else {
            this.logger?.debug?.('No icon in package info, hiding icon');
            $('#selected-project-icon').hide();
        }

        // Show/hide and update version
        if (packageInfo && packageInfo.version) {
            $('#selected-project-version').show().text(`Version: ${packageInfo.version}`);
        } else {
            $('#selected-project-version').hide();
        }

        // Show/hide and update author
        if (packageInfo && packageInfo.author) {
            const authorText = typeof packageInfo.author === 'string'
                ? packageInfo.author
                : packageInfo.author.name || JSON.stringify(packageInfo.author);
            $('#selected-project-author').show().text(`Author: ${authorText}`);
        } else {
            $('#selected-project-author').hide();
        }

        // Show/hide and update platform
        if (packageInfo && packageInfo.platform) {
            $('#selected-project-platform').show().text(`Platform: ${packageInfo.platform}`);
        } else {
            $('#selected-project-platform').hide();
        }

        // Show/hide and update license
        if (packageInfo && packageInfo.license) {
            $('#selected-project-license').show().text(`License: ${packageInfo.license}`);
        } else {
            $('#selected-project-license').hide();
        }

        // Show/hide and update modified date
        if (itemMetadata && itemMetadata.modified) {
            const modifiedDate = new Date(itemMetadata.modified);
            const formattedDate = modifiedDate.toLocaleDateString() + ' ' + modifiedDate.toLocaleTimeString();
            $('#selected-project-modified').show().text(`Modified: ${formattedDate}`);
        } else {
            $('#selected-project-modified').hide();
        }

        // Show/hide and update description
        if (packageInfo && packageInfo.description) {
            $('#selected-project-description').show().text(packageInfo.description);
        } else {
            $('#selected-project-description').hide();
        }
    }

    /**
     * Show file picker dialog for selecting entry point
     * @param {Array} jsFiles - Array of JavaScript file objects
     * @returns {Promise<string>} Selected file name
     */
    async showFilePicker(jsFiles) {
        return new Promise((resolve, reject) => {
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
                position: { my: "center", at: "center top+80", of: window },
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

    /**
     * Show demo project selection dialog
     * @param {Array} projects - Array of demo project objects {name, description}
     * @param {Function} onCopyProject - Callback when project is copied (projectName)
     * @returns {Promise<void>}
     */
    async showDemoProjectSelectionDialog(projects, onCopyProject) {
        return new Promise((resolve) => {
            const dialogHtml = `
                <div id="demo-project-dialog" title="Select Demo Project" style="display: none;">
                    <div style="padding: 15px;">
                        <p style="margin-bottom: 15px; color: var(--color-text-primary);">Select an example project to copy to your workspace:</p>
                        <div id="demo-project-list" style="max-height: 300px; overflow-y: auto;">
                            ${projects.map(p => `
                                <div class="demo-project-item" data-name="${p.name}" style="padding: 12px; margin: 8px 0; background: var(--color-bg-tertiary); border: 2px solid var(--color-border-default); border-radius: 4px; cursor: pointer; transition: all 0.2s ease;">
                                    <div style="font-weight: bold; font-size: 14px; color: var(--color-text-primary);">${p.name}</div>
                                    <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 4px;">${p.description || 'No description'}</div>
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
                $('.demo-project-item').css({
                    'background': 'var(--color-bg-tertiary)',
                    'border-color': 'var(--color-border-default)'
                });
                $(this).css({
                    'background': 'var(--color-bg-active)',
                    'border-color': 'var(--brand-accent)'
                });
                selectedProject = $(this).data('name');
            });

            $('#demo-project-dialog').dialog({
                modal: true,
                width: 450,
                position: { my: "center", at: "center top+80", of: window },
                buttons: {
                    'Copy to Workspace': async () => {
                        if (!selectedProject) {
                            alert('Please select a project');
                            return;
                        }

                        $('#demo-project-dialog').dialog('close');
                        await onCopyProject(selectedProject);
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

    /**
     * Show create item dialog (file or folder)
     * @param {string} directoryPath - Path where item will be created
     * @param {Function} onCreateItem - Callback when item is created (itemName, itemType)
     * @returns {Promise<void>}
     */
    async showCreateItemDialog(directoryPath, onCreateItem) {
        return new Promise((resolve) => {
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

            $('#create-item-dialog').remove();
            $('body').append(dialogHtml);

            let itemType = null;

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

            $('#create-item-dialog').dialog({
                modal: true,
                width: 400,
                position: { my: "center", at: "center top+80", of: window },
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

                        if (!/^[a-zA-Z0-9_.-]+$/.test(itemName)) {
                            alert('Invalid name. Use only letters, numbers, dots, hyphens, and underscores.');
                            return;
                        }

                        $('#create-item-dialog').dialog('close');
                        await onCreateItem(itemName, itemType);
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

            $('#new-item-name').focus();

            $('#new-item-name').on('keypress', (e) => {
                if (e.which === 13) {
                    $(".ui-dialog-buttonpane button:contains('Create')").click();
                }
            });
        });
    }

    /**
     * Show a temporary notification message
     * @param {string} message - Message to display
     * @param {string} type - Type of message: 'success', 'error', 'info'
     * @param {number} duration - Duration in ms (default 3000)
     */
    showNotification(message, type = 'info', duration = 3000) {
        const bgColors = {
            success: 'var(--color-status-success)',
            error: 'var(--color-status-error)',
            info: 'var(--color-status-info)',
            warning: 'var(--color-status-warning)'
        };

        const notification = $(`
            <div class="notification-toast notification-${type}" style="position: fixed; bottom: 20px; right: 20px; background: ${bgColors[type]}; color: white; padding: 14px 20px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); z-index: 10001; font-size: 13px; max-width: 400px; font-weight: 500;">
                ${message}
            </div>
        `);

        $('body').append(notification);

        // Slide in animation
        notification.css({ opacity: 0, transform: 'translateX(20px)' });
        notification.animate({ opacity: 1 }, {
            duration: 200,
            step: function(now) {
                $(this).css('transform', `translateX(${20 - (now * 20)}px)`);
            }
        });

        setTimeout(() => {
            notification.fadeOut(300, () => notification.remove());
        }, duration);
    }

    /**
     * Format file size for display
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size string
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}