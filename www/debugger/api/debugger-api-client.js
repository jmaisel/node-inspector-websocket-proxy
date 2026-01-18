/**
 * API client for communicating with the node-inspector-websocket-proxy server
 * Handles project listing, file browsing, and debug session management
 */
class DebuggerApiClient {
    constructor(baseUrl = 'http://localhost:8080') {
        this.baseUrl = baseUrl;
        this.logger = new Logger("DebuggerApiClient");
        this.timeout = 5000; // 5 second timeout
    }

    /**
     * Get workspace information including root path
     * @returns {Promise<Object>} Workspace info with workspaceRoot, etc.
     */
    async getWorkspaceInfo() {
        try {
            const response = await $.ajax({
                url: `${this.baseUrl}/workspace/info`,
                type: 'GET',
                timeout: this.timeout,
                dataType: 'json'
            });
            this.logger.info("Workspace info:", response);
            return response;
        } catch (error) {
            this.logger.error("Failed to get workspace info:", error);
            throw error;
        }
    }

    /**
     * Check if the server is reachable and healthy
     * @returns {Promise<boolean>}
     */
    async checkServerHealth() {
        try {
            await this.getWorkspaceInfo();
            return true;
        } catch (error) {
            this.logger.error("Server health check failed:", error);
            return false;
        }
    }

    /**
     * List all files and folders at the workspace root
     * @returns {Promise<Array>} Array of items with name, type, size, modified
     */
    async listWorkspace() {
        try {
            this.logger.info("Fetching workspace contents from server");
            const response = await $.ajax({
                url: `${this.baseUrl}/workspace/`,
                type: 'GET',
                timeout: this.timeout,
                dataType: 'json'
            });

            this.logger.info("Workspace list response:", response);

            const contents = response.contents || [];
            this.logger.info(`Found ${contents.length} items in workspace`);

            return contents;
        } catch (error) {
            this.logger.error("Failed to fetch workspace contents:", error);
            throw new Error(`Failed to fetch workspace: ${error.statusText || error.message}`);
        }
    }

    /**
     * List all projects (folders) at the workspace root
     * @returns {Promise<Array>} Array of project objects with name, type, size, modified
     */
    async listProjects() {
        try {
            const contents = await this.listWorkspace();

            // Filter to only show directories (projects)
            const projects = contents.filter(item => item.type === 'directory');
            this.logger.info(`Found ${projects.length} projects`);

            return projects;
        } catch (error) {
            this.logger.error("Failed to fetch project list:", error);
            throw new Error(`Failed to fetch projects: ${error.statusText || error.message}`);
        }
    }

    /**
     * List files in a specific project directory
     * @param {string} projectPath - Relative path to the project (e.g., "/demo-project")
     * @returns {Promise<Array>} Array of file objects with name, type, size, modified
     */
    async listProjectFiles(projectPath) {
        try {
            this.logger.info(`Fetching files for project: ${projectPath}`);

            // Ensure path starts with /
            const path = projectPath.startsWith('/') ? projectPath : `/${projectPath}`;

            const response = await $.ajax({
                url: `${this.baseUrl}/workspace${path}`,
                type: 'GET',
                timeout: this.timeout,
                dataType: 'json'
            });

            this.logger.info("Project files response:", response);
            return response.contents || [];
        } catch (error) {
            this.logger.error(`Failed to fetch files for project ${projectPath}:`, error);
            throw new Error(`Failed to fetch project files: ${error.statusText || error.message}`);
        }
    }

    /**
     * Get file content
     * @param {string} filePath - Path to the file (e.g., "/demo-project/index.js")
     * @returns {Promise<string>} File content as text
     */
    async getFileContent(filePath) {
        try {
            this.logger.info(`Fetching file content: ${filePath}`);

            // Ensure path starts with /
            const path = filePath.startsWith('/') ? filePath : `/${filePath}`;

            const response = await $.ajax({
                url: `${this.baseUrl}/workspace${path}`,
                type: 'GET',
                timeout: this.timeout,
                dataType: 'text'
            });

            this.logger.info("File content fetched successfully");
            return response;
        } catch (error) {
            this.logger.error(`Failed to fetch file content for ${filePath}:`, error);
            throw new Error(`Failed to fetch file: ${error.statusText || error.message}`);
        }
    }

    /**
     * Set the active project directory
     * @param {string} projectPath - Path to the project (e.g., "/demo-project")
     * @returns {Promise<Object>} Response with activeProject and state
     */
    async setActiveProject(projectPath) {
        try {
            this.logger.info(`Setting active project: ${projectPath}`);

            const response = await $.ajax({
                url: `${this.baseUrl}/workspace/active-project`,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ projectPath }),
                timeout: this.timeout,
                dataType: 'json'
            });

            this.logger.info("Active project set:", response);
            return response;
        } catch (error) {
            this.logger.error("Failed to set active project:", error);
            throw new Error(`Failed to set active project: ${error.statusText || error.message}`);
        }
    }

    /**
     * List available demo projects
     * @returns {Promise<Array>} Array of project objects with name and description
     */
    async listDemoProjects() {
        try {
            this.logger.info("Listing demo projects");

            const response = await $.ajax({
                url: `${this.baseUrl}/api/demo-projects`,
                type: 'GET',
                timeout: this.timeout,
                dataType: 'json'
            });

            this.logger.info("Demo projects:", response);
            return response.projects || [];
        } catch (error) {
            this.logger.error("Failed to list demo projects:", error);
            throw new Error(`Failed to list demo projects: ${error.statusText || error.message}`);
        }
    }

    /**
     * Copy a demo project to the workspace
     * @param {string} projectName - Name of the demo project to copy
     * @param {string} targetName - Optional target name (defaults to project name)
     * @returns {Promise<Object>} Object with success, message, and path
     */
    async copyDemoProject(projectName, targetName = null) {
        try {
            this.logger.info("Copying demo project:", projectName);

            const requestData = { projectName };
            if (targetName) {
                requestData.targetName = targetName;
            }

            const response = await $.ajax({
                url: `${this.baseUrl}/api/demo-projects/copy`,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(requestData),
                timeout: this.timeout,
                dataType: 'json'
            });

            this.logger.info("Demo project copied:", response);
            return response;
        } catch (error) {
            this.logger.error("Failed to copy demo project:", error);
            throw new Error(`Failed to copy demo project: ${error.statusText || error.message}`);
        }
    }

    /**
     * Start a debug session for a specific file
     * @param {string} filePath - Absolute path to the JavaScript file to debug
     * @returns {Promise<Object>} Session object with sessionId, wsUrl, status, etc.
     */
    async startDebugSession(filePath) {
        try {
            this.logger.info(`Starting debug session for file: ${filePath}`);

            const response = await $.ajax({
                url: `${this.baseUrl}/debug/session`,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ file: filePath }),
                timeout: this.timeout,
                dataType: 'json'
            });

            this.logger.info("Debug session started:", response);
            return response;
        } catch (error) {
            this.logger.error("Failed to start debug session:", error);
            throw new Error(`Failed to start debug session: ${error.statusText || error.message}`);
        }
    }

    /**
     * Get information about the current debug session
     * @returns {Promise<Object>} Current session info or null if no session
     */
    async getSessionInfo() {
        try {
            this.logger.info("Fetching current session info");

            const response = await $.ajax({
                url: `${this.baseUrl}/debug/session`,
                type: 'GET',
                timeout: this.timeout,
                dataType: 'json'
            });

            this.logger.info("Current session info:", response);
            return response;
        } catch (error) {
            if (error.status === 404) {
                this.logger.info("No active session");
                return null;
            }
            this.logger.error("Failed to fetch session info:", error);
            throw new Error(`Failed to get session info: ${error.statusText || error.message}`);
        }
    }

    /**
     * Stop the current debug session
     * @returns {Promise<Object>} Response with status
     */
    async stopDebugSession() {
        try {
            this.logger.info("Stopping debug session");

            const response = await $.ajax({
                url: `${this.baseUrl}/debug/session`,
                type: 'DELETE',
                timeout: this.timeout,
                dataType: 'json'
            });

            this.logger.info("Debug session stopped:", response);
            return response;
        } catch (error) {
            this.logger.error("Failed to stop debug session:", error);
            throw new Error(`Failed to stop debug session: ${error.statusText || error.message}`);
        }
    }

    /**
     * Save file content to the workspace
     * @param {string} filePath - Path to the file (e.g., "/demo-project/index.js")
     * @param {string} content - File content to save
     * @returns {Promise<Object>} Response with success status, size, and modified timestamp
     */
    async saveFile(filePath, content) {
        try {
            this.logger.info(`Saving file: ${filePath}`);

            // Ensure path starts with /
            const path = filePath.startsWith('/') ? filePath : `/${filePath}`;

            // Determine content type based on file extension
            const ext = filePath.split('.').pop().toLowerCase();
            const contentTypeMap = {
                'js': 'application/javascript',
                'json': 'application/json',
                'html': 'text/html',
                'css': 'text/css',
                'txt': 'text/plain',
                'md': 'text/markdown',
                'xml': 'application/xml'
            };
            const contentType = contentTypeMap[ext] || 'text/plain';

            const response = await $.ajax({
                url: `${this.baseUrl}/workspace${path}`,
                type: 'PUT',
                contentType: contentType + '; charset=utf-8',
                data: content,
                timeout: this.timeout,
                dataType: 'json',
                processData: false
            });

            this.logger.info("File saved successfully:", response);
            return response;
        } catch (error) {
            this.logger.error(`Failed to save file ${filePath}:`, error);
            throw new Error(`Failed to save file: ${error.statusText || error.message}`);
        }
    }

    /**
     * Run npm install in a project directory
     * @param {string} projectPath - Path to the project (e.g., "/demo-project")
     * @returns {Promise<Object>} Response with success status and output
     */
    async runNpmInstall(projectPath) {
        try {
            this.logger.info(`Running npm install for project: ${projectPath}`);

            // Ensure path starts with /
            const path = projectPath.startsWith('/') ? projectPath : `/${projectPath}`;

            const response = await $.ajax({
                url: `${this.baseUrl}/workspace${path}/npm-install`,
                type: 'POST',
                timeout: 60000, // 60 second timeout for npm install
                dataType: 'json'
            });

            this.logger.info("npm install completed:", response);
            return response;
        } catch (error) {
            this.logger.error(`npm install failed for ${projectPath}:`, error);
            throw new Error(`npm install failed: ${error.statusText || error.message}`);
        }
    }

    /**
     * Create a new directory
     * @param {string} dirPath - Path to the directory (e.g., "/demo-project/src")
     * @returns {Promise<Object>} Response with success status
     */
    async createDirectory(dirPath) {
        try {
            this.logger.info(`Creating directory: ${dirPath}`);

            // Ensure path starts with /
            const path = dirPath.startsWith('/') ? dirPath : `/${dirPath}`;

            const response = await $.ajax({
                url: `${this.baseUrl}/workspace${path}`,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ type: 'directory' }),
                timeout: this.timeout,
                dataType: 'json'
            });

            this.logger.info("Directory created:", response);
            return response;
        } catch (error) {
            this.logger.error(`Failed to create directory ${dirPath}:`, error);
            throw new Error(`Failed to create directory: ${error.statusText || error.message}`);
        }
    }
}
