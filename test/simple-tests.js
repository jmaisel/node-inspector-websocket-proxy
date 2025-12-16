/**
 * Browser-based tests for InspectorBrowserClient
 * Assumes proxy server is already running on ws://localhost:8888
 * Run by opening test.html in a browser
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
            client.debugger.enable();

            // Set up promises that wait for events
            const consolePromise = new Promise(resolve => {
                client.debugger.once ("Debugger.scriptParsed", resolve);
            });

            const [c] = await Promise.all([consolePromise]);

            assert.isNotNull(c, "Debugger.scriptParsed event caught");
        });

        it('should handle domain events properly', async () => {
            assert.strictEqual(client.isConnected(), true, 'Should be connected after connect()');

            // Set up promises that wait for events
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

        it('should disconnect cleanly', async () => {
            assert.ok(client.isConnected(), 'Should be connected');

            client.disconnect();

            assert.strictEqual(client.ws, null, 'WebSocket should be null');
            assert.strictEqual(client.isConnected(), false, 'Should not be connected');
            assert.strictEqual(client.runtime, null, 'Runtime should be null');
            assert.strictEqual(client.debugger, null, 'Debugger should be null');
        });
    });
});