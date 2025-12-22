/**
 * E2E tests for event-driven step behavior
 * Verifies that step commands are decoupled from events
 * Runs with Selenium WebDriver and a real debuggee process
 *
 * Prerequisites:
 * - Automatically starts servers if not already running
 * - Requires http-server on port 8080 for serving debugger UI
 * - Checks for existing servers before spawning
 *
 * Run with: npm run test:event-driven
 * Run with visible browser: HEADED=true npm run test:event-driven
 */

const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');
const { createServerManager, isPortInUse } = require('./helpers/server-manager');

describe('Event-Driven Step Commands E2E Tests', function() {
    this.timeout(60000);
    let driver;
    let serverManager;
    const isHeaded = process.env.HEADED === 'true' || process.argv.includes('--headed');

    before(async function() {
        // Check if HTTP server is running on port 8080
        const httpServerRunning = await isPortInUse(8080);
        if (!httpServerRunning) {
            console.warn('\nWARNING: No HTTP server detected on port 8080');
            console.warn('Please start http-server manually: http-server');
            console.warn('This test requires the debugger UI to be served via HTTP\n');
            throw new Error('HTTP server required on port 8080 (run: http-server)');
        }

        // Create server manager for proxy and debuggee
        serverManager = createServerManager({
            checkExisting: true,
            proxyPort: 8888,
            inspectPort: 9229,
            debugScript: 'test/fixtures/busy-script.js'
        });

        // Start servers (or detect existing ones)
        console.log('Setting up test servers...');
        await serverManager.start();

        console.log('Initializing Selenium WebDriver...');
        console.log(`Running in ${isHeaded ? 'HEADED' : 'HEADLESS'} mode`);

        const chromeOptions = new chrome.Options();
        if (!isHeaded) {
            chromeOptions.addArguments('--headless=new');
        }
        chromeOptions.addArguments(
            '--disable-gpu',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1920,1080'
        );

        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(chromeOptions)
            .build();

        console.log('WebDriver initialized');
    });

    after(async function() {
        if (driver) {
            await driver.quit();
        }
        if (serverManager) {
            await serverManager.stop();
        }
    });

    describe('Step Command Resolution', () => {
        it('should immediately resolve step commands without waiting for paused event', async () => {
            // Navigate to debugger
            await driver.get('http://localhost:8080/debugger/debugger.html');
            await driver.wait(until.titleIs('Node.js Inspector Debugger'), 5000);

            // Connect
            const connectBtn = await driver.wait(until.elementLocated(By.id('connectBtn')), 5000);
            await connectBtn.click();

            // Wait for connection
            await driver.wait(async () => {
                const statusText = await driver.findElement(By.id('statusText')).getText();
                return statusText === 'Connected';
            }, 5000);

            // Wait a moment for scripts to load
            await driver.sleep(1000);

            // Pause execution
            const pauseBtn = await driver.findElement(By.id('pauseBtn'));
            await driver.executeScript('arguments[0].click();', pauseBtn);

            // Wait for paused status
            await driver.wait(async () => {
                const statusText = await driver.findElement(By.id('statusText')).getText();
                return statusText === 'Paused';
            }, 5000);

            // Record timestamp before step
            const startTime = Date.now();

            // Click step over button - this should return quickly
            const stepOverBtn = await driver.findElement(By.id('stepOverBtn'));
            await driver.executeScript('arguments[0].click();', stepOverBtn);

            // Measure how long it took for the click to complete
            const clickDuration = Date.now() - startTime;

            // The click should complete almost immediately (< 500ms)
            // even though the debugger still needs to emit events
            assert.ok(clickDuration < 500, `Click should complete quickly (took ${clickDuration}ms)`);

            // Verify we're still in a paused state after step
            await driver.wait(async () => {
                const statusText = await driver.findElement(By.id('statusText')).getText();
                return statusText === 'Paused';
            }, 5000);

            console.log(`✓ Step command completed in ${clickDuration}ms`);
        });

        it('should handle multiple rapid step commands without blocking', async () => {
            // Should still be paused from previous test
            const statusText = await driver.findElement(By.id('statusText')).getText();
            assert.strictEqual(statusText, 'Paused');

            // Issue multiple step commands rapidly
            const stepOverBtn = await driver.findElement(By.id('stepOverBtn'));

            const startTime = Date.now();

            // Click 3 times rapidly
            await driver.executeScript('arguments[0].click();', stepOverBtn);
            await driver.sleep(100); // Small delay to let first step process

            await driver.executeScript('arguments[0].click();', stepOverBtn);
            await driver.sleep(100);

            await driver.executeScript('arguments[0].click();', stepOverBtn);

            const totalTime = Date.now() - startTime;

            // All clicks should complete quickly
            assert.ok(totalTime < 1000, `Multiple steps should complete quickly (took ${totalTime}ms)`);

            // Should still be paused after all steps
            await driver.wait(async () => {
                const status = await driver.findElement(By.id('statusText')).getText();
                return status === 'Paused';
            }, 5000);

            console.log(`✓ Multiple step commands completed in ${totalTime}ms`);
        });
    });

    describe('Event-Driven UI Updates', () => {
        it('should auto-focus call stack tab when paused (on any pause event)', async () => {
            // Switch to a different tab first
            const consoleTab = await driver.findElement(By.css('.tab-btn[data-tab="console"]'));
            await driver.executeScript('arguments[0].click();', consoleTab);

            // Verify console tab is active
            const consoleTabClass = await consoleTab.getAttribute('class');
            assert.ok(consoleTabClass.includes('active'), 'Console tab should be active');

            // Now issue a step command - should auto-switch to call stack tab
            const stepOverBtn = await driver.findElement(By.id('stepOverBtn'));
            await driver.executeScript('arguments[0].click();', stepOverBtn);

            // Wait for call stack tab to become active (event-driven behavior)
            await driver.wait(async () => {
                const callStackTab = await driver.findElement(By.css('.tab-btn[data-tab="callstack"]'));
                const tabClass = await callStackTab.getAttribute('class');
                return tabClass.includes('active');
            }, 5000);

            console.log('✓ Call stack tab auto-focused after step (event-driven)');
        });

        it('should not clear call stack during Debugger.resumed event', async () => {
            // Should be paused with call stack visible
            const statusText = await driver.findElement(By.id('statusText')).getText();
            assert.strictEqual(statusText, 'Paused');

            // Get call stack content
            const callStackContent = await driver.findElement(By.id('callstack')).getText();
            assert.ok(callStackContent.length > 0, 'Call stack should have content');
            assert.ok(!callStackContent.includes('Pause execution to see call stack'),
                'Should show actual call frames, not empty state');

            // Issue a step command - this triggers Debugger.resumed then Debugger.paused
            const stepOverBtn = await driver.findElement(By.id('stepOverBtn'));
            await driver.executeScript('arguments[0].click();', stepOverBtn);

            // Give it a moment to process the events
            await driver.sleep(200);

            // Call stack should never be empty (no flicker)
            // Even during the transient "resumed" state, it should show last known state
            const callStackDuringStep = await driver.findElement(By.id('callstack')).getText();
            assert.ok(callStackDuringStep.length > 0, 'Call stack should remain visible during step');

            console.log('✓ Call stack remained visible during step (no flicker)');
        });

        it('should keep scope visible during resume/pause cycles', async () => {
            // Should be paused with scope visible
            const scopeContent = await driver.findElement(By.id('scopeVariables')).getText();
            assert.ok(scopeContent.length > 0, 'Scope should have content');

            // Issue a step command
            const stepOverBtn = await driver.findElement(By.id('stepOverBtn'));
            await driver.executeScript('arguments[0].click();', stepOverBtn);

            // Wait for step to complete
            await driver.sleep(300);

            // Scope should still be visible (last known state)
            const scopeAfterStep = await driver.findElement(By.id('scopeVariables')).getText();
            assert.ok(scopeAfterStep.length > 0, 'Scope should remain visible after step');

            console.log('✓ Scope remained visible during step cycle');
        });
    });

    describe('Independent Command Execution', () => {
        it('should allow pause/resume to work independently from steps', async () => {
            // Should be paused from previous tests
            let statusText = await driver.findElement(By.id('statusText')).getText();
            assert.strictEqual(statusText, 'Paused');

            // Resume execution
            const resumeBtn = await driver.findElement(By.id('resumeBtn'));
            await driver.executeScript('arguments[0].click();', resumeBtn);

            // Wait for running status
            await driver.wait(async () => {
                const status = await driver.findElement(By.id('statusText')).getText();
                return status === 'Running';
            }, 5000);

            // Wait a moment
            await driver.sleep(500);

            // Pause again
            const pauseBtn = await driver.findElement(By.id('pauseBtn'));
            await driver.executeScript('arguments[0].click();', pauseBtn);

            // Wait for paused status
            await driver.wait(async () => {
                const status = await driver.findElement(By.id('statusText')).getText();
                return status === 'Paused';
            }, 5000);

            // Now issue a step - should work fine
            const stepOverBtn = await driver.findElement(By.id('stepOverBtn'));
            await driver.executeScript('arguments[0].click();', stepOverBtn);

            // Should still be paused after step
            await driver.wait(async () => {
                const status = await driver.findElement(By.id('statusText')).getText();
                return status === 'Paused';
            }, 5000);

            console.log('✓ Pause/resume work independently from step commands');
        });
    });
});
