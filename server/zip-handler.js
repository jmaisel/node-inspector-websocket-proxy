const archiver = require('archiver');
const unzipper = require('unzipper');
const fs = require('fs');
const path = require('path');
const { promises: fsPromises } = require('fs');

/**
 * ZipHandler - Handles ZIP file creation and extraction
 */
class ZipHandler {
    /**
     * Creates a ZIP stream from a directory and pipes it to response
     * @param {string} dirPath - Absolute path to directory
     * @param {Object} res - Express response object
     * @param {string} [zipName] - Name for the ZIP file (defaults to directory name)
     * @returns {Promise<void>}
     */
    static async createZipFromDirectory(dirPath, res, zipName) {
        return new Promise((resolve, reject) => {
            const archive = archiver('zip', {
                zlib: { level: 9 } // Maximum compression
            });

            // Set response headers
            const fileName = zipName || path.basename(dirPath) + '.zip';
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

            // Handle archiver errors
            archive.on('error', (err) => {
                reject(err);
            });

            // Pipe archive to response
            archive.pipe(res);

            // Add directory contents recursively
            archive.directory(dirPath, false);

            // Finalize the archive
            archive.finalize();

            // Resolve when done
            archive.on('end', resolve);
        });
    }

    /**
     * Creates a ZIP stream from a single file and pipes it to response
     * @param {string} filePath - Absolute path to file
     * @param {Object} res - Express response object
     * @param {string} [zipName] - Name for the ZIP file (defaults to filename.zip)
     * @returns {Promise<void>}
     */
    static async createZipFromFile(filePath, res, zipName) {
        return new Promise((resolve, reject) => {
            const archive = archiver('zip', {
                zlib: { level: 9 }
            });

            const fileName = zipName || path.basename(filePath) + '.zip';
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(res);

            // Add single file
            archive.file(filePath, { name: path.basename(filePath) });

            archive.finalize();

            archive.on('end', resolve);
        });
    }

    /**
     * Extracts a ZIP file from request stream to target directory
     * @param {Object} req - Express request object with ZIP data
     * @param {string} targetPath - Absolute path to extract to
     * @returns {Promise<Object>} Object with extracted files info
     */
    static async extractZipToDirectory(req, targetPath) {
        // Ensure target directory exists
        await fsPromises.mkdir(targetPath, { recursive: true });

        return new Promise((resolve, reject) => {
            const extractedFiles = [];

            req.pipe(unzipper.Parse())
                .on('entry', async (entry) => {
                    const fileName = entry.path;
                    const type = entry.type; // 'Directory' or 'File'
                    const fullPath = path.join(targetPath, fileName);

                    if (type === 'Directory') {
                        // Create directory
                        await fsPromises.mkdir(fullPath, { recursive: true });
                        extractedFiles.push({ path: fileName, type: 'directory' });
                        entry.autodrain();
                    } else {
                        // Ensure parent directory exists
                        const parentDir = path.dirname(fullPath);
                        await fsPromises.mkdir(parentDir, { recursive: true });

                        // Extract file
                        entry.pipe(fs.createWriteStream(fullPath))
                            .on('finish', () => {
                                extractedFiles.push({ path: fileName, type: 'file' });
                            })
                            .on('error', reject);
                    }
                })
                .on('error', reject)
                .on('close', () => {
                    resolve({
                        extractedFiles,
                        count: extractedFiles.length,
                        targetPath
                    });
                });
        });
    }

    /**
     * Validates that a request contains ZIP data
     * @param {Object} req - Express request object
     * @returns {boolean} True if request appears to contain ZIP data
     */
    static isZipRequest(req) {
        const contentType = req.headers['content-type'] || '';
        return contentType.includes('application/zip') ||
               contentType.includes('application/x-zip-compressed');
    }

    /**
     * Checks if client accepts ZIP responses
     * @param {Object} req - Express request object
     * @returns {boolean} True if client accepts ZIP
     */
    static acceptsZip(req) {
        const accept = req.headers['accept'] || '';
        return accept.includes('application/zip') ||
               accept.includes('*/*');
    }
}

module.exports = ZipHandler;
