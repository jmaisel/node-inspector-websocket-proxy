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

    /**
     * Show error dialog when server is offline
     * @param {Function} retryCallback - Function to call when user clicks Retry
     */
    showServerOfflineError(retryCallback) {
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
     * @param {Function} onItemClick - Callback when item is clicked (item, element)
     */
    renderWorkspaceItems(items, onItemClick) {
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
                onItemClick(item, workspaceItem);
            });

            projectListContainer.append(workspaceItem);
        });
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
     */
    updateSelectedInfo(itemName, itemType) {
        $('#selected-project-info').show();
        const displayText = itemType === 'directory' ? `📁 ${itemName}` : `📄 ${itemName}`;
        $('#selected-project-name').text(displayText);
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
            success: '#4CAF50',
            error: '#f44336',
            info: '#2196F3'
        };

        const notification = $(`
            <div style="position: fixed; bottom: 20px; right: 20px; background: ${bgColors[type]}; color: white; padding: 12px 20px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 10001; font-size: 13px; max-width: 400px;">
                ${message}
            </div>
        `);

        $('body').append(notification);
        setTimeout(() => notification.fadeOut(() => notification.remove()), duration);
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