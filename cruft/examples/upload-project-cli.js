#!/usr/bin/env node

/**
 * Command-line example: Upload a project to the workspace
 *
 * Usage:
 *   node upload-project-cli.js <zipfile> [upload-path]
 *
 * Examples:
 *   node upload-project-cli.js my-project.zip /
 *   node upload-project-cli.js my-project.zip /my-project
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const API_BASE = 'http://localhost:8080';
const API_KEY = 'dev-key-123';

// Parse command line arguments
const zipFile = process.argv[2];
const uploadPath = process.argv[3] || '/';

if (!zipFile) {
    console.error('Usage: node upload-project-cli.js <zipfile> [upload-path]');
    console.error('');
    console.error('Examples:');
    console.error('  node upload-project-cli.js my-project.zip /');
    console.error('  node upload-project-cli.js my-project.zip /my-project');
    process.exit(1);
}

// Check if file exists
if (!fs.existsSync(zipFile)) {
    console.error(`Error: File not found: ${zipFile}`);
    process.exit(1);
}

console.log('='.repeat(70));
console.log('Upload Project to Workspace');
console.log('='.repeat(70));
console.log('');

/**
 * Step 1: Check workspace info
 */
async function checkWorkspace() {
    console.log('[1/3] Checking workspace...');

    return new Promise((resolve, reject) => {
        const url = new URL('/workspace/info', API_BASE);

        http.get(url, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    return;
                }

                try {
                    const info = JSON.parse(data);
                    console.log('  Workspace Root:', info.workspaceRoot);
                    console.log('  API Version:', info.apiVersion);
                    console.log('  Features: upload=' + info.features.upload + ', download=' + info.features.download);
                    console.log('');
                    resolve(info);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

/**
 * Step 2: Upload ZIP file
 */
async function uploadProject(filePath, targetPath) {
    console.log('[2/3] Uploading project...');
    console.log('  File:', filePath);
    console.log('  Target:', targetPath);

    return new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(filePath);
        const fileSize = fs.statSync(filePath).size;

        const url = new URL(`/project${targetPath}`, API_BASE);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'X-Workspace-API-Key': API_KEY,
                'Content-Type': 'application/zip',
                'Content-Length': fileSize
            }
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 201) {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    return;
                }

                try {
                    const result = JSON.parse(data);
                    console.log('  Success! Files extracted:', result.filesExtracted);
                    console.log('  Total size:', (result.totalSize / 1024).toFixed(2), 'KB');
                    console.log('');
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', reject);

        // Pipe file to request
        fileStream.pipe(req);
    });
}

/**
 * Step 3: Browse uploaded files
 */
async function browseFiles(targetPath) {
    console.log('[3/3] Browsing uploaded files...');

    return new Promise((resolve, reject) => {
        const url = new URL(`/project${targetPath}`, API_BASE);

        http.get(url, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    return;
                }

                try {
                    const result = JSON.parse(data);
                    console.log('  Path:', result.path);
                    console.log('  Contents:');

                    if (result.contents) {
                        result.contents.forEach(item => {
                            const icon = item.type === 'directory' ? '[DIR]' : '[FILE]';
                            const size = item.type === 'file' ? ` (${(item.size / 1024).toFixed(2)} KB)` : '';
                            console.log(`    ${icon} ${item.name}${size}`);
                        });
                    }

                    console.log('');
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

/**
 * Optional: Start debug session
 */
async function startDebugSession(filePath) {
    console.log('[Optional] Starting debug session...');
    console.log('  File:', filePath);

    return new Promise((resolve, reject) => {
        const url = new URL('/debug/session', API_BASE);
        const postData = JSON.stringify({ file: filePath });

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 201) {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    return;
                }

                try {
                    const result = JSON.parse(data);
                    console.log('  Session ID:', result.session.sessionId);
                    console.log('  WebSocket URL:', result.session.wsUrl);
                    console.log('  Status:', result.session.status);
                    console.log('');
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

/**
 * Main execution
 */
async function main() {
    try {
        // Step 1: Check workspace
        await checkWorkspace();

        // Step 2: Upload project
        const uploadResult = await uploadProject(zipFile, uploadPath);

        // Step 3: Browse files
        await browseFiles(uploadPath);

        console.log('='.repeat(70));
        console.log('Upload completed successfully!');
        console.log('='.repeat(70));
        console.log('');
        console.log('Next steps:');
        console.log('  1. Browse workspace: http://localhost:8080/examples/workspace-browser-demo.html');
        console.log('  2. View server status: http://localhost:8080/');
        console.log('  3. Start debugging a file using the debug session API');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('Error:', error.message);
        console.error('');
        process.exit(1);
    }
}

// Run main
main();