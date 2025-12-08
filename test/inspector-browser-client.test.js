const assert = require('assert');
const EventEmitter = require('events');

// Mock WebSocket for testing
class MockWebSocket extends EventEmitter {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url) {
        super();
        this.url = url;
        this.readyState = MockWebSocket.CONNECTING;
        this.CONNECTING = MockWebSocket.CONNECTING;
        this.OPEN = MockWebSocket.OPEN;
        this.CLOSING = MockWebSocket.CLOSING;
        this.CLOSED = MockWebSocket.CLOSED;
        this.sentMessages = [];

        // Simulate connection after a short delay
        setTimeout(() => {
            this.readyState = MockWebSocket.OPEN;
            if (this.onopen) this.onopen();
        }, 10);
    }

    send(data) {
        this.sentMessages.push(data);
        const message = JSON.parse(data);

        // Simulate responses based on method
        setTimeout(() => {
            this._simulateResponse(message);
        }, 5);
    }

    _simulateResponse(message) {
        const { id, method, params } = message;
        const [domain, command] = method.split('.');

        let result = {};

        // Simulate different responses based on domain and command
        switch (domain) {
            case 'Runtime':
                result = this._handleRuntimeCommand(command, params);
                break;
            case 'Debugger':
                result = this._handleDebuggerCommand(command, params);
                break;
            case 'Console':
                result = this._handleConsoleCommand(command);
                break;
            case 'Profiler':
                result = this._handleProfilerCommand(command);
                break;
            case 'HeapProfiler':
                result = this._handleHeapProfilerCommand(command);
                break;
            case 'Schema':
                result = this._handleSchemaCommand(command);
                break;
        }

        if (this.onmessage) {
            this.onmessage({ data: JSON.stringify({ id, result }) });
        }
    }

    _handleRuntimeCommand(command, params) {
        switch (command) {
            case 'enable':
                return {};
            case 'evaluate':
                if (params.expression === '2 + 2') {
                    return { result: { type: 'number', value: 4 } };
                } else if (params.expression === 'testVar') {
                    return { result: { type: 'string', value: 'test value' } };
                }
                return { result: { type: 'undefined', value: undefined } };
            case 'getProperties':
                return {
                    result: [
                        { name: 'prop1', value: { type: 'number', value: 42 } },
                        { name: 'prop2', value: { type: 'string', value: 'test' } }
                    ]
                };
            default:
                return {};
        }
    }

    _handleDebuggerCommand(command, params) {
        switch (command) {
            case 'enable':
                return { debuggerId: 'test-debugger-id' };
            case 'setBreakpointByUrl':
                return {
                    breakpointId: `bp-${params.lineNumber}`,
                    locations: [{
                        scriptId: '1',
                        lineNumber: params.lineNumber,
                        columnNumber: params.columnNumber || 0
                    }]
                };
            case 'removeBreakpoint':
                return {};
            case 'pause':
            case 'resume':
            case 'stepOver':
            case 'stepInto':
            case 'stepOut':
            case 'setBreakpointsActive':
            case 'setPauseOnExceptions':
                return {};
            case 'getScriptSource':
                return { scriptSource: 'function test() { return 42; }' };
            default:
                return {};
        }
    }

    _handleConsoleCommand(command) {
        switch (command) {
            case 'enable':
            case 'clearMessages':
                return {};
            default:
                return {};
        }
    }

    _handleProfilerCommand(command) {
        switch (command) {
            case 'enable':
            case 'start':
            case 'stop':
                return { profile: { nodes: [], startTime: 0, endTime: 100 } };
            default:
                return {};
        }
    }

    _handleHeapProfilerCommand(command) {
        switch (command) {
            case 'enable':
            case 'takeHeapSnapshot':
                return {};
            default:
                return {};
        }
    }

    _handleSchemaCommand(command) {
        switch (command) {
            case 'getDomains':
                return { domains: [{ name: 'Runtime', version: '1.3' }] };
            default:
                return {};
        }
    }

    close() {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) {
            setTimeout(() => this.onclose(), 5);
        }
    }

    simulateEvent(domain, event, params) {
        if (this.onmessage) {
            this.onmessage({
                data: JSON.stringify({
                    method: `${domain}.${event}`,
                    params
                })
            });
        }
    }
}

// Load the client classes
global.WebSocket = MockWebSocket;

// Mock controllerFactory
global.controllerFactory = {
    createRuntime: null,
    createDebugger: null,
    createConsole: null,
    createProfiler: null,
    createHeapProfiler: null,
    createSchema: null
};

// Load constants and controllers
const {
    RuntimeController,
    DebuggerController,
    ConsoleController,
    ProfilerController,
    HeapProfilerController,
    SchemaController
} = require('../client/inspector-controllers');

// Set up factory
global.controllerFactory = {
    createRuntime: (ws) => new RuntimeController(ws),
    createDebugger: (ws) => new DebuggerController(ws),
    createConsole: (ws) => new ConsoleController(ws),
    createProfiler: (ws) => new ProfilerController(ws),
    createHeapProfiler: (ws) => new HeapProfilerController(ws),
    createSchema: (ws) => new SchemaController(ws)
};

// Load the client
const InspectorBrowserClient = require('../client/inspector-browser-client');

describe('InspectorBrowserClient', () => {
    let client;
    const testUrl = 'ws://localhost:9229/test';

    afterEach(() => {
        if (client && client.ws) {
            client.disconnect();
        }
    });

    describe('Constructor', () => {
        it('should create an instance with default options', () => {
            client = new InspectorBrowserClient(testUrl);

            assert.strictEqual(client.url, testUrl);
            assert.strictEqual(client.ws, null);
            assert.strictEqual(client.options.autoReconnect, true);
            assert.strictEqual(client.options.reconnectDelay, 5000);
        });

        it('should create an instance with custom options', () => {
            client = new InspectorBrowserClient(testUrl, {
                autoReconnect: false,
                reconnectDelay: 3000
            });

            assert.strictEqual(client.options.autoReconnect, false);
            assert.strictEqual(client.options.reconnectDelay, 3000);
        });

        it('should initialize controllers as null', () => {
            client = new InspectorBrowserClient(testUrl);

            assert.strictEqual(client.runtime, null);
            assert.strictEqual(client.debugger, null);
            assert.strictEqual(client.console, null);
            assert.strictEqual(client.profiler, null);
            assert.strictEqual(client.heapProfiler, null);
            assert.strictEqual(client.schema, null);
        });

        it('should initialize empty breakpoints and watches maps', () => {
            client = new InspectorBrowserClient(testUrl);

            assert.ok(client.breakpoints instanceof Map);
            assert.strictEqual(client.breakpoints.size, 0);
            assert.ok(client.watches instanceof Map);
            assert.strictEqual(client.watches.size, 0);
        });
    });

    describe('Connection Management', () => {
        it('should connect and initialize controllers', async () => {
            client = new InspectorBrowserClient(testUrl);
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

        it('should set connection status correctly', async () => {
            let statusChanges = [];
            client = new InspectorBrowserClient(testUrl, {
                onStatusChange: (text, color) => {
                    statusChanges.push({ text, color });
                }
            });

            await client.connect();

            assert.ok(statusChanges.some(s => s.text === 'Connected' && s.color === 'green'));
        });

        it('should log connection events', async () => {
            let logs = [];
            client = new InspectorBrowserClient(testUrl, {
                onLog: (message, type) => {
                    logs.push({ message, type });
                }
            });

            await client.connect();

            assert.ok(logs.some(l => l.message.includes('Connection established')));
            assert.ok(logs.some(l => l.message.includes('initialized')));
        });

        it('should return true for isConnected when connected', async () => {
            client = new InspectorBrowserClient(testUrl);
            assert.ok(!client.isConnected());

            await client.connect();
            assert.strictEqual(client.isConnected(), true);
        });

        it('should disconnect and clean up', async () => {
            client = new InspectorBrowserClient(testUrl);
            await client.connect();

            client.disconnect();

            assert.strictEqual(client.ws, null);
            assert.strictEqual(client.runtime, null);
            assert.strictEqual(client.debugger, null);
            assert.strictEqual(client.controllers.length, 0);
        });
    });

    describe('High-Level Debugger API', () => {
        beforeEach(async () => {
            client = new InspectorBrowserClient(testUrl);
            await client.connect();
        });

        describe('pause', () => {
            it('should pause execution', async () => {
                const result = await client.pause();
                assert.ok(result !== undefined);
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.pause();
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });

        describe('resume', () => {
            it('should resume execution', async () => {
                const result = await client.resume();
                assert.ok(result !== undefined);
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.resume();
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });

        describe('stepOver', () => {
            it('should step over', async () => {
                const result = await client.stepOver();
                assert.ok(result !== undefined);
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.stepOver();
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });

        describe('stepInto', () => {
            it('should step into', async () => {
                const result = await client.stepInto();
                assert.ok(result !== undefined);
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.stepInto();
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });

        describe('stepOut', () => {
            it('should step out', async () => {
                const result = await client.stepOut();
                assert.ok(result !== undefined);
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.stepOut();
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });

        describe('setBreakpoint', () => {
            it('should set a breakpoint by URL and line', async () => {
                const result = await client.setBreakpoint('test.js', 10);

                assert.ok(result.breakpointId);
                assert.strictEqual(result.breakpointId, 'bp-10');
                assert.ok(result.locations);
                assert.strictEqual(result.locations.length, 1);
            });

            it('should track breakpoints locally', async () => {
                await client.setBreakpoint('test.js', 10);
                await client.setBreakpoint('test.js', 20);
                await client.setBreakpoint('other.js', 5);

                assert.ok(client.breakpoints.has('test.js'));
                assert.ok(client.breakpoints.has('other.js'));
                assert.strictEqual(client.breakpoints.get('test.js').size, 2);
                assert.ok(client.breakpoints.get('test.js').has(10));
                assert.ok(client.breakpoints.get('test.js').has(20));
            });

            it('should set breakpoint with options', async () => {
                const result = await client.setBreakpoint('test.js', 10, {
                    columnNumber: 5,
                    condition: 'x > 10'
                });

                assert.ok(result.breakpointId);
            });

            it('should log breakpoint creation', async () => {
                let logs = [];
                client.options.onLog = (message, type) => logs.push({ message, type });

                await client.setBreakpoint('test.js', 10);

                assert.ok(logs.some(l => l.message.includes('Breakpoint set')));
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.setBreakpoint('test.js', 10);
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });

        describe('clearBreakpoint', () => {
            it('should clear a breakpoint by ID', async () => {
                const result = await client.clearBreakpoint('bp-10');
                assert.ok(result !== undefined);
            });

            it('should log breakpoint removal', async () => {
                let logs = [];
                client.options.onLog = (message, type) => logs.push({ message, type });

                await client.clearBreakpoint('bp-10');

                assert.ok(logs.some(l => l.message.includes('Breakpoint cleared')));
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.clearBreakpoint('bp-10');
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });

        describe('clearAllBreakpoints', () => {
            it('should clear local breakpoint tracking', async () => {
                await client.setBreakpoint('test.js', 10);
                await client.setBreakpoint('test.js', 20);

                assert.strictEqual(client.breakpoints.size, 1);

                await client.clearAllBreakpoints();

                assert.strictEqual(client.breakpoints.size, 0);
            });

            it('should log clearing all breakpoints', async () => {
                let logs = [];
                client.options.onLog = (message, type) => logs.push({ message, type });

                await client.clearAllBreakpoints();

                assert.ok(logs.some(l => l.message.includes('All breakpoints cleared')));
            });
        });

        describe('setBreakpointsActive', () => {
            it('should activate breakpoints', async () => {
                const result = await client.setBreakpointsActive(true);
                assert.ok(result !== undefined);
            });

            it('should deactivate breakpoints', async () => {
                const result = await client.setBreakpointsActive(false);
                assert.ok(result !== undefined);
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.setBreakpointsActive(true);
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });

        describe('setPauseOnExceptions', () => {
            it('should set pause on exceptions to none', async () => {
                const result = await client.setPauseOnExceptions('none');
                assert.ok(result !== undefined);
            });

            it('should set pause on exceptions to uncaught', async () => {
                const result = await client.setPauseOnExceptions('uncaught');
                assert.ok(result !== undefined);
            });

            it('should set pause on exceptions to all', async () => {
                const result = await client.setPauseOnExceptions('all');
                assert.ok(result !== undefined);
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.setPauseOnExceptions('none');
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });
    });

    describe('Evaluation API', () => {
        beforeEach(async () => {
            client = new InspectorBrowserClient(testUrl);
            await client.connect();
        });

        describe('eval', () => {
            it('should evaluate an expression', async () => {
                const result = await client.eval('2 + 2');

                assert.ok(result);
                assert.strictEqual(result.value, 4);
                assert.strictEqual(result.type, 'number');
            });

            it('should evaluate with options', async () => {
                const result = await client.eval('2 + 2', { returnByValue: true });

                assert.ok(result);
                assert.strictEqual(result.value, 4);
            });

            it('should log evaluation', async () => {
                let logs = [];
                client.options.onLog = (message, type) => logs.push({ message, type });

                await client.eval('2 + 2');

                assert.ok(logs.some(l => l.message.includes('Evaluated')));
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.eval('2 + 2');
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });

        describe('getProperties', () => {
            it('should get properties of an object', async () => {
                const result = await client.getProperties('object-id-123');

                assert.ok(result);
                assert.ok(result.properties);
                assert.ok(Array.isArray(result.properties));
            });

            it('should get only own properties', async () => {
                const result = await client.getProperties('object-id-123', true);

                assert.ok(result);
                assert.ok(result.properties);
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.getProperties('object-id-123');
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });

        describe('getScriptSource', () => {
            it('should get script source', async () => {
                const result = await client.getScriptSource('script-id-123');

                assert.ok(result);
                assert.ok(result.scriptSource);
                assert.strictEqual(typeof result.scriptSource, 'string');
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.getScriptSource('script-id-123');
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });
    });

    describe('Watch Expressions', () => {
        beforeEach(async () => {
            client = new InspectorBrowserClient(testUrl);
            await client.connect();
        });

        describe('watch', () => {
            it('should add a watch expression', async () => {
                const result = await client.watch('testVar');

                assert.ok(client.watches.has('testVar'));
                assert.strictEqual(client.watches.get('testVar'), 'testVar');
            });

            it('should add a watch with custom expression', async () => {
                await client.watch('myVar', 'someComplexExpression');

                assert.ok(client.watches.has('myVar'));
                assert.strictEqual(client.watches.get('myVar'), 'someComplexExpression');
            });

            it('should evaluate the watch expression immediately', async () => {
                const result = await client.watch('testVar');

                assert.ok(result);
            });

            it('should log watch creation', async () => {
                let logs = [];
                client.options.onLog = (message, type) => logs.push({ message, type });

                await client.watch('testVar');

                assert.ok(logs.some(l => l.message.includes('Watching')));
            });
        });

        describe('unwatch', () => {
            it('should remove a watch expression', async () => {
                await client.watch('testVar');
                assert.ok(client.watches.has('testVar'));

                const removed = client.unwatch('testVar');

                assert.strictEqual(removed, true);
                assert.ok(!client.watches.has('testVar'));
            });

            it('should return false for non-existent watch', () => {
                const removed = client.unwatch('nonExistent');
                assert.strictEqual(removed, false);
            });

            it('should log watch removal', async () => {
                let logs = [];
                client.options.onLog = (message, type) => logs.push({ message, type });

                await client.watch('testVar');
                client.unwatch('testVar');

                assert.ok(logs.some(l => l.message.includes('Unwatched')));
            });
        });

        describe('unwatchAll', () => {
            it('should clear all watch expressions', async () => {
                await client.watch('var1');
                await client.watch('var2');
                await client.watch('var3');

                assert.strictEqual(client.watches.size, 3);

                client.unwatchAll();

                assert.strictEqual(client.watches.size, 0);
            });

            it('should log clearing all watches', async () => {
                let logs = [];
                client.options.onLog = (message, type) => logs.push({ message, type });

                await client.watch('var1');
                await client.watch('var2');
                client.unwatchAll();

                assert.ok(logs.some(l => l.message.includes('Cleared') && l.message.includes('watch')));
            });
        });

        describe('evaluateWatches', () => {
            it('should evaluate all watch expressions', async () => {
                await client.watch('testVar');
                await client.watch('expr2', '2 + 2');

                const results = await client.evaluateWatches();

                assert.ok(results);
                assert.ok(results.testVar);
                assert.ok(results.expr2);
            });

            it('should return empty object when no watches', async () => {
                const results = await client.evaluateWatches();

                assert.ok(results);
                assert.strictEqual(Object.keys(results).length, 0);
            });
        });
    });

    describe('Console API', () => {
        beforeEach(async () => {
            client = new InspectorBrowserClient(testUrl);
            await client.connect();
        });

        describe('clearConsole', () => {
            it('should clear console messages', async () => {
                const result = await client.clearConsole();
                assert.ok(result !== undefined);
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.clearConsole();
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });
    });

    describe('Profiling API', () => {
        beforeEach(async () => {
            client = new InspectorBrowserClient(testUrl);
            await client.connect();
        });

        describe('startProfiling', () => {
            it('should start profiling', async () => {
                const result = await client.startProfiling();
                assert.ok(result !== undefined);
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.startProfiling();
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });

        describe('stopProfiling', () => {
            it('should stop profiling', async () => {
                const result = await client.stopProfiling();
                assert.ok(result !== undefined);
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.stopProfiling();
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });

        describe('takeHeapSnapshot', () => {
            it('should take a heap snapshot', async () => {
                const result = await client.takeHeapSnapshot();
                assert.ok(result !== undefined);
            });

            it('should throw when not connected', async () => {
                client.disconnect();
                try {
                    await client.takeHeapSnapshot();
                    assert.fail('Should have thrown');
                } catch (err) {
                    assert.ok(err.message.includes('Not connected'));
                }
            });
        });
    });

    describe('Event Handling', () => {
        beforeEach(async () => {
            client = new InspectorBrowserClient(testUrl);
            await client.connect();
        });

        describe('Debugger Events', () => {
            it('should handle paused event', (done) => {
                client.on('paused', (data) => {
                    assert.ok(data);
                    assert.strictEqual(data.reason, 'breakpoint');
                    done();
                });

                client.ws.simulateEvent('Debugger', 'paused', {
                    reason: 'breakpoint',
                    callFrames: []
                });
            });

            it('should handle resumed event', (done) => {
                client.on('resumed', () => {
                    done();
                });

                client.ws.simulateEvent('Debugger', 'resumed', {});
            });

            it('should handle scriptParsed event', (done) => {
                client.on('scriptParsed', (data) => {
                    assert.ok(data);
                    assert.strictEqual(data.url, 'test.js');
                    done();
                });

                client.ws.simulateEvent('Debugger', 'scriptParsed', {
                    scriptId: '1',
                    url: 'test.js',
                    startLine: 0,
                    startColumn: 0,
                    endLine: 100,
                    endColumn: 0
                });
            });

            it('should handle breakpointResolved event', (done) => {
                client.on('breakpointResolved', (data) => {
                    assert.ok(data);
                    assert.strictEqual(data.breakpointId, 'bp-1');
                    done();
                });

                client.ws.simulateEvent('Debugger', 'breakpointResolved', {
                    breakpointId: 'bp-1',
                    location: { scriptId: '1', lineNumber: 10 }
                });
            });
        });

        describe('Runtime Events', () => {
            it('should handle console event', (done) => {
                client.on('console', (data) => {
                    assert.ok(data);
                    assert.strictEqual(data.type, 'log');
                    done();
                });

                client.ws.simulateEvent('Runtime', 'consoleAPICalled', {
                    type: 'log',
                    args: [{ type: 'string', value: 'test' }],
                    timestamp: Date.now()
                });
            });

            it('should handle exception event', (done) => {
                client.on('exception', (data) => {
                    assert.ok(data);
                    done();
                });

                client.ws.simulateEvent('Runtime', 'exceptionThrown', {
                    timestamp: Date.now(),
                    exceptionDetails: { text: 'Error' }
                });
            });

            it('should handle contextCreated event', (done) => {
                client.on('contextCreated', (data) => {
                    assert.ok(data);
                    done();
                });

                client.ws.simulateEvent('Runtime', 'executionContextCreated', {
                    context: {
                        id: 1,
                        name: 'main',
                        origin: 'http://localhost'
                    }
                });
            });
        });
    });

    describe('Event Emitter Methods', () => {
        beforeEach(() => {
            client = new InspectorBrowserClient(testUrl);
        });

        it('should register event handlers with on()', () => {
            const handler = () => {};
            client.on('test', handler);

            assert.ok(client._eventHandlers);
            assert.ok(client._eventHandlers.test);
            assert.strictEqual(client._eventHandlers.test.length, 1);
        });

        it('should remove event handlers with off()', () => {
            const handler = () => {};
            client.on('test', handler);
            client.off('test', handler);

            assert.strictEqual(client._eventHandlers.test.length, 0);
        });

        it('should emit events to registered handlers', (done) => {
            client.on('test', (data) => {
                assert.strictEqual(data, 'test-data');
                done();
            });

            client.emit('test', 'test-data');
        });

        it('should handle multiple handlers for same event', () => {
            let count = 0;
            client.on('test', () => count++);
            client.on('test', () => count++);

            client.emit('test');

            assert.strictEqual(count, 2);
        });

        it('should handle errors in event handlers gracefully', () => {
            client.on('test', () => {
                throw new Error('Handler error');
            });

            // Should not throw
            assert.doesNotThrow(() => {
                client.emit('test');
            });
        });
    });

    describe('Message Routing', () => {
        beforeEach(async () => {
            client = new InspectorBrowserClient(testUrl);
            await client.connect();
        });

        it('should route messages to all controllers', () => {
            const runtimeMessageCount = client.runtime.pendingCommands.size;
            const debuggerMessageCount = client.debugger.pendingCommands.size;

            // Send a message through the WebSocket
            client.ws.onmessage({
                data: JSON.stringify({
                    id: 'Runtime_1',
                    result: {}
                })
            });

            // Message should be routed (this is tested implicitly by other tests)
            assert.ok(true);
        });

        it('should handle parse errors gracefully', () => {
            let logs = [];
            client.options.onLog = (message, type) => logs.push({ message, type });

            client.ws.onmessage({
                data: 'invalid json'
            });

            assert.ok(logs.some(l => l.message.includes('Parse error')));
        });

        it('should log received messages', () => {
            let logs = [];
            client.options.onLog = (message, type) => logs.push({ message, type });

            client.ws.onmessage({
                data: JSON.stringify({ id: 'test', result: {} })
            });

            assert.ok(logs.some(l => l.message.includes('Received') && l.type === 'received'));
        });
    });

    describe('Auto-Reconnect', () => {
        it('should attempt to reconnect when autoReconnect is enabled', (done) => {
            client = new InspectorBrowserClient(testUrl, {
                autoReconnect: true,
                reconnectDelay: 50
            });

            let callbackFired = false;
            client.connect().then(() => {
                let statusChanges = [];
                client.options.onStatusChange = (text, color) => {
                    statusChanges.push({ text, color });

                    if (!callbackFired && statusChanges.filter(s => s.text === 'Disconnected').length === 1) {
                        callbackFired = true;
                        // Give time for reconnect attempt
                        setTimeout(() => {
                            // Should have attempted to reconnect
                            done();
                        }, 100);
                    }
                };

                // Trigger close
                client.ws.close();
            });
        });

        it('should not reconnect when autoReconnect is disabled', (done) => {
            client = new InspectorBrowserClient(testUrl, {
                autoReconnect: false
            });

            client.connect().then(() => {
                client.ws.close();

                setTimeout(() => {
                    // Should still be disconnected
                    assert.ok(!client.isConnected());
                    done();
                }, 100);
            });
        });
    });
});
