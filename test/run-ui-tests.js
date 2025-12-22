#!/usr/bin/env node

/**
 * Test runner for debugger UI tests
 * Starts necessary services and runs tests with reporting
 *
 * Note: Tests now manage their own server lifecycle using the shared ServerManager.
 * This script is kept for backwards compatibility and convenience.
 *
 * Usage:
 *   node run-ui-tests.js e2e              # Run headless E2E tests
 *   node run-ui-tests.js e2e --headed     # Run with visible browser
 *   node run-ui-tests.js e2e --report     # Generate HTML report
 *   node run-ui-tests.js unit             # Info about unit tests
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const testType = args[0] || 'e2e';
const isHeaded = args.includes('--headed') || args.includes('--visible');
const generateReport = args.includes('--report') || args.includes('--html');

// Run Mocha tests with optional reporting
function runTests(testFile) {
    return new Promise((resolve, reject) => {
        console.log(`\nRunning tests: ${testFile}`);
        console.log(`Mode: ${isHeaded ? 'HEADED (visible browser)' : 'HEADLESS'}`);
        console.log(`Report: ${generateReport ? 'YES' : 'NO'}`);
        console.log('Note: Tests will automatically start/detect servers\n');

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

// Main execution
async function main() {
    try {
        if (testType === 'e2e') {
            // E2E tests manage their own servers via ServerManager
            await runTests('test/debugger-ui-e2e.test.js');
            console.log('\n✓ All tests passed!\n');
            process.exit(0);
        } else if (testType === 'unit') {
            // Unit tests can run directly in browser
            console.log('To run unit tests, open test/debugger-ui-unit.html in a browser');
            console.log('Or use: npx mocha-headless-chrome test/debugger-ui-unit.html');
            process.exit(0);
        } else {
            console.error(`Unknown test type: ${testType}`);
            console.error('Usage: node run-ui-tests.js [e2e|unit] [--headed] [--report]');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n✗ Tests failed:', error.message, '\n');
        process.exit(1);
    }
}

// Handle signals
process.on('SIGINT', () => {
    console.log('\nInterrupted');
    process.exit(130);
});

process.on('SIGTERM', () => {
    console.log('\nTerminated');
    process.exit(143);
});

// Run
if (require.main === module) {
    main();
}
