/**
 * ProjectAPI - Handles all server communication for projects and files
 *
 * This module provides a clean interface for project-related API calls,
 * wrapping the debuggerApiClient and adding project-specific logic.
 *
 * @class ProjectAPI
 */
class ProjectAPI {
    /**
     * Creates a new ProjectAPI instance
     * @param {Object} debuggerApiClient - The API client for server communication
     * @param {Logger} logger - Logger instance for debugging
     */
    constructor(debuggerApiClient, logger) {
        this.apiClient = debuggerApiClient;
        this.logger = logger;
    }

    /**
     * Check if the server is available and healthy
     * @returns {Promise<boolean>} True if server is healthy
     */
    async checkServerHealth() {
        return await this.apiClient.checkServerHealth();
    }

    /**
     * List all items in the workspace root
     * @returns {Promise<Array>} Array of workspace items {name, type, size}
     */
    async listWorkspaceItems() {
        this.logger.info('Listing workspace items');
        return await this.apiClient.listWorkspace();
    }

    /**
     * List all files in a project directory
     * @param {string} projectPath - Path to the project (e.g., "/my-project")
     * @returns {Promise<Array>} Array of file objects {name, type, size}
     */
    async listProjectFiles(projectPath) {
        this.logger.info('Listing files for project:', projectPath);
        return await this.apiClient.listProjectFiles(projectPath);
    }

    /**
     * Get the content of a file
     * @param {string} filePath - Full path to the file
     * @returns {Promise<string>} File content as string
     */
    async getFileContent(filePath) {
        this.logger.info('Getting file content:', filePath);
        return await this.apiClient.getFileContent(filePath);
    }

    /**
     * Save content to a file
     * @param {string} filePath - Full path to the file
     * @param {string} content - Content to save
     * @returns {Promise<Object>} Result object
     */
    async saveFile(filePath, content) {
        this.logger.info('Saving file:', filePath);
        return await this.apiClient.saveFile(filePath, content);
    }

    /**
     * Create a new directory
     * @param {string} directoryPath - Full path to the directory to create
     * @returns {Promise<Object>} Result object
     */
    async createDirectory(directoryPath) {
        this.logger.info('Creating directory:', directoryPath);
        return await this.apiClient.createDirectory(directoryPath);
    }

    /**
     * Set the active project
     * @param {string} projectPath - Path to the project
     * @returns {Promise<Object>} Result object
     */
    async setActiveProject(projectPath) {
        this.logger.info('Setting active project:', projectPath);
        return await this.apiClient.setActiveProject(projectPath);
    }

    /**
     * List available demo projects
     * @returns {Promise<Array>} Array of demo project objects {name, description}
     */
    async listDemoProjects() {
        this.logger.info('Listing demo projects');
        return await this.apiClient.listDemoProjects();
    }

    /**
     * Copy a demo project to the workspace
     * @param {string} projectName - Name of the demo project to copy
     * @returns {Promise<Object>} Result object {success, message, path}
     */
    async copyDemoProject(projectName) {
        this.logger.info('Copying demo project:', projectName);
        return await this.apiClient.copyDemoProject(projectName);
    }

    /**
     * Run npm install in a project directory
     * @param {string} projectPath - Path to the project
     * @returns {Promise<Object>} Result object {success, error}
     */
    async runNpmInstall(projectPath) {
        this.logger.info('Running npm install for project:', projectPath);
        return await this.apiClient.runNpmInstall(projectPath);
    }

    /**
     * Find a suitable entry point file in a project
     * Looks for index.js, main.js, or any .js file
     * @param {string} projectPath - Path to the project
     * @returns {Promise<string>} Name of the entry point file
     * @throws {Error} If no suitable entry point is found
     */
    async findEntryPoint(projectPath) {
        this.logger.info('Finding entry point for project:', projectPath);

        try {
            const files = await this.listProjectFiles(projectPath);

            // Look for conventional entry points
            const entryPoints = ['index.js', 'main.js'];
            for (const entry of entryPoints) {
                if (files.some(f => f.name === entry && f.type === 'file')) {
                    this.logger.info('Found entry point:', entry);
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
                this.logger.info('Found single JS file:', jsFiles[0].name);
                return jsFiles[0].name;
            }

            // Multiple JS files - caller needs to handle selection
            this.logger.info('Multiple JS files found:', jsFiles.length);
            return null; // Signal that caller should show file picker

        } catch (error) {
            this.logger.error('Error finding entry point:', error);
            throw error;
        }
    }
}