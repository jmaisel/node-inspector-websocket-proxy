const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

/**
 * WorkspaceSecurity - Handles path validation and workspace boundary enforcement
 * Ensures all file operations stay within the configured workspace directory
 */
class WorkspaceSecurity {
    /**
     * Creates a new WorkspaceSecurity instance
     * @param {string} workspaceRoot - Absolute path to workspace root directory
     */
    constructor(workspaceRoot) {
        // Resolve workspace root to its real path (follow symlinks)
        try {
            this.workspaceRoot = fsSync.realpathSync(path.resolve(workspaceRoot));
        } catch (err) {
            // If realpath fails (e.g., doesn't exist yet), just use the resolved path
            this.workspaceRoot = path.resolve(workspaceRoot);
        }
    }

    /**
     * Validates a relative path and returns its absolute path within workspace
     * @param {string} relativePath - Relative path from workspace root
     * @returns {Promise<string>} Absolute path if valid
     * @throws {Error} If path escapes workspace or is invalid
     */
    async validatePath(relativePath) {
        // Normalize the relative path (remove ., .., etc.)
        const normalizedPath = path.normalize(relativePath || '/');

        // Join with workspace root
        const absolutePath = path.join(this.workspaceRoot, normalizedPath);

        // Resolve symlinks to get final destination
        let resolvedPath;
        try {
            resolvedPath = await fs.realpath(absolutePath);
        } catch (err) {
            // Path doesn't exist yet - that's ok for write operations
            // Just resolve the parent directory and check that
            if (err.code === 'ENOENT') {
                const parentDir = path.dirname(absolutePath);
                try {
                    const resolvedParent = await fs.realpath(parentDir);
                    const fileName = path.basename(absolutePath);
                    resolvedPath = path.join(resolvedParent, fileName);
                } catch (parentErr) {
                    // Parent doesn't exist either - just use the normalized absolute path
                    resolvedPath = absolutePath;
                }
            } else {
                throw err;
            }
        }

        // Verify the resolved path is still within workspace
        if (!this.isWithinWorkspace(resolvedPath)) {
            throw new Error('Path traversal detected: path escapes workspace');
        }

        return resolvedPath;
    }

    /**
     * Checks if an absolute path is within the workspace
     * @param {string} absolutePath - Absolute path to check
     * @returns {boolean} True if path is within workspace
     */
    isWithinWorkspace(absolutePath) {
        const resolved = path.resolve(absolutePath);
        const workspaceWithSep = this.workspaceRoot.endsWith(path.sep)
            ? this.workspaceRoot
            : this.workspaceRoot + path.sep;

        return resolved === this.workspaceRoot ||
               resolved.startsWith(workspaceWithSep);
    }

    /**
     * Gets the relative path from workspace root
     * @param {string} absolutePath - Absolute path within workspace
     * @returns {string} Relative path from workspace root
     */
    getRelativePath(absolutePath) {
        return path.relative(this.workspaceRoot, absolutePath);
    }

    /**
     * Gets the workspace root directory
     * @returns {string} Workspace root absolute path
     */
    getWorkspaceRoot() {
        return this.workspaceRoot;
    }
}

module.exports = WorkspaceSecurity;
