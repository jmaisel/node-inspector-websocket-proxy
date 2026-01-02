/**
 * WorkspaceBrowserController - Standalone UI controller for browsing workspace files
 *
 * This controller is designed to be embedded in any application.
 * It provides a file browser UI and handles workspace handshake with the server.
 *
 * Features:
 * - Browse workspace files and directories
 * - Open files and display content
 * - Upload project as ZIP to initialize workspace
 * - Handshake protocol to agree on workspace location
 * - Event-driven architecture for integration
 *
 * @example
 * const browser = new WorkspaceBrowserController({
 *     apiUrl: 'http://localhost:8080/project',
 *     containerSelector: '#workspace-browser',
 *     onFileOpen: (path, content) => console.log('Opened:', path),
 *     onWorkspaceChange: (info) => console.log('Workspace:', info)
 * });
 * await browser.initialize();
 */

class WorkspaceBrowserController {
    /**
     * Creates a new WorkspaceBrowserController instance
     * @param {Object} config - Configuration object
     * @param {string} config.apiUrl - Base URL for workspace API (e.g., 'http://localhost:8080/project')
     * @param {string} config.containerSelector - CSS selector for container element
     * @param {Function} [config.onFileOpen] - Callback when file is opened (path, content)
     * @param {Function} [config.onFileSelect] - Callback when file is selected (path)
     * @param {Function} [config.onDirectoryChange] - Callback when directory changes (path)
     * @param {Function} [config.onWorkspaceChange] - Callback when workspace info changes (info)
     * @param {Function} [config.onDebugFile] - Callback when user wants to debug a file (path)
     * @param {Function} [config.onError] - Callback for errors (error)
     * @param {string} [config.apiKey] - API key for authenticated operations
     * @param {boolean} [config.showDebugAction=false] - Show "Debug" action on files
     */
    constructor(config) {
        this.apiUrl = config.apiUrl || 'http://localhost:8080/project';
        this.containerSelector = config.containerSelector;
        this.onFileOpen = config.onFileOpen || (() => {});
        this.onFileSelect = config.onFileSelect || (() => {});
        this.onDirectoryChange = config.onDirectoryChange || (() => {});
        this.onWorkspaceChange = config.onWorkspaceChange || (() => {});
        this.onDebugFile = config.onDebugFile || (() => {});
        this.onError = config.onError || ((err) => console.error(err));
        this.apiKey = config.apiKey || null;
        this.showDebugAction = config.showDebugAction !== false;

        this.currentPath = '/';
        this.workspaceInfo = null;
        this.fileCache = new Map();
        this.container = null;
    }

    /**
     * Initialize the controller and perform workspace handshake
     * @returns {Promise<Object>} Workspace information
     */
    async initialize() {
        // Get container element
        this.container = document.querySelector(this.containerSelector);
        if (!this.container) {
            throw new Error(`Container not found: ${this.containerSelector}`);
        }

        // Perform workspace handshake
        this.workspaceInfo = await this.performHandshake();
        this.onWorkspaceChange(this.workspaceInfo);

        // Render initial UI
        this.render();

        return this.workspaceInfo;
    }

    /**
     * Perform handshake with server to establish workspace
     * @returns {Promise<Object>} Workspace information
     */
    async performHandshake() {
        try {
            const response = await fetch(`${this.apiUrl.replace('/project', '')}/workspace/info`);
            if (!response.ok) {
                throw new Error(`Handshake failed: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            this.onError(error);
            throw error;
        }
    }

    /**
     * Upload a ZIP file to initialize/update workspace
     * @param {File} zipFile - ZIP file to upload
     * @param {string} [targetPath='/'] - Target path in workspace
     * @returns {Promise<Object>} Upload result
     */
    async uploadProject(zipFile, targetPath = '/') {
        if (!this.apiKey) {
            throw new Error('API key required for upload');
        }

        try {
            const response = await fetch(`${this.apiUrl}${targetPath}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/zip',
                    'X-Workspace-API-Key': this.apiKey
                },
                body: zipFile
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Upload failed');
            }

            const result = await response.json();

            // Refresh workspace after upload
            await this.refresh();

            return result;
        } catch (error) {
            this.onError(error);
            throw error;
        }
    }

    /**
     * Load directory listing
     * @param {string} path - Directory path
     * @returns {Promise<Object>} Directory data
     */
    async loadDirectory(path) {
        try {
            const response = await fetch(`${this.apiUrl}${path}`);
            if (!response.ok) {
                throw new Error(`Failed to load directory: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            this.onError(error);
            throw error;
        }
    }

    /**
     * Load file content
     * @param {string} path - File path
     * @returns {Promise<string>} File content
     */
    async loadFile(path) {
        // Check cache first
        if (this.fileCache.has(path)) {
            return this.fileCache.get(path);
        }

        try {
            const response = await fetch(`${this.apiUrl}${path}`);
            if (!response.ok) {
                throw new Error(`Failed to load file: ${response.status}`);
            }
            const content = await response.text();

            // Cache the content
            this.fileCache.set(path, content);

            return content;
        } catch (error) {
            this.onError(error);
            throw error;
        }
    }

    /**
     * Download directory as ZIP
     * @param {string} path - Directory path
     * @returns {Promise<Blob>} ZIP blob
     */
    async downloadAsZip(path) {
        try {
            const response = await fetch(`${this.apiUrl}${path}`, {
                headers: {
                    'Accept': 'application/zip'
                }
            });
            if (!response.ok) {
                throw new Error(`Failed to download: ${response.status}`);
            }
            return await response.blob();
        } catch (error) {
            this.onError(error);
            throw error;
        }
    }

    /**
     * Navigate to a directory
     * @param {string} path - Directory path
     */
    async navigateTo(path) {
        this.currentPath = path;
        this.onDirectoryChange(path);
        await this.render();
    }

    /**
     * Go up one directory level
     */
    async navigateUp() {
        if (this.currentPath === '/') return;

        const parts = this.currentPath.split('/').filter(p => p);
        parts.pop();
        const newPath = '/' + parts.join('/');
        await this.navigateTo(newPath === '/' ? '/' : newPath + '/');
    }

    /**
     * Open a file
     * @param {string} path - File path
     */
    async openFile(path) {
        try {
            const content = await this.loadFile(path);
            this.onFileOpen(path, content);
            this.onFileSelect(path);
        } catch (error) {
            this.onError(error);
        }
    }

    /**
     * Refresh current directory view
     */
    async refresh() {
        // Clear cache
        this.fileCache.clear();

        // Re-render
        await this.render();
    }

    /**
     * Render the UI
     */
    async render() {
        if (!this.container) return;

        try {
            const data = await this.loadDirectory(this.currentPath);

            // Build HTML
            let html = `
                <div class="workspace-browser">
                    <div class="workspace-header">
                        <div class="workspace-path">
                            <button class="btn-up" ${this.currentPath === '/' ? 'disabled' : ''}>↑</button>
                            <span class="current-path">${this.currentPath}</span>
                            <button class="btn-refresh" title="Refresh">⟳</button>
                            <button class="btn-download" title="Download as ZIP">↓</button>
                        </div>
                    </div>
                    <div class="workspace-toolbar">
                        <input type="file" id="upload-zip" accept=".zip" style="display:none">
                        <button class="btn-upload" ${this.apiKey ? '' : 'disabled'} title="${this.apiKey ? 'Upload ZIP' : 'API key required'}">Upload ZIP</button>
                    </div>
                    <div class="workspace-content">
                        <div class="file-list">
            `;

            // Sort: directories first, then files
            const sorted = data.contents.sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'directory' ? -1 : 1;
            });

            // Render items
            sorted.forEach(item => {
                const icon = item.type === 'directory' ? '📁' : '📄';
                const itemClass = item.type === 'directory' ? 'directory' : 'file';
                const size = item.type === 'file' ? this.formatSize(item.size) : '';
                const isJsFile = item.type === 'file' && item.name.endsWith('.js');
                const debugBtn = (this.showDebugAction && isJsFile) ? `<button class="btn-debug" data-path="${this.currentPath}${item.name}" title="Debug this file">▶️ Debug</button>` : '';

                html += `
                    <div class="file-item ${itemClass}" data-path="${this.currentPath}${item.name}${item.type === 'directory' ? '/' : ''}">
                        <span class="file-icon">${icon}</span>
                        <span class="file-name">${item.name}</span>
                        <span class="file-size">${size}</span>
                        ${debugBtn}
                    </div>
                `;
            });

            html += `
                        </div>
                    </div>
                </div>
            `;

            this.container.innerHTML = html;

            // Attach event listeners
            this.attachEventListeners();

        } catch (error) {
            this.container.innerHTML = `
                <div class="workspace-error">
                    <p>Error loading workspace: ${error.message}</p>
                    <button class="btn-retry">Retry</button>
                </div>
            `;
            this.container.querySelector('.btn-retry').addEventListener('click', () => this.render());
        }
    }

    /**
     * Attach event listeners to UI elements
     */
    attachEventListeners() {
        // Up button
        const btnUp = this.container.querySelector('.btn-up');
        if (btnUp) {
            btnUp.addEventListener('click', () => this.navigateUp());
        }

        // Refresh button
        const btnRefresh = this.container.querySelector('.btn-refresh');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => this.refresh());
        }

        // Download button
        const btnDownload = this.container.querySelector('.btn-download');
        if (btnDownload) {
            btnDownload.addEventListener('click', async () => {
                const blob = await this.downloadAsZip(this.currentPath);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `workspace-${Date.now()}.zip`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        // Upload button
        const btnUpload = this.container.querySelector('.btn-upload');
        const uploadInput = this.container.querySelector('#upload-zip');
        if (btnUpload && uploadInput) {
            btnUpload.addEventListener('click', () => uploadInput.click());
            uploadInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        await this.uploadProject(file, this.currentPath);
                        alert('Upload successful!');
                    } catch (error) {
                        alert(`Upload failed: ${error.message}`);
                    }
                }
            });
        }

        // File/directory items
        const items = this.container.querySelectorAll('.file-item');
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't trigger if clicking debug button
                if (e.target.classList.contains('btn-debug')) {
                    return;
                }

                const path = item.dataset.path;
                if (item.classList.contains('directory')) {
                    this.navigateTo(path);
                } else {
                    this.openFile(path);
                }
            });
        });

        // Debug buttons
        const debugButtons = this.container.querySelectorAll('.btn-debug');
        debugButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent file open
                const path = btn.dataset.path;
                this.onDebugFile(path);
            });
        });
    }

    /**
     * Format file size for display
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size
     */
    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * Clear the file cache
     */
    clearCache() {
        this.fileCache.clear();
    }

    /**
     * Get current workspace path
     * @returns {string} Current path
     */
    getCurrentPath() {
        return this.currentPath;
    }

    /**
     * Get workspace info
     * @returns {Object} Workspace information
     */
    getWorkspaceInfo() {
        return this.workspaceInfo;
    }
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkspaceBrowserController;
}
