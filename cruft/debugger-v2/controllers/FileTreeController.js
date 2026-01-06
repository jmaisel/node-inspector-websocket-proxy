/**
 * FileTreeController - Manages file tree display and categorization
 *
 * Responsibilities:
 * - Render file tree from template (with TemplateRegistry override support)
 * - Subscribe to Debugger.scriptParsed events
 * - Categorize files (project, dependency, devDependency, node-internal)
 * - Parse package.json for dependency information
 * - Handle tree node expansion
 * - Delegate breakpoint creation to BreakpointController
 *
 * Features:
 * - 4 categories: Project Files, Dependencies, Dev Dependencies, Node Internal
 * - Collapsible tree nodes
 * - Breakpoint shortcuts per file
 * - Auto-categorization based on package.json
 */

import { TemplateRegistry } from '../core/TemplateRegistry.js';
import { fileTreeTemplate } from '../templates/file-tree-template.js';

export class FileTreeController {
    constructor(config = {}) {
        this.eventQueue = config.eventQueue;
        this.proxy = config.proxy;
        this.container = config.container || '#file-tree';
        this.instanceId = config.instanceId || 'file-tree-' + Date.now();

        // Dependency information from package.json
        this.packageDependencies = new Set();
        this.packageDevDependencies = new Set();

        // File storage by category
        this.files = {
            project: [],           // { scriptId, url, fileName }
            dependencies: [],
            devDependencies: [],
            nodeInternal: []
        };

        // Script ID to URL map
        this.scriptMap = new Map();

        console.log('[FileTreeController] Created');
    }

    /**
     * Initialize - load package.json, render, and setup
     */
    async initialize() {
        console.log('[FileTreeController] Initializing...');

        // Load package.json first
        await this.loadPackageJson();

        // Render the template
        this.render();

        // Setup event handlers
        this.setupDOMEventHandlers();

        // Subscribe to events
        this.subscribeToEvents();

        console.log('[FileTreeController] Initialized');
    }

    /**
     * Load package.json to categorize dependencies
     */
    async loadPackageJson() {
        try {
            // Try to fetch package.json from parent directory
            const response = await fetch('../package.json');
            if (response.ok) {
                const pkg = await response.json();

                // Store dependencies
                if (pkg.dependencies) {
                    Object.keys(pkg.dependencies).forEach(dep => {
                        this.packageDependencies.add(dep);
                    });
                }

                // Store devDependencies
                if (pkg.devDependencies) {
                    Object.keys(pkg.devDependencies).forEach(dep => {
                        this.packageDevDependencies.add(dep);
                    });
                }

                console.log(`[FileTreeController] Loaded package.json: ${this.packageDependencies.size} dependencies, ${this.packageDevDependencies.size} devDependencies`);
            }
        } catch (error) {
            console.warn('[FileTreeController] Could not load package.json:', error);
        }
    }

    /**
     * Render file tree from template (with TemplateRegistry override support)
     */
    render() {
        // Check TemplateRegistry first, fall back to default template
        const templateFn = TemplateRegistry.get('file-tree') || fileTreeTemplate;

        const html = templateFn({
            projectFiles: this.files.project,
            dependencies: this.files.dependencies,
            devDependencies: this.files.devDependencies,
            nodeInternalFiles: this.files.nodeInternal
        }, {}, this.instanceId);

        // Insert into container
        $(this.container).html(html);

        console.log('[FileTreeController] Rendered file tree');
    }

    /**
     * Setup DOM event handlers
     */
    setupDOMEventHandlers() {
        // Tree node header clicks (toggle expansion)
        $(this.container).on('click', '.tree-node-header', (e) => {
            const header = e.currentTarget;
            $(header).parent('.tree-node').toggleClass('expanded');
        });

        // Breakpoint button clicks (delegate to BreakpointController)
        $(this.container).on('click', '.tree-file-bp-btn', (e) => {
            e.stopPropagation();  // Don't trigger file selection
            const url = $(e.currentTarget).data('url');
            console.log('[FileTreeController] Breakpoint button clicked for:', url);
            this.handleBreakpointClick(url);
        });

        // File clicks (optional - could be used for navigation)
        $(this.container).on('click', '.tree-file', (e) => {
            if (!$(e.target).hasClass('tree-file-bp-btn')) {
                const scriptId = $(e.currentTarget).data('script-id');
                const url = $(e.currentTarget).data('url');
                console.log('[FileTreeController] File clicked:', url);
                // Could emit event or trigger file view
            }
        });

        console.log('[FileTreeController] DOM event handlers setup');
    }

    /**
     * Subscribe to events on the queue
     */
    subscribeToEvents() {
        // Add scripts as they are parsed
        this.eventQueue.subscribe('Debugger.scriptParsed', (topic, data) => {
            const scriptId = data.scriptId;
            const url = data.url;

            console.log('[FileTreeController] Script parsed:', url);

            this.addScript(scriptId, url);
        });

        console.log('[FileTreeController] Subscribed to queue events');
    }

    /**
     * Add a script to the file tree
     * @param {string} scriptId - The script ID
     * @param {string} url - The script URL
     */
    addScript(scriptId, url) {
        // Store in script map
        this.scriptMap.set(scriptId, url);

        // Categorize the script
        const category = this.categorizeScript(url);

        // Extract file name
        const fileName = this.extractFileName(url);

        // Add to appropriate category (avoid duplicates)
        const fileObj = { scriptId, url, fileName };

        if (!this.files[category].find(f => f.url === url)) {
            this.files[category].push(fileObj);

            // Re-render to show new file
            this.render();

            // Re-setup event handlers after re-render
            this.setupDOMEventHandlers();
        }
    }

    /**
     * Categorize a script URL
     * @param {string} url - The script URL
     * @returns {string} Category: 'project', 'dependencies', 'devDependencies', or 'nodeInternal'
     */
    categorizeScript(url) {
        if (!url) return 'nodeInternal';

        // Node internal modules
        if (url.startsWith('node:') || url.startsWith('internal/') || url === 'evalmachine.<anonymous>') {
            return 'nodeInternal';
        }

        // Libraries (node_modules)
        if (url.includes('node_modules')) {
            // Extract package name
            const parts = url.split('node_modules/');
            if (parts.length > 1) {
                const libPath = parts[1];
                const pathParts = libPath.split('/');
                let packageName;

                if (pathParts[0].startsWith('@')) {
                    // Scoped package
                    packageName = `${pathParts[0]}/${pathParts[1]}`;
                } else {
                    packageName = pathParts[0];
                }

                // Check if it's a dependency or devDependency
                if (this.packageDependencies.has(packageName)) {
                    return 'dependencies';
                } else if (this.packageDevDependencies.has(packageName)) {
                    return 'devDependencies';
                }
            }
            // Default to dependencies if not found in package.json
            return 'dependencies';
        }

        // Project files
        return 'project';
    }

    /**
     * Extract file name from URL
     * @param {string} url - The script URL
     * @returns {string} File name
     */
    extractFileName(url) {
        if (!url) return 'unknown';

        // Remove file:// prefix if present
        let path = url.replace('file://', '');

        // Get the last part of the path
        const parts = path.split('/');
        return parts[parts.length - 1] || url;
    }

    /**
     * Handle breakpoint button click
     * Delegates to BreakpointController if available
     * @param {string} url - The file URL
     */
    handleBreakpointClick(url) {
        console.log('[FileTreeController] Requesting breakpoint for:', url);

        // TODO: This will be wired up in Phase 3 when we create BreakpointController
        // For now, just log
        // if (this.breakpointController) {
        //     this.breakpointController.addBreakpoint(url, 1);  // Default to line 1
        // }

        // Temporary: Just show alert
        alert(`Breakpoint functionality will be available when BreakpointController is wired up.\nFile: ${url}`);
    }
}
