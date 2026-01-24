import { BaseUIController } from './BaseUIController.js';
import { TemplateRegistry, generateInstanceId } from '../TemplateRegistry.js';
import { fileTreeTemplate, fileItemTemplate } from '../templates/file-tree-template.js';

/**
 * FileTreeUIController - Manages the file tree display and categorization
 *
 * Supports two modes:
 * 1. Standalone: Generates its own HTML from template
 * 2. Embedded: Uses existing HTML in the DOM
 *
 * @example
 * // Standalone with default template
 * const fileTree = new FileTreeUIController({ skipRender: false });
 * fileTree.mount('.tab-content');
 * fileTree.initialize();
 *
 * // Embedded with existing HTML
 * const fileTree = new FileTreeUIController({ skipRender: true });
 * fileTree.initialize();
 */
export class FileTreeUIController extends BaseUIController {
    constructor(config = {}) {
        super();

        const instanceId = config.instanceId || 'files';

        this.instanceId = instanceId;
        this.debuggerUI = config.debuggerUI || null;
        this.skipRender = config.skipRender !== undefined ? config.skipRender : true;
        this.logger = new Logger("FileTreeUIController");

        this.packageDependencies = new Set();
        this.packageDevDependencies = new Set();
    }

    /**
     * Render HTML from template
     * @returns {string} HTML string
     */
    render() {
        const template = TemplateRegistry.get('filetree') || fileTreeTemplate;
        return template({}, this.instanceId);
    }

    /**
     * Mount the file tree into a DOM container
     * @param {string|jQuery} container - Container for tab pane (e.g., '.tab-content')
     */
    mount(container) {
        if (this.skipRender) {
            // Use existing HTML - no mount needed
            return;
        }

        const html = this.render();
        $(container).append(html);
    }

    /**
     * Toggle tree node expansion
     * @param {HTMLElement} header - The tree node header element
     */
    toggleTreeNode(header) {
        $(header).parent('.tree-node').toggleClass('expanded');
    }

    /**
     * Load package.json to categorize dependencies
     */
    async loadPackageJson() {
        // Try multiple possible paths for package.json
        const possiblePaths = [
            '/package.json',           // Absolute path from server root
            '../../package.json',      // From www/debugger/ directory
            '../package.json'          // From www/ directory
        ];

        for (const path of possiblePaths) {
            try {
                const response = await fetch(path);
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

                    log(`Loaded package.json from ${path}: ${this.packageDependencies.size} dependencies, ${this.packageDevDependencies.size} devDependencies`, 'info');
                    return; // Success, exit early
                }
            } catch (error) {
                // Continue to next path
            }
        }

        // If we get here, all paths failed
        this.logger.warn('Could not load package.json from any location. Dependency categorization will be limited.');
    }

    /**
     * Categorize a script URL into project, dependency, devDependency, or node-internal
     * @param {string} url - The script URL
     * @returns {string} The category
     */
    categorizeScript(url) {
        if (!url) return 'node-internal';

        // Node internal modules
        if (url.startsWith('node:') || url.startsWith('internal/') || url === 'evalmachine.<anonymous>') {
            return 'node-internal';
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
                    return 'dependency';
                } else if (this.packageDevDependencies.has(packageName)) {
                    return 'devDependency';
                }
            }
            // Default to dependency if not found
            return 'dependency';
        }

        // Project files
        return 'project';
    }

    /**
     * Add a script to the file tree
     * @param {string} scriptId - The script ID
     * @param {string} url - The script URL
     */
    addScriptToFileTree(scriptId, url) {
        const category = this.categorizeScript(url);
        const fileName = getFileName(url);

        let containerId;
        if (category === 'project') {
            containerId = '#projectFiles';
        } else if (category === 'dependency') {
            containerId = '#dependencies';
        } else if (category === 'devDependency') {
            containerId = '#devDependencies';
        } else {
            containerId = '#nodeInternalFiles';
        }

        // Check if already added
        if ($(`${containerId} [data-script-id="${scriptId}"]`).length > 0) {
            return;
        }

        const fileHtml = fileItemTemplate({
            scriptId,
            url,
            fileName
        });

        $(containerId).append(fileHtml);
    }

    /**
     * Setup event handlers for file tree interactions
     */
    setupEventHandlers() {
        // File selection handler
        $(document).on('click', '.tree-file', function(e) {
            // Don't trigger if clicking the breakpoint button
            if ($(e.target).hasClass('tree-file-bp-btn')) {
                return;
            }

            $('.tree-file').removeClass('active');
            $(this).addClass('active');

            const scriptId = $(this).data('script-id');
            const url = $(this).data('url');

            log(`Selected file: ${url} (scriptId: ${scriptId})`, 'info');
            // TODO: Load and display source code
        });

        // Breakpoint button handler
        $(document).on('click', '.tree-file-bp-btn', function(e) {
            e.stopPropagation(); // Prevent file selection

            const url = $(this).data('url');

            // Switch to breakpoints tab
            $('.tab-btn[data-tab="breakpoints"]').click();

            // Pre-fill the URL input
            $('#breakpoints-url').val(url);

            // Focus on line number input
            $('#breakpoints-line').focus();

            log(`Ready to set breakpoint in: ${url}`, 'info');
        });

        // Tree node toggle handler (using global function for onclick in HTML)
        window.toggleTreeNode = (header) => this.toggleTreeNode(header);
    }

    /**
     * Initialize the file tree
     */
    async initialize() {
        this.setupEventHandlers();
        await this.loadPackageJson();
    }
}