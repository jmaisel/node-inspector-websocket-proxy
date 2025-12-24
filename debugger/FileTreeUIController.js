/**
 * FileTreeUIController - Manages the file tree display and categorization
 */
class FileTreeUIController extends BaseUIController {
    constructor() {
        super();
        this.packageDependencies = new Set();
        this.packageDevDependencies = new Set();
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

                log(`Loaded package.json: ${this.packageDependencies.size} dependencies, ${this.packageDevDependencies.size} devDependencies`, 'info');
            }
        } catch (error) {
            console.warn('Could not load package.json:', error);
        }
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

        const fileHtml = `
            <div class="tree-file" data-script-id="${scriptId}" data-url="${url}" title="${url}">
                <span class="tree-file-icon">📄</span>
                <span class="tree-file-name">${fileName}</span>
            </div>
        `;

        $(containerId).append(fileHtml);
    }

    /**
     * Setup event handlers for file tree interactions
     */
    setupEventHandlers() {
        // File selection handler
        $(document).on('click', '.tree-file', function() {
            $('.tree-file').removeClass('active');
            $(this).addClass('active');

            const scriptId = $(this).data('script-id');
            const url = $(this).data('url');

            log(`Selected file: ${url} (scriptId: ${scriptId})`, 'info');
            // TODO: Load and display source code
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