const assert = require('assert');
const path = require('path');
const RemoteDebuggerProxyServer = require('../inspector-proxy-factory');

// Load the real InspectorBrowserClient (browser version)
// We'll run it in Node.js using the 'ws' package as WebSocket
const WebSocket = require('ws');
global.WebSocket = WebSocket;

// Set up the controller factory
const {
    RuntimeController,
    DebuggerController,
    ConsoleController,
    ProfilerController,
    HeapProfilerController,
    SchemaController
} = require('../client/inspector-controllers');

global.controllerFactory = {
    createRuntime: (ws) => new RuntimeController(ws),
    createDebugger: (ws) => new DebuggerController(ws),
    createConsole: (ws) => new ConsoleController(ws),
    createProfiler: (ws) => new ProfilerController(ws),
    createHeapProfiler: (ws) => new HeapProfilerController(ws),
    createSchema: (ws) => new SchemaController(ws)
};

const InspectorBrowserClient = require('../client/inspector-browser-client');

describe('InspectorBrowserClient - Integration Tests (Real Proxy)', function() {
    this.timeout(10000); // Increase timeout for real connections

    let proxy;
    let client;
    const proxyPort = 9250;
    const inspectPort = 9251;
    const testScript = path.join(__dirname, 'fixtures', 'busy-script.js');

    before(function(done) {
        // Start the proxy server with a long-running script
        proxy = new RemoteDebuggerProxyServer(testScript, {
            inspectPort,
            proxyPort
        });

        // Silence proxy console logs during tests
        const originalLog = console.log;
        console.log = (...args) => {
            const msg = args[0]?.toString() || '';
            if (!msg.includes('[Proxy]') && !msg.includes('[Target]') && !msg.includes('Proxy API')) {
                originalLog.apply(console, args);
            }
        };

        proxy.start();

        // Wait for proxy and debugger to be ready
        setTimeout(() => {
            done();
        }, 1500);
    });

    after(function() {
        if (proxy) {
            proxy.stop();
        }
        // Restore console.log
        console.log = console.log.originalLog || console.log;
    });

    afterEach(function() {
        if (client && client.ws) {
            client.disconnect();
        }
    });

    describe('Connection Management', () => {
        it('should connect to proxy and initialize controllers', async () => {
            const proxyUrl = `ws://localhost:${proxyPort}`;
            client = new InspectorBrowserClient(proxyUrl);

            await client.connect();

            assert.ok(client.ws !== null);
            assert.ok(client.runtime !== null);
            assert.ok(client.debugger !== null);
            assert.ok(client.console !== null);
            assert.ok(client.profiler !== null);
            assert.ok(client.heapProfiler !== null);
            assert.ok(client.schema !== null);
            assert.strictEqual(client.controllers.length, 6);
        });

        it('should report connected state correctly', async () => {
            const proxyUrl = `ws://localhost:${proxyPort}`;
            client = new InspectorBrowserClient(proxyUrl);

            assert.strictEqual(client.isConnected(), false);

            await client.connect();

            assert.strictEqual(client.isConnected(), true);
        });

        it('should disconnect cleanly', async () => {
            const proxyUrl = `ws://localhost:${proxyPort}`;
            client = new InspectorBrowserClient(proxyUrl);

            await client.connect();
            assert.ok(client.isConnected());

            client.disconnect();

            assert.strictEqual(client.ws, null);
            assert.strictEqual(client.isConnected(), false);
        });
    });

    describe('High-Level Debugger API', () => {
        beforeEach(async () => {
            const proxyUrl = `ws://localhost:${proxyPort}`;
            client = new InspectorBrowserClient(proxyUrl);
            await client.connect();
        });

        describe('pause and resume', () => {
            it('should pause execution on real debugger', async () => {
                const result = await client.pause();
                assert.ok(result !== undefined);
            });

            it('should resume execution on real debugger', async () => {
                await client.pause();
                // Wait a bit for pause to take effect
                await new Promise(resolve => setTimeout(resolve, 100));

                const result = await client.resume();
                assert.ok(result !== undefined);
            });
        });

        describe('breakpoints', () => {
            it('should set a breakpoint by URL on real debugger', async () => {
                const result = await client.setBreakpoint(testScript, 10);

                assert.ok(result.breakpointId);
                assert.ok(result.locations);
            });

            it('should track breakpoints locally', async () => {
                await client.setBreakpoint(testScript, 10);
                await client.setBreakpoint(testScript, 15);

                assert.ok(client.breakpoints.has(testScript));
                assert.strictEqual(client.breakpoints.get(testScript).size, 2);
            });

            it('should clear a breakpoint on real debugger', async () => {
                const setResult = await client.setBreakpoint(testScript, 10);

                const clearResult = await client.clearBreakpoint(setResult.breakpointId);
                assert.ok(clearResult !== undefined);
            });

            it('should activate/deactivate breakpoints', async () => {
                const deactivateResult = await client.setBreakpointsActive(false);
                assert.ok(deactivateResult !== undefined);

                const activateResult = await client.setBreakpointsActive(true);
                assert.ok(activateResult !== undefined);
            });
        });

        describe('exception handling', () => {
            it('should set pause on exceptions', async () => {
                const noneResult = await client.setPauseOnExceptions('none');
                assert.ok(noneResult !== undefined);

                const uncaughtResult = await client.setPauseOnExceptions('uncaught');
                assert.ok(uncaughtResult !== undefined);

                const allResult = await client.setPauseOnExceptions('all');
                assert.ok(allResult !== undefined);
            });
        });
    });

    describe('Evaluation API', () => {
        beforeEach(async () => {
            const proxyUrl = `ws://localhost:${proxyPort}`;
            client = new InspectorBrowserClient(proxyUrl);
            await client.connect();
        });

        it('should evaluate expressions on real debugger', async () => {
            const result = await client.eval('2 + 2');

            assert.ok(result);
            assert.ok(result.result);
            assert.strictEqual(result.value, 4);
        });

        it('should evaluate complex expressions', async () => {
            const result = await client.eval('Math.max(10, 20, 5)');

            assert.ok(result);
            assert.strictEqual(result.value, 20);
        });

        it('should access global variables from the debugged script', async () => {
            const result = await client.eval('counter');

            assert.ok(result);
            assert.ok(result.result);
            assert.strictEqual(result.type, 'number');
            // counter should be > 0 since the script is running
            assert.ok(result.value >= 0);
        });

        it('should get properties of objects', async () => {
            // Create an object and get its objectId
            const evalResult = await client.eval('({foo: 42, bar: "test"})');
            assert.ok(evalResult.objectId);

            const propsResult = await client.getProperties(evalResult.objectId);

            assert.ok(propsResult);
            assert.ok(propsResult.properties);
            assert.ok(Array.isArray(propsResult.properties));

            const fooProperty = propsResult.properties.find(p => p.name === 'foo');
            const barProperty = propsResult.properties.find(p => p.name === 'bar');

            assert.ok(fooProperty);
            assert.strictEqual(fooProperty.value, 42);
            assert.ok(barProperty);
            assert.strictEqual(barProperty.value, 'test');
        });
    });

    describe('Watch Expressions', () => {
        beforeEach(async () => {
            const proxyUrl = `ws://localhost:${proxyPort}`;
            client = new InspectorBrowserClient(proxyUrl);
            await client.connect();
        });

        it('should add and evaluate watch expressions', async () => {
            const result = await client.watch('counter');

            assert.ok(client.watches.has('counter'));
            assert.ok(result);
            assert.strictEqual(result.type, 'number');
        });

        it('should add custom watch expressions', async () => {
            await client.watch('myCalc', 'counter * 2');

            assert.ok(client.watches.has('myCalc'));
            assert.strictEqual(client.watches.get('myCalc'), 'counter * 2');
        });

        it('should evaluate all watches', async () => {
            await client.watch('counter');
            await client.watch('doubleCounter', 'counter * 2');
            await client.watch('pi', 'Math.PI');

            const results = await client.evaluateWatches();

            assert.ok(results.counter);
            assert.ok(results.doubleCounter);
            assert.ok(results.pi);
            assert.strictEqual(results.pi.value, Math.PI);
        });

        it('should remove watch expressions', async () => {
            await client.watch('counter');
            assert.ok(client.watches.has('counter'));

            const removed = client.unwatch('counter');

            assert.strictEqual(removed, true);
            assert.ok(!client.watches.has('counter'));
        });

        it('should clear all watches', async () => {
            await client.watch('var1');
            await client.watch('var2');
            await client.watch('var3');

            assert.strictEqual(client.watches.size, 3);

            client.unwatchAll();

            assert.strictEqual(client.watches.size, 0);
        });
    });

    describe('Console API', () => {
        beforeEach(async () => {
            const proxyUrl = `ws://localhost:${proxyPort}`;
            client = new InspectorBrowserClient(proxyUrl);
            await client.connect();
        });

        it('should clear console messages', async () => {
            const result = await client.clearConsole();
            assert.ok(result !== undefined);
        });
    });

    describe('Event Handling', () => {
        beforeEach(async () => {
            const proxyUrl = `ws://localhost:${proxyPort}`;
            client = new InspectorBrowserClient(proxyUrl);
            await client.connect();
        });

        it('should receive scriptParsed events from real debugger', (done) => {
            let receivedEvent = false;

            client.on('scriptParsed', (data) => {
                if (!receivedEvent) {
                    receivedEvent = true;
                    assert.ok(data);
                    assert.ok(data.scriptId);
                    assert.ok(data.url !== undefined);
                    done();
                }
            });

            // The busy-script should trigger script parsing
            // If we don't get an event in 2 seconds, fail
            setTimeout(() => {
                if (!receivedEvent) {
                    done(new Error('No scriptParsed event received'));
                }
            }, 2000);
        });

        it('should receive paused event when pausing real debugger', (done) => {
            client.on('paused', (data) => {
                assert.ok(data);
                assert.ok(data.reason);
                assert.ok(Array.isArray(data.callFrames));
                done();
            });

            // Pause the debugger
            client.pause();
        });

        it('should receive resumed event when resuming real debugger', (done) => {
            let pauseReceived = false;

            client.on('paused', async () => {
                pauseReceived = true;

                // Now resume
                await client.resume();
            });

            client.on('resumed', () => {
                assert.ok(pauseReceived, 'Should have paused before resuming');
                done();
            });

            // Pause first
            client.pause();
        });
    });

    describe('Step Operations', () => {
        beforeEach(async () => {
            const proxyUrl = `ws://localhost:${proxyPort}`;
            client = new InspectorBrowserClient(proxyUrl);
            await client.connect();
        });

        it('should step over in paused state', async () => {
            // Pause the debugger first
            await client.pause();

            // Wait for pause to take effect
            await new Promise(resolve => setTimeout(resolve, 200));

            // Now step over
            const result = await client.stepOver();
            assert.ok(result !== undefined);
        });

        it('should step into in paused state', async () => {
            await client.pause();
            await new Promise(resolve => setTimeout(resolve, 200));

            const result = await client.stepInto();
            assert.ok(result !== undefined);
        });

        it('should step out in paused state', async () => {
            await client.pause();
            await new Promise(resolve => setTimeout(resolve, 200));

            const result = await client.stepOut();
            assert.ok(result !== undefined);
        });
    });

    describe('Multiple Client Connections', () => {
        it('should support multiple clients connecting to the same proxy', async () => {
            const proxyUrl = `ws://localhost:${proxyPort}`;

            const client1 = new InspectorBrowserClient(proxyUrl);
            const client2 = new InspectorBrowserClient(proxyUrl);

            await client1.connect();
            await client2.connect();

            assert.ok(client1.isConnected());
            assert.ok(client2.isConnected());

            // Both should be able to evaluate
            const result1 = await client1.eval('1 + 1');
            const result2 = await client2.eval('2 + 2');

            assert.strictEqual(result1.value, 2);
            assert.strictEqual(result2.value, 4);

            client1.disconnect();
            client2.disconnect();
        });
    });

    describe('Error Handling', () => {
        it('should handle connection to non-existent proxy', async () => {
            const badUrl = 'ws://localhost:9999';
            client = new InspectorBrowserClient(badUrl);

            try {
                await client.connect();
                assert.fail('Should have thrown an error');
            } catch (err) {
                assert.ok(err);
            }
        });

        it('should handle invalid expressions gracefully', async () => {
            const proxyUrl = `ws://localhost:${proxyPort}`;
            client = new InspectorBrowserClient(proxyUrl);
            await client.connect();

            const result = await client.eval('this is invalid javascript!!!');

            assert.ok(result);
            assert.ok(result.exception || !result.success);
        });
    });

    describe('Script Source Retrieval', () => {
        beforeEach(async () => {
            const proxyUrl = `ws://localhost:${proxyPort}`;
            client = new InspectorBrowserClient(proxyUrl);
            await client.connect();
        });

        it('should retrieve script source from real debugger', function(done) {
            this.timeout(5000);

            let scriptId;

            client.on('scriptParsed', async (data) => {
                if (data.url && data.url.includes('busy-script.js') && !scriptId) {
                    scriptId = data.scriptId;

                    try {
                        const sourceResult = await client.getScriptSource(scriptId);

                        assert.ok(sourceResult);
                        assert.ok(sourceResult.scriptSource);
                        assert.ok(sourceResult.scriptSource.includes('busyWork'));
                        done();
                    } catch (err) {
                        done(err);
                    }
                }
            });
        });
    });

    describe('Logging and Status Callbacks', () => {
        it('should trigger status change callbacks', async () => {
            const proxyUrl = `ws://localhost:${proxyPort}`;
            const statusChanges = [];

            client = new InspectorBrowserClient(proxyUrl, {
                onStatusChange: (text, color) => {
                    statusChanges.push({ text, color });
                }
            });

            await client.connect();

            assert.ok(statusChanges.some(s => s.text === 'Connected' && s.color === 'green'));
        });

        it('should trigger log callbacks', async () => {
            const proxyUrl = `ws://localhost:${proxyPort}`;
            const logs = [];

            client = new InspectorBrowserClient(proxyUrl, {
                onLog: (message, type) => {
                    logs.push({ message, type });
                }
            });

            await client.connect();

            assert.ok(logs.some(l => l.message.includes('Connection established')));
            assert.ok(logs.some(l => l.message.includes('initialized')));
        });

        it('should log breakpoint operations', async () => {
            const proxyUrl = `ws://localhost:${proxyPort}`;
            const logs = [];

            client = new InspectorBrowserClient(proxyUrl, {
                onLog: (message, type) => {
                    logs.push({ message, type });
                }
            });

            await client.connect();
            await client.setBreakpoint(testScript, 10);

            assert.ok(logs.some(l => l.message.includes('Breakpoint set')));
        });
    });
});
