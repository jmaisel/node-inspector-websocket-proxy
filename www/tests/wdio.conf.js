const path = require('path');

exports.config = {
    runner: 'local',

    specs: [
        './specs/**/*.spec.js'
    ],

    exclude: [],

    maxInstances: 1,

    capabilities: [{
        browserName: 'chrome',
        'goog:chromeOptions': {
            args: process.env.HEADLESS === 'true'
                ? ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
                : ['--disable-gpu', '--no-sandbox'],
            binary: process.env.CHROME_BIN || undefined
        }
    }],

    logLevel: 'info',

    bail: 0,

    baseUrl: 'http://localhost:8080',

    waitforTimeout: 10000,

    connectionRetryTimeout: 120000,

    connectionRetryCount: 3,

    services: [
        ['chromedriver', {
            // Auto-detect Chrome version and download matching ChromeDriver
            chromedriverCustomPath: undefined,
            args: ['--silent']
        }]
    ],

    framework: 'mocha',

    reporters: [
        'spec',
        ['junit', {
            outputDir: './reports/junit',
            outputFileFormat: function(options) {
                return `test-results-${options.cid}.xml`
            },
            addFileAttribute: true
        }]
    ],

    mochaOpts: {
        ui: 'bdd',
        timeout: 60000
    },

    /**
     * Gets executed once before all workers get launched.
     */
    onPrepare: function (config, capabilities) {
        console.log('Starting WebDriver tests...');
    },

    /**
     * Gets executed before a worker process is spawned.
     */
    onWorkerStart: function (cid, caps, specs, args, execArgv) {
        // Worker started
    },

    /**
     * Gets executed just after a worker process has exited.
     */
    onWorkerEnd: function (cid, exitCode, specs, retries) {
        // Worker ended
    },

    /**
     * Gets executed before test execution begins.
     */
    before: function (capabilities, specs) {
        const chai = require('chai');
        global.expect = chai.expect;
        global.assert = chai.assert;
        global.should = chai.should();
    },

    /**
     * Hook that gets executed before the suite starts
     */
    beforeSuite: function (suite) {
        // Before suite
    },

    /**
     * Hook that gets executed after the suite ends
     */
    afterSuite: function (suite) {
        // After suite
    },

    /**
     * Function to be executed after a test (in Mocha/Jasmine)
     */
    afterTest: function(test, context, { error, result, duration, passed, retries }) {
        if (error) {
            browser.takeScreenshot();
        }
    },

    /**
     * Gets executed after all tests are done.
     */
    after: function (result, capabilities, specs) {
        // After all tests
    },

    /**
     * Gets executed after all workers got shut down and the process is about to exit.
     */
    onComplete: function(exitCode, config, capabilities, results) {
        console.log('WebDriver tests completed!');
    }
};