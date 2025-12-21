/**
 * Browser-based tests for InspectorBrowserClient
 * Assumes proxy server is already running on ws://localhost:8888
 * Run by opening smoke-tests.html in a browser
 */

describe('InspectorBrowserClient Browser Tests', function() {
    this.timeout(10000);

    let client;
    const wsUrl = 'ws://localhost:8888';

    before(async function() {
        // Create and connect client
        client = new InspectorBrowserClient(wsUrl);
        await client.connect();
        console.log(`Client is ${client.isConnected() ? "" : "n't"} connected`);
    });

    after(function() {
        if (client && client.ws) {
            // client.disconnect();
        }
    });

    describe('Connection Management', () => {
        it('should connect and initialize controllers', async () => {
            assert.ok(client.ws !== null, 'WebSocket should be connected');
            assert.ok(client.runtime !== null, 'Runtime controller should exist');
            assert.ok(client.debugger !== null, 'Debugger controller should exist');
            assert.ok(client.console !== null, 'Console controller should exist');
            assert.ok(client.profiler !== null, 'Profiler controller should exist');
            assert.ok(client.heapProfiler !== null, 'HeapProfiler controller should exist');
            assert.ok(client.schema !== null, 'Schema controller should exist');
            assert.strictEqual(client.controllers.length, 6, 'Should have 6 controllers');
        });

        it('should report connected state correctly', async () => {
            assert.strictEqual(client.isConnected(), true, 'Should be connected after connect()');
        });

        it('should enable the Debugger, and get a series of scriptSources', async () => {
            // Set up promises that wait for events BEFORE calling enable
            const consolePromise = new Promise(resolve => {
                client.debugger.once ("Debugger.scriptParsed", resolve);
            });

            client.debugger.enable();

            const [c] = await Promise.all([consolePromise]);

            assert.isNotNull(c, "Debugger.scriptParsed event caught");
        });

        it('should handle domain events properly', async () => {
            assert.strictEqual(client.isConnected(), true, 'Should be connected after connect()');

            // Set up promises that wait for events BEFORE calling enable
            const consolePromise = new Promise(resolve => {
                client.console.once("Console.messageAdded", resolve);
            });

            const runtimePromise = new Promise(resolve => {
                client.runtime.once("Runtime.consoleAPICalled", resolve);
            });

            const boundResponsePromise = new Promise(resolve => {
                client.runtime.once("Runtime.enable", resolve);
            });

            client.runtime.enable();
            client.console.enable();

            const [c, r, b] = await Promise.all([consolePromise, runtimePromise, boundResponsePromise]);

            assert.isNotNull(c, "Console.messageAdded event caught");
            assert.isNotNull(r, "Runtime.consoleAPICalled event caught");
            assert.isNotNull(b, "Runtime.enable event caught");
        });

        it('should connect, disconnect cleanly, and emit Proxy.closed event', async () => {
            // Create a fresh client connection for this isolated test
            const testClient = new InspectorBrowserClient(wsUrl);

            // Connect
            await testClient.connect();
            assert.ok(testClient.isConnected(), 'Should be connected');

            // Set up promise to wait for Proxy.closed event
            const closedPromise = new Promise(resolve => {
                testClient.once('Proxy.closed', resolve);
            });

            // Trigger disconnect
            testClient.disconnect();

            // Wait for close to complete
            const closeEvent = await closedPromise;

            // Verify event was emitted with correct properties
            assert.isNotNull(closeEvent, 'Proxy.closed event should be emitted');
            assert.property(closeEvent, 'code', 'Event should have code property');
            assert.property(closeEvent, 'reason', 'Event should have reason property');
            assert.property(closeEvent, 'wasClean', 'Event should have wasClean property');

            // Verify cleanup
            assert.strictEqual(testClient.ws, null, 'WebSocket should be null');
            assert.strictEqual(testClient.isConnected(), false, 'Should not be connected');
            assert.strictEqual(testClient.runtime, null, 'Runtime should be null');
            assert.strictEqual(testClient.debugger, null, 'Debugger should be null');
            assert.strictEqual(testClient.console, null, 'Console should be null');
            assert.strictEqual(testClient.profiler, null, 'Profiler should be null');
            assert.strictEqual(testClient.heapProfiler, null, 'HeapProfiler should be null');
            assert.strictEqual(testClient.schema, null, 'Schema should be null');
            assert.strictEqual(testClient.controllers.length, 0, 'Controllers array should be empty');
        });
    });
});