#!/usr/bin/env node

/**
 * Test runner for debugger UI tests
 * Starts necessary services and runs tests with reporting
 *
 * Usage:
 *   node run-ui-tests.js e2e              # Run headless E2E tests
 *   node run-ui-tests.js e2e --headed     # Run with visible browser
 *   node run-ui-tests.js e2e --report     # Generate HTML report
 */

const { spawn } = require('child_process');
const { promisify } = require('util');
const sleep = promisify(setTimeout);
const http = require('http');
const path = require('path');
const fs = require('fs');

let proxyServer = null;
let debuggeeProcess = null;

// Parse command line arguments
const args = process.argv.slice(2);
const testType = args[0] || 'e2e';
const isHeaded = args.includes('--headed') || args.includes('--visible');
const generateReport = args.includes('--report') || args.includes('--html');

// Utility to check if server is running
function checkServer(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}`, () => {
            resolve(true);
        });
        req.on('error', () => {
            resolve(false);
        });
        req.end();
    });
}

// Start proxy server
async function startProxyServer() {
    console.log('Starting proxy server...');

    proxyServer = spawn('node', ['inspector-proxy-factory.js'], {
        stdio: 'pipe',
        detached: false
    });

    proxyServer.stdout.on('data', (data) => {
        console.log(`[Proxy] ${data.toString().trim()}`);
    });

    proxyServer.stderr.on('data', (data) => {
        console.error(`[Proxy Error] ${data.toString().trim()}`);
    });

    // Wait for server to be ready
    for (let i = 0; i < 30; i++) {
        await sleep(500);
        const isRunning = await checkServer(8888);
        if (isRunning) {
            console.log('Proxy server is ready');
            return;
        }
    }

    throw new Error('Proxy server failed to start');
}

// Start debuggee process
async function startDebuggee() {
    console.log('Starting debuggee process...');

    debuggeeProcess = spawn('node', ['--inspect=9229', 'test/fixtures/busy-script.js'], {
        stdio: 'pipe',
        detached: false
    });

    debuggeeProcess.stdout.on('data', (data) => {
        console.log(`[Debuggee] ${data.toString().trim()}`);
    });

    debuggeeProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes('Debugger listening')) {
            console.log('Debuggee is ready');
        }
    });

    // Wait for debuggee to be ready
    await sleep(2000);
}

// Run Mocha tests with optional reporting
function runTests(testFile) {
    return new Promise((resolve, reject) => {
        console.log(`\nRunning tests: ${testFile}`);
        console.log(`Mode: ${isHeaded ? 'HEADED (visible browser)' : 'HEADLESS'}`);
        console.log(`Report: ${generateReport ? 'YES' : 'NO'}\n`);

        const mochaArgs = [testFile];

        // Add reporter configuration
        if (generateReport) {
            // Create reports directory if it doesn't exist
            const reportsDir = path.join(__dirname, '../test-reports');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }

            mochaArgs.push(
                '--reporter', 'mochawesome',
                '--reporter-options',
                `reportDir=test-reports,reportFilename=ui-test-report,reportTitle=Debugger UI Test Report,reportPageTitle=Test Results,inline=true,charts=true,code=true`
            );
        }

        // Set environment variable for headed mode
        const env = { ...process.env };
        if (isHeaded) {
            env.HEADED_MODE = 'true';
        }

        const mocha = spawn('npx', ['mocha', ...mochaArgs], {
            stdio: 'inherit',
            env
        });

        mocha.on('close', (code) => {
            if (generateReport) {
                console.log('\n📊 Test report generated: test-reports/ui-test-report.html');
                console.log(`   Open with: open test-reports/ui-test-report.html\n`);
            }

            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Tests failed with exit code ${code}`));
            }
        });

        mocha.on('error', (err) => {
            reject(err);
        });
    });
}

// Cleanup
function cleanup() {
    console.log('\nCleaning up...');

    if (debuggeeProcess) {
        debuggeeProcess.kill('SIGTERM');
        debuggeeProcess = null;
    }

    if (proxyServer) {
        proxyServer.kill('SIGTERM');
        proxyServer = null;
    }
}

// Main execution
async function main() {
    try {
        if (testType === 'e2e') {
            // E2E tests need server and debuggee
            await startProxyServer();
            await startDebuggee();
            await runTests('test/debugger-ui-e2e.test.js');
        } else if (testType === 'unit') {
            // Unit tests can run directly in browser
            console.log('To run unit tests, open test/debugger-ui-unit.html in a browser');
            console.log('Or use: npx mocha-headless-chrome test/debugger-ui-unit.html');
        } else {
            console.error(`Unknown test type: ${testType}`);
            console.error('Usage: node run-ui-tests.js [e2e|unit] [--headed] [--report]');
            process.exit(1);
        }

        console.log('\n✓ All tests passed!\n');
        cleanup();
        process.exit(0);

    } catch (error) {
        console.error('\n✗ Tests failed:', error.message, '\n');
        cleanup();
        process.exit(1);
    }
}

// Handle signals
process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
});

process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
});

// Run
if (require.main === module) {
    main();
}

module.exports = { startProxyServer, startDebuggee, cleanup };
