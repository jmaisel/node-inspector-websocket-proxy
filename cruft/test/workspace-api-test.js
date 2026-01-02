/**
 * Workspace API Test Suite
 * Tests all workspace REST API endpoints
 */

const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');

const BASE_URL = 'http://localhost:8080';
const API_KEY = 'dev-key-123';
const TEST_DIR = path.join(__dirname, 'workspace-test-temp');

// ANSI color codes for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

/**
 * Make HTTP request
 */
function request(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', reject);

        if (body) {
            if (Buffer.isBuffer(body)) {
                req.write(body);
            } else {
                req.write(body);
            }
        }

        req.end();
    });
}

/**
 * Create a test ZIP file
 */
async function createTestZip(files) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('data', (chunk) => chunks.push(chunk));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.on('error', reject);

        // Add files to archive
        for (const [name, content] of Object.entries(files)) {
            archive.append(content, { name });
        }

        archive.finalize();
    });
}

/**
 * Test runner
 */
class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log(`\n${colors.blue}Running Workspace API Tests${colors.reset}\n`);

        for (const { name, fn } of this.tests) {
            try {
                await fn();
                console.log(`${colors.green}✓${colors.reset} ${name}`);
                this.passed++;
            } catch (err) {
                console.log(`${colors.red}✗${colors.reset} ${name}`);
                console.log(`  ${colors.red}Error: ${err.message}${colors.reset}`);
                this.failed++;
            }
        }

        console.log(`\n${colors.blue}Results:${colors.reset}`);
        console.log(`  ${colors.green}Passed: ${this.passed}${colors.reset}`);
        console.log(`  ${colors.red}Failed: ${this.failed}${colors.reset}`);
        console.log(`  Total: ${this.passed + this.failed}\n`);

        return this.failed === 0;
    }
}

// Create test runner
const runner = new TestRunner();

// Test 1: GET /project/ - List root directory
runner.test('GET /project/ returns JSON directory listing', async () => {
    const res = await request({
        hostname: 'localhost',
        port: 8080,
        path: '/project/',
        method: 'GET'
    });

    if (res.statusCode !== 200) {
        throw new Error(`Expected status 200, got ${res.statusCode}`);
    }

    const data = JSON.parse(res.body);
    if (data.type !== 'directory') {
        throw new Error(`Expected type 'directory', got '${data.type}'`);
    }

    if (!Array.isArray(data.contents)) {
        throw new Error('Expected contents to be an array');
    }
});

// Test 2: GET /project/package.json - Get specific file
runner.test('GET /project/package.json returns file content', async () => {
    const res = await request({
        hostname: 'localhost',
        port: 8080,
        path: '/project/package.json',
        method: 'GET'
    });

    if (res.statusCode !== 200) {
        throw new Error(`Expected status 200, got ${res.statusCode}`);
    }

    const data = JSON.parse(res.body);
    if (!data.name) {
        throw new Error('Expected package.json to have a name field');
    }
});

// Test 3: GET directory as ZIP
runner.test('GET /project/server/ with Accept: application/zip returns ZIP', async () => {
    const res = await request({
        hostname: 'localhost',
        port: 8080,
        path: '/project/server/',
        method: 'GET',
        headers: {
            'Accept': 'application/zip'
        }
    });

    if (res.statusCode !== 200) {
        throw new Error(`Expected status 200, got ${res.statusCode}`);
    }

    if (!res.headers['content-type']?.includes('application/zip')) {
        throw new Error('Expected Content-Type to be application/zip');
    }

    // Check ZIP signature
    if (!res.body.startsWith('PK')) {
        throw new Error('Response does not appear to be a ZIP file');
    }
});

// Test 4: PUT without authentication fails
runner.test('PUT /project/ without API key returns 401', async () => {
    const zipData = await createTestZip({ 'test.txt': 'test content' });

    const res = await request({
        hostname: 'localhost',
        port: 8080,
        path: '/project/test-no-auth/',
        method: 'PUT',
        headers: {
            'Content-Type': 'application/zip',
            'Content-Length': zipData.length
        }
    }, zipData);

    if (res.statusCode !== 401) {
        throw new Error(`Expected status 401, got ${res.statusCode}`);
    }
});

// Test 5: PUT with invalid API key fails
runner.test('PUT /project/ with invalid API key returns 403', async () => {
    const zipData = await createTestZip({ 'test.txt': 'test content' });

    const res = await request({
        hostname: 'localhost',
        port: 8080,
        path: '/project/test-bad-auth/',
        method: 'PUT',
        headers: {
            'Content-Type': 'application/zip',
            'Content-Length': zipData.length,
            'X-Workspace-API-Key': 'invalid-key'
        }
    }, zipData);

    if (res.statusCode !== 403) {
        throw new Error(`Expected status 403, got ${res.statusCode}`);
    }
});

// Test 6: PUT with valid API key succeeds
runner.test('PUT /project/test-upload/ with valid API key succeeds', async () => {
    const zipData = await createTestZip({
        'hello.txt': 'Hello World',
        'nested/file.txt': 'Nested content'
    });

    const res = await request({
        hostname: 'localhost',
        port: 8080,
        path: '/project/test-upload/',
        method: 'PUT',
        headers: {
            'Content-Type': 'application/zip',
            'Content-Length': zipData.length,
            'X-Workspace-API-Key': API_KEY
        }
    }, zipData);

    if (res.statusCode !== 201) {
        throw new Error(`Expected status 201, got ${res.statusCode}: ${res.body}`);
    }

    const data = JSON.parse(res.body);
    if (!data.success) {
        throw new Error('Expected success to be true');
    }
});

// Test 7: Verify uploaded files exist
runner.test('GET /project/test-upload/ shows uploaded files', async () => {
    const res = await request({
        hostname: 'localhost',
        port: 8080,
        path: '/project/test-upload/',
        method: 'GET'
    });

    if (res.statusCode !== 200) {
        throw new Error(`Expected status 200, got ${res.statusCode}`);
    }

    const data = JSON.parse(res.body);
    const fileNames = data.contents.map(f => f.name);

    if (!fileNames.includes('hello.txt')) {
        throw new Error('Expected to find hello.txt');
    }

    if (!fileNames.includes('nested')) {
        throw new Error('Expected to find nested directory');
    }
});

// Test 8: POST also works for uploads
runner.test('POST /project/test-post/ with valid API key succeeds', async () => {
    const zipData = await createTestZip({ 'post-test.txt': 'POST content' });

    const res = await request({
        hostname: 'localhost',
        port: 8080,
        path: '/project/test-post/',
        method: 'POST',
        headers: {
            'Content-Type': 'application/zip',
            'Content-Length': zipData.length,
            'X-Workspace-API-Key': API_KEY
        }
    }, zipData);

    if (res.statusCode !== 201) {
        throw new Error(`Expected status 201, got ${res.statusCode}`);
    }
});

// Test 9: PATCH also works for uploads
runner.test('PATCH /project/test-patch/ with valid API key succeeds', async () => {
    const zipData = await createTestZip({ 'patch-test.txt': 'PATCH content' });

    const res = await request({
        hostname: 'localhost',
        port: 8080,
        path: '/project/test-patch/',
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/zip',
            'Content-Length': zipData.length,
            'X-Workspace-API-Key': API_KEY
        }
    }, zipData);

    if (res.statusCode !== 201) {
        throw new Error(`Expected status 201, got ${res.statusCode}`);
    }
});

// Test 10: GET non-existent file returns 404
runner.test('GET /project/nonexistent.txt returns 404', async () => {
    const res = await request({
        hostname: 'localhost',
        port: 8080,
        path: '/project/nonexistent.txt',
        method: 'GET'
    });

    if (res.statusCode !== 404) {
        throw new Error(`Expected status 404, got ${res.statusCode}`);
    }
});

// Cleanup function
async function cleanup() {
    try {
        const rimraf = (await import('fs')).promises.rm;
        await rimraf(path.join(process.cwd(), 'test-upload'), { recursive: true, force: true });
        await rimraf(path.join(process.cwd(), 'test-post'), { recursive: true, force: true });
        await rimraf(path.join(process.cwd(), 'test-patch'), { recursive: true, force: true });
    } catch (err) {
        // Ignore cleanup errors
    }
}

// Run tests
(async () => {
    try {
        const success = await runner.run();

        // Cleanup test files
        await cleanup();

        process.exit(success ? 0 : 1);
    } catch (err) {
        console.error('Test runner error:', err);
        await cleanup();
        process.exit(1);
    }
})();
