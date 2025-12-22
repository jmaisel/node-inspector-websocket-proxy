#!/usr/bin/env node

/**
 * Quick validation script to check test setup
 */

const fs = require('fs');
const path = require('path');

console.log('Validating test setup...\n');

const checks = [
    {
        name: 'Unit test HTML exists',
        check: () => fs.existsSync('test/debugger-ui-unit.html')
    },
    {
        name: 'Unit tests exist',
        check: () => fs.existsSync('test/debugger-ui-unit.test.js')
    },
    {
        name: 'E2E tests exist',
        check: () => fs.existsSync('test/debugger-ui-e2e.test.js')
    },
    {
        name: 'Test runner exists',
        check: () => fs.existsSync('test/run-ui-tests.js')
    },
    {
        name: 'Busy script fixture exists',
        check: () => fs.existsSync('test/fixtures/busy-script.js')
    },
    {
        name: 'Debugger HTML exists',
        check: () => fs.existsSync('debugger/debugger.html')
    },
    {
        name: 'Main.js exists',
        check: () => fs.existsSync('debugger/main.js')
    },
    {
        name: 'Proxy factory exists',
        check: () => fs.existsSync('inspector-proxy-factory.js')
    },
    {
        name: 'package.json has test scripts',
        check: () => {
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            return pkg.scripts['test:ui:e2e'] && pkg.scripts['test:ui:unit'];
        }
    },
    {
        name: 'Selenium webdriver installed',
        check: () => {
            try {
                require.resolve('selenium-webdriver');
                return true;
            } catch {
                return false;
            }
        }
    },
    {
        name: 'ChromeDriver installed',
        check: () => {
            try {
                require.resolve('chromedriver');
                return true;
            } catch {
                return false;
            }
        }
    },
    {
        name: 'Mocha installed',
        check: () => {
            try {
                require.resolve('mocha');
                return true;
            } catch {
                return false;
            }
        }
    },
    {
        name: 'Chai installed',
        check: () => {
            try {
                require.resolve('chai');
                return true;
            } catch {
                return false;
            }
        }
    }
];

let allPassed = true;

checks.forEach(({ name, check }) => {
    const passed = check();
    const status = passed ? '✓' : '✗';
    const color = passed ? '\x1b[32m' : '\x1b[31m';
    console.log(`${color}${status}\x1b[0m ${name}`);
    if (!passed) allPassed = false;
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
    console.log('\x1b[32m✓ All checks passed! Test setup is ready.\x1b[0m\n');
    console.log('Next steps:');
    console.log('  1. Run unit tests: open test/debugger-ui-unit.html in browser');
    console.log('  2. Run E2E tests: npm run test:ui:e2e');
    console.log('  3. Run all tests: npm run test:all\n');
    process.exit(0);
} else {
    console.log('\x1b[31m✗ Some checks failed. Please fix issues above.\x1b[0m\n');
    process.exit(1);
}
