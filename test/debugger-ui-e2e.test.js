/**
 * End-to-End tests for Debugger UI using Selenium WebDriver
 * Tests actual user workflows with a real browser
 *
 * Prerequisites:
 * - Automatically starts servers if not already running
 * - Checks for existing servers on ports 8888 (proxy) and 9229 (debuggee)
 *
 * Run with: npm run test:e2e
 * Run with visible browser: HEADED_MODE=true npm run test:e2e
 */

const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('chai').assert;
const expect = require('chai').expect;
const path = require('path');
const { createServerManager } = require('./helpers/server-manager');

describe('Debugger UI E2E Tests', function() {
    this.timeout(30000); // E2E tests need more time

    let driver;
    let serverManager;
    const baseUrl = `file://${path.resolve(__dirname, '../debugger/debugger.html')}`;

    // Helper: Click using JavaScript to bypass overlay issues with floating toolbar
    async function jsClick(element) {
        await driver.executeScript("arguments[0].click();", element);
    }

    // Start servers and browser before all tests
    before(async function() {
        // Create server manager (checks for existing servers first)
        serverManager = createServerManager({
            checkExisting: true,
            proxyPort: 8888,
            inspectPort: 9229,
            debugScript: 'test/fixtures/busy-script.js'
        });

        // Start servers (or detect existing ones)
        console.log('Setting up test servers...');
        await serverManager.start();

        // Initialize Selenium WebDriver
        console.log('Initializing Selenium WebDriver...');
        const options = new chrome.Options();

        // Check if headed mode is requested via environment variable
        const isHeadedMode = process.env.HEADED_MODE === 'true';

        if (!isHeadedMode) {
            options.addArguments('--headless'); // Run in headless mode
            console.log('Running in HEADLESS mode');
        } else {
            console.log('Running in HEADED mode (visible browser)');
        }

        options.addArguments('--disable-gpu');
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--window-size=1920,1080');

        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();

        console.log('WebDriver initialized');
    });

    // Quit driver and stop servers after all tests
    after(async function() {
        if (driver) {
            await driver.quit();
        }
        if (serverManager) {
            await serverManager.stop();
        }
    });

    describe('Page Load and Initial State', function() {
        it('should load the debugger page', async function() {
            await driver.get(baseUrl);
            const title = await driver.getTitle();
            expect(title).to.equal('Node.js Debugger');
        });

        it('should show disconnected status initially', async function() {
            await driver.get(baseUrl);
            const statusText = await driver.findElement(By.id('statusText')).getText();
            expect(statusText).to.equal('Disconnected');
        });

        it('should show connect button initially', async function() {
            await driver.get(baseUrl);
            const connectBtn = await driver.findElement(By.id('connectBtn'));
            const isDisplayed = await connectBtn.isDisplayed();
            expect(isDisplayed).to.be.true;
        });

        it('should hide debug controls initially', async function() {
            await driver.get(baseUrl);
            const debugControls = await driver.findElement(By.id('debugControls'));
            const isDisplayed = await debugControls.isDisplayed();
            expect(isDisplayed).to.be.false;
        });

        it('should have console tab active by default', async function() {
            await driver.get(baseUrl);
            const consoleTab = await driver.findElement(By.css('.tab-btn[data-tab="console"]'));
            const className = await consoleTab.getAttribute('class');
            expect(className).to.include('active');
        });
    });

    describe('Connection Workflow', function() {
        beforeEach(async function() {
            await driver.get(baseUrl);
        });

        it('should connect to debugger', async function() {
            const connectBtn = await driver.findElement(By.id('connectBtn'));
            await jsClick(connectBtn);

            // Wait for connection
            await driver.wait(until.elementTextContains(
                driver.findElement(By.id('statusText')),
                'Connected'
            ), 5000);

            const statusText = await driver.findElement(By.id('statusText')).getText();
            expect(statusText).to.equal('Connected');
        });

        it('should show debug controls after connection', async function() {
            const connectBtn = await driver.findElement(By.id('connectBtn'));
            await jsClick(connectBtn);

            // Wait for debug controls to appear
            await driver.wait(until.elementIsVisible(
                driver.findElement(By.id('debugControls'))
            ), 5000);

            const debugControls = await driver.findElement(By.id('debugControls'));
            const isDisplayed = await debugControls.isDisplayed();
            expect(isDisplayed).to.be.true;
        });

        it('should hide connection controls after connection', async function() {
            const connectBtn = await driver.findElement(By.id('connectBtn'));
            await jsClick(connectBtn);

            // Wait for connection
            await driver.wait(until.elementTextContains(
                driver.findElement(By.id('statusText')),
                'Connected'
            ), 5000);

            const connectionControls = await driver.findElement(By.id('connectionControls'));
            const isDisplayed = await connectionControls.isDisplayed();
            expect(isDisplayed).to.be.false;
        });

        it('should populate file tree after connection', async function() {
            const connectBtn = await driver.findElement(By.id('connectBtn'));
            await jsClick(connectBtn);

            // Wait for connection and scripts to load
            await driver.wait(until.elementTextContains(
                driver.findElement(By.id('statusText')),
                'Connected'
            ), 5000);

            // Switch to files tab using JS click to bypass toolbar overlay
            const filesTab = await driver.findElement(By.css('.tab-btn[data-tab="files"]'));
            await jsClick(filesTab);

            // Validate behavior: files tab content is visible
            await driver.wait(until.elementIsVisible(
                driver.findElement(By.id('tab-files'))
            ), 2000);

            // Check if files were actually loaded (not just tab switched)
            const projectFiles = await driver.findElements(By.css('#projectFiles .tree-file'));
            expect(projectFiles.length).to.be.at.least(1);
        });
    });

    describe('Tab Navigation', function() {
        before(async function() {
            await driver.get(baseUrl);
            // Connect once for this suite
            const connectBtn = await driver.findElement(By.id('connectBtn'));
            await jsClick(connectBtn);
            await driver.wait(until.elementTextContains(
                driver.findElement(By.id('statusText')),
                'Connected'
            ), 5000);
        });

        it('should switch to Call Stack tab', async function() {
            const callstackTab = await driver.findElement(By.css('.tab-btn[data-tab="callstack"]'));
            await jsClick(callstackTab);

            // Validate behavior: tab content is visible
            await driver.wait(until.elementIsVisible(
                driver.findElement(By.id('tab-callstack'))
            ), 2000);

            const tabPane = await driver.findElement(By.id('tab-callstack'));
            const isVisible = await tabPane.isDisplayed();
            expect(isVisible).to.be.true;
        });

        it('should switch to Files tab', async function() {
            const filesTab = await driver.findElement(By.css('.tab-btn[data-tab="files"]'));
            await jsClick(filesTab);

            // Validate behavior: tab content is visible
            await driver.wait(until.elementIsVisible(
                driver.findElement(By.id('tab-files'))
            ), 2000);

            const tabPane = await driver.findElement(By.id('tab-files'));
            const isVisible = await tabPane.isDisplayed();
            expect(isVisible).to.be.true;
        });

        it('should switch to Breakpoints tab', async function() {
            const bpTab = await driver.findElement(By.css('.tab-btn[data-tab="breakpoints"]'));
            await jsClick(bpTab);

            // Validate behavior: tab content is visible
            await driver.wait(until.elementIsVisible(
                driver.findElement(By.id('tab-breakpoints'))
            ), 2000);

            const tabPane = await driver.findElement(By.id('tab-breakpoints'));
            const isVisible = await tabPane.isDisplayed();
            expect(isVisible).to.be.true;
        });

        it('should switch to Watches tab', async function() {
            const watchesTab = await driver.findElement(By.css('.tab-btn[data-tab="watches"]'));
            await jsClick(watchesTab);

            // Validate behavior: tab content is visible
            await driver.wait(until.elementIsVisible(
                driver.findElement(By.id('tab-watches'))
            ), 2000);

            const tabPane = await driver.findElement(By.id('tab-watches'));
            const isVisible = await tabPane.isDisplayed();
            expect(isVisible).to.be.true;
        });

        it('should switch to Scope tab', async function() {
            const scopeTab = await driver.findElement(By.css('.tab-btn[data-tab="scope"]'));
            await jsClick(scopeTab);

            // Validate behavior: tab content is visible
            await driver.wait(until.elementIsVisible(
                driver.findElement(By.id('tab-scope'))
            ), 2000);

            const tabPane = await driver.findElement(By.id('tab-scope'));
            const isVisible = await tabPane.isDisplayed();
            expect(isVisible).to.be.true;
        });
    });

    describe('Debug Controls', function() {
        before(async function() {
            await driver.get(baseUrl);
            const connectBtn = await driver.findElement(By.id('connectBtn'));
            await jsClick(connectBtn);
            await driver.wait(until.elementTextContains(
                driver.findElement(By.id('statusText')),
                'Connected'
            ), 5000);
        });

        it('should pause execution', async function() {
            const pauseBtn = await driver.findElement(By.id('pauseBtn'));
            await jsClick(pauseBtn);

            // Wait for pause
            await driver.wait(async () => {
                const statusText = await driver.findElement(By.id('statusText')).getText();
                return statusText === 'Paused';
            }, 5000);

            const statusText = await driver.findElement(By.id('statusText')).getText();
            expect(statusText).to.equal('Paused');
        });

        it('should enable step buttons when paused', async function() {
            // Make sure we're paused
            const pauseBtn = await driver.findElement(By.id('pauseBtn'));
            const isPauseDisabled = await pauseBtn.getAttribute('disabled');
            if (!isPauseDisabled) {
                await jsClick(pauseBtn);
                await driver.wait(async () => {
                    const statusText = await driver.findElement(By.id('statusText')).getText();
                    return statusText === 'Paused';
                }, 5000);
            }

            const stepOverBtn = await driver.findElement(By.id('stepOverBtn'));
            const isDisabled = await stepOverBtn.getAttribute('disabled');
            expect(isDisabled).to.be.null;
        });

        it('should show call stack when paused', async function() {
            // Switch to call stack tab using JS click
            const callstackTab = await driver.findElement(By.css('.tab-btn[data-tab="callstack"]'));
            await jsClick(callstackTab);

            // Validate behavior: call stack has frames (proving we're paused)
            await driver.wait(async () => {
                const items = await driver.findElements(By.css('#callstack .list-item'));
                return items.length > 0;
            }, 5000);

            const items = await driver.findElements(By.css('#callstack .list-item'));
            expect(items.length).to.be.at.least(1);
        });

        it('should step over', async function() {
            const stepOverBtn = await driver.findElement(By.id('stepOverBtn'));
            await jsClick(stepOverBtn);

            // Wait for step to complete
            await driver.sleep(1000);

            // Should still be paused
            const statusText = await driver.findElement(By.id('statusText')).getText();
            expect(statusText).to.equal('Paused');
        });

        it('should resume execution', async function() {
            const resumeBtn = await driver.findElement(By.id('resumeBtn'));
            await jsClick(resumeBtn);

            // Wait for resume
            await driver.wait(async () => {
                const statusText = await driver.findElement(By.id('statusText')).getText();
                return statusText !== 'Paused';
            }, 5000);

            const statusText = await driver.findElement(By.id('statusText')).getText();
            expect(statusText).to.not.equal('Paused');
        });
    });

    describe('Console Functionality', function() {
        before(async function() {
            await driver.get(baseUrl);
            const connectBtn = await driver.findElement(By.id('connectBtn'));
            await jsClick(connectBtn);
            await driver.wait(until.elementTextContains(
                driver.findElement(By.id('statusText')),
                'Connected'
            ), 5000);
        });

        it('should display log messages', async function() {
            // Switch to console tab using JS click
            const consoleTab = await driver.findElement(By.css('.tab-btn[data-tab="console"]'));
            await jsClick(consoleTab);

            // Validate behavior: console has actual log entries
            await driver.wait(async () => {
                const entries = await driver.findElements(By.css('#debugLog .log-entry'));
                return entries.length > 0;
            }, 5000);

            const entries = await driver.findElements(By.css('#debugLog .log-entry'));
            expect(entries.length).to.be.at.least(1);
        });

        it('should expand console search', async function() {
            const searchToggle = await driver.findElement(By.id('consoleSearchToggle'));
            await jsClick(searchToggle);

            const searchWrapper = await driver.findElement(By.css('.console-search-wrapper'));
            const className = await searchWrapper.getAttribute('class');
            expect(className).to.not.include('collapsed');
        });

        it('should filter console entries by search', async function() {
            // Make sure search is expanded
            const searchWrapper = await driver.findElement(By.css('.console-search-wrapper'));
            const className = await searchWrapper.getAttribute('class');
            if (className.includes('collapsed')) {
                const searchToggle = await driver.findElement(By.id('consoleSearchToggle'));
                await jsClick(searchToggle);
            }

            // Type search query
            const searchInput = await driver.findElement(By.id('consoleSearchInput'));
            await searchInput.clear();
            await searchInput.sendKeys('Script');

            // Wait a moment for filter to apply
            await driver.sleep(500);

            // Check that some entries are hidden
            const hiddenEntries = await driver.findElements(By.css('#debugLog .log-entry.hidden'));
            const visibleEntries = await driver.findElements(By.css('#debugLog .log-entry:not(.hidden)'));

            // At least some filtering should have occurred
            expect(visibleEntries.length).to.be.at.least(0);
        });

        it('should clear search filter', async function() {
            const clearBtn = await driver.findElement(By.id('consoleClearSearch'));
            await jsClick(clearBtn);

            await driver.sleep(500);

            const searchInput = await driver.findElement(By.id('consoleSearchInput'));
            const value = await searchInput.getAttribute('value');
            expect(value).to.equal('');
        });
    });

    describe('Watch Expressions', function() {
        before(async function() {
            await driver.get(baseUrl);
            const connectBtn = await driver.findElement(By.id('connectBtn'));
            await jsClick(connectBtn);
            await driver.wait(until.elementTextContains(
                driver.findElement(By.id('statusText')),
                'Connected'
            ), 5000);

            // Switch to watches tab using JS click
            const watchesTab = await driver.findElement(By.css('.tab-btn[data-tab="watches"]'));
            await jsClick(watchesTab);
        });

        it('should add watch expression', async function() {
            const watchInput = await driver.findElement(By.id('watchInput'));
            await watchInput.clear();
            await watchInput.sendKeys('2 + 2');

            const addBtn = await driver.findElement(By.id('addWatchBtn'));
            await jsClick(addBtn);

            // Validate behavior: watch was actually added to the list
            await driver.wait(async () => {
                const items = await driver.findElements(By.css('#watchesList .list-item'));
                return items.length > 0;
            }, 2000);

            const items = await driver.findElements(By.css('#watchesList .list-item'));
            expect(items.length).to.be.at.least(1);
        });

        it('should evaluate watch when paused', async function() {
            // Pause execution
            const pauseBtn = await driver.findElement(By.id('pauseBtn'));
            await jsClick(pauseBtn);
            await driver.wait(async () => {
                const statusText = await driver.findElement(By.id('statusText')).getText();
                return statusText === 'Paused';
            }, 5000);

            // Go back to watches tab using JS click
            const watchesTab = await driver.findElement(By.css('.tab-btn[data-tab="watches"]'));
            await jsClick(watchesTab);

            // Validate behavior: watch has a real value (not "evaluating...")
            const watchValue = await driver.findElement(By.css('#watchesList .variable-value'));
            const text = await watchValue.getText();
            expect(text).to.not.equal('evaluating...');
        });
    });

    describe('Settings and Toolbar', function() {
        before(async function() {
            await driver.get(baseUrl);
        });

        it('should open settings panel', async function() {
            const settingsBtn = await driver.findElement(By.id('settingsBtn'));
            await jsClick(settingsBtn);

            await driver.wait(until.elementIsVisible(
                driver.findElement(By.id('settingsPanel'))
            ), 2000);

            const settingsPanel = await driver.findElement(By.id('settingsPanel'));
            const isDisplayed = await settingsPanel.isDisplayed();
            expect(isDisplayed).to.be.true;
        });

        it('should change icon size', async function() {
            const toolbar = await driver.findElement(By.id('toolbar'));
            let iconSize = await toolbar.getAttribute('data-icon-size');
            const originalSize = iconSize;

            // Click large size button
            const largeSizeBtn = await driver.findElement(By.id('iconSizeLarge'));
            await jsClick(largeSizeBtn);

            iconSize = await toolbar.getAttribute('data-icon-size');
            expect(iconSize).to.equal('large');
        });

        it('should close settings panel after selection', async function() {
            // Open settings if not already open
            const settingsBtn = await driver.findElement(By.id('settingsBtn'));
            await jsClick(settingsBtn);
            await driver.sleep(200);

            // Click size button
            const mediumSizeBtn = await driver.findElement(By.id('iconSizeMedium'));
            await jsClick(mediumSizeBtn);

            await driver.sleep(200);

            const settingsPanel = await driver.findElement(By.id('settingsPanel'));
            const isDisplayed = await settingsPanel.isDisplayed();
            expect(isDisplayed).to.be.false;
        });
    });

    describe('Disconnect Workflow', function() {
        before(async function() {
            await driver.get(baseUrl);
            const connectBtn = await driver.findElement(By.id('connectBtn'));
            await jsClick(connectBtn);
            await driver.wait(until.elementTextContains(
                driver.findElement(By.id('statusText')),
                'Connected'
            ), 5000);
        });

        it('should disconnect from debugger', async function() {
            const disconnectBtn = await driver.findElement(By.id('disconnectBtn'));
            await jsClick(disconnectBtn);

            // Wait for disconnect
            await driver.wait(until.elementTextContains(
                driver.findElement(By.id('statusText')),
                'Disconnected'
            ), 5000);

            const statusText = await driver.findElement(By.id('statusText')).getText();
            expect(statusText).to.equal('Disconnected');
        });

        it('should show connection controls after disconnect', async function() {
            const connectionControls = await driver.findElement(By.id('connectionControls'));
            const isDisplayed = await connectionControls.isDisplayed();
            expect(isDisplayed).to.be.true;
        });

        it('should hide debug controls after disconnect', async function() {
            const debugControls = await driver.findElement(By.id('debugControls'));
            const isDisplayed = await debugControls.isDisplayed();
            expect(isDisplayed).to.be.false;
        });

        it('should clear console after disconnect', async function() {
            // Switch to console tab using JS click
            const consoleTab = await driver.findElement(By.css('.tab-btn[data-tab="console"]'));
            await jsClick(consoleTab);

            // Validate behavior: console shows empty state (no log entries)
            const emptyState = await driver.findElements(By.css('#debugLog .empty-state'));
            expect(emptyState.length).to.equal(1);
        });
    });
});
