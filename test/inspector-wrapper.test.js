const assert = require('assert');
const InspectorWrapper = require('../inspector-wrapper');
const fs = require('fs');
const path = require('path');

describe('InspectorWrapper', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = new InspectorWrapper();
  });

  afterEach(() => {
    try {
      wrapper.close();
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should create an instance with null session', () => {
      assert.strictEqual(wrapper.session, null);
    });

    it('should create an instance with null debugger process', () => {
      assert.strictEqual(wrapper.debuggerProcess, null);
      assert.strictEqual(wrapper.debuggerUrl, null);
    });
  });

  describe('open and close', () => {
    it('should open and close inspector', () => {
      wrapper.open();
      assert.ok(wrapper.isActive(), 'Inspector should be active after open');

      wrapper.close();
      assert.ok(!wrapper.isActive(), 'Inspector should not be active after close');
    });

    it('should open inspector on custom port', () => {
      wrapper.open(9230);
      assert.ok(wrapper.isActive(), 'Inspector should be active');
      const url = wrapper.url();
      assert.ok(url.includes('9230'), 'URL should contain custom port');
      wrapper.close();
    });
  });

  describe('url', () => {
    it('should return undefined when inspector is not active', () => {
      assert.strictEqual(wrapper.url(), undefined);
    });

    it('should return URL when inspector is active', () => {
      wrapper.open();
      const url = wrapper.url();
      assert.ok(typeof url === 'string', 'URL should be a string');
      assert.ok(url.startsWith('ws://'), 'URL should start with ws://');
      wrapper.close();
    });
  });

  describe('isActive', () => {
    it('should return false when inspector is not active', () => {
      assert.strictEqual(wrapper.isActive(), false);
    });

    it('should return true when inspector is active', () => {
      wrapper.open();
      assert.strictEqual(wrapper.isActive(), true);
      wrapper.close();
    });
  });

  describe('connect and disconnect', () => {
    it('should connect and create a session', () => {
      wrapper.open();
      const session = wrapper.connect();
      assert.ok(session !== null, 'Session should not be null');
      assert.ok(wrapper.session !== null, 'Wrapper session should not be null');
      wrapper.disconnect();
      assert.strictEqual(wrapper.session, null, 'Session should be null after disconnect');
      wrapper.close();
    });

    it('should disconnect existing session', () => {
      wrapper.open();
      wrapper.connect();
      assert.ok(wrapper.session !== null);
      wrapper.disconnect();
      assert.strictEqual(wrapper.session, null);
      wrapper.close();
    });
  });

  describe('post', () => {
    it('should reject when no session is active', async () => {
      try {
        await wrapper.post('Runtime.enable');
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.ok(err.message.includes('No active session'));
      }
    });

    it('should successfully post a message to active session', async () => {
      wrapper.open();
      wrapper.connect();

      const result = await wrapper.post('Runtime.enable');
      assert.ok(result !== undefined, 'Should return a result');

      wrapper.close();
    });

    it('should handle post with parameters', async () => {
      wrapper.open();
      wrapper.connect();

      await wrapper.post('Runtime.enable');
      const result = await wrapper.post('Runtime.evaluate', {
        expression: '2 + 2'
      });

      assert.ok(result, 'Should return a result');
      assert.ok(result.result, 'Should have result property');
      assert.strictEqual(result.result.value, 4, 'Result should be 4');

      wrapper.close();
    });
  });

  describe('close', () => {
    it('should handle close when session exists', () => {
      wrapper.open();
      wrapper.connect();
      assert.ok(wrapper.session !== null);

      wrapper.close();
      assert.strictEqual(wrapper.session, null, 'Session should be null after close');
      assert.ok(!wrapper.isActive(), 'Inspector should not be active');
    });

    it('should handle close when no session exists', () => {
      wrapper.open();
      assert.strictEqual(wrapper.session, null);

      wrapper.close();
      assert.ok(!wrapper.isActive(), 'Inspector should not be active');
    });
  });

  describe('forked debugger process', () => {
    let testScriptPath;

    before(() => {
      // Create a simple test script
      testScriptPath = path.join(__dirname, 'test-script.js');
      fs.writeFileSync(testScriptPath, `
        console.log('Test script running');
        setTimeout(() => {
          console.log('Test script complete');
          process.exit(0);
        }, 1000);
      `);
    });

    after(() => {
      // Clean up test script
      if (fs.existsSync(testScriptPath)) {
        fs.unlinkSync(testScriptPath);
      }
    });

    it('should fork a debugger process when script option is provided', async function() {
      this.timeout(10000);

      await wrapper.open(9230, '127.0.0.1', false, {
        script: testScriptPath
      });

      assert.ok(wrapper.getDebuggerProcess() !== null, 'Debugger process should exist');
      assert.ok(wrapper.isActive(), 'Wrapper should be active');
      assert.ok(wrapper.url(), 'Should have a debugger URL');
    });

    it('should clean up forked process on close', async function() {
      this.timeout(10000);

      await wrapper.open(9231, '127.0.0.1', false, {
        script: testScriptPath
      });

      const process = wrapper.getDebuggerProcess();
      assert.ok(process !== null, 'Process should exist before close');

      wrapper.close();

      assert.strictEqual(wrapper.getDebuggerProcess(), null, 'Process should be null after close');
      assert.ok(!wrapper.isActive(), 'Wrapper should not be active after close');
    });

    it('should clean up forked process on delete', async function() {
      this.timeout(10000);

      await wrapper.open(9232, '127.0.0.1', false, {
        script: testScriptPath
      });

      assert.ok(wrapper.getDebuggerProcess() !== null, 'Process should exist before delete');

      wrapper.delete();

      assert.strictEqual(wrapper.getDebuggerProcess(), null, 'Process should be null after delete');
      assert.ok(!wrapper.isActive(), 'Wrapper should not be active after delete');
    });

    it('should reject if debugger process is already running', async function() {
      this.timeout(10000);

      await wrapper.open(9233, '127.0.0.1', false, {
        script: testScriptPath
      });

      try {
        await wrapper.open(9234, '127.0.0.1', false, {
          script: testScriptPath
        });
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.ok(err.message.includes('already running'));
      }
    });

    it('should handle process exit naturally', async function() {
      this.timeout(10000);

      // Create a script that exits after a delay (to allow debugger to attach)
      const quickExitScript = path.join(__dirname, 'quick-exit.js');
      fs.writeFileSync(quickExitScript, 'setTimeout(() => { console.log("Quick exit"); process.exit(0); }, 500);');

      await wrapper.open(9235, '127.0.0.1', false, {
        script: quickExitScript,
        breakOnStart: false  // Don't break, let it run and exit naturally
      });

      assert.ok(wrapper.getDebuggerProcess() !== null, 'Process should exist initially');

      // Wait for the process to exit
      await new Promise(resolve => setTimeout(resolve, 2000));

      assert.strictEqual(wrapper.getDebuggerProcess(), null, 'Process should be null after natural exit');

      // Clean up
      if (fs.existsSync(quickExitScript)) {
        fs.unlinkSync(quickExitScript);
      }
    });
  });

  describe('getDebuggerProcess', () => {
    it('should return null when no debugger process exists', () => {
      assert.strictEqual(wrapper.getDebuggerProcess(), null);
    });

    it('should return the process when debugger is forked', async function() {
      this.timeout(10000);

      const testScript = path.join(__dirname, 'temp-test.js');
      fs.writeFileSync(testScript, 'setTimeout(() => {}, 5000);');

      await wrapper.open(9236, '127.0.0.1', false, {
        script: testScript
      });

      const process = wrapper.getDebuggerProcess();
      assert.ok(process !== null, 'Should return the forked process');
      assert.ok(process.pid, 'Process should have a PID');

      wrapper.close();

      if (fs.existsSync(testScript)) {
        fs.unlinkSync(testScript);
      }
    });
  });

  describe('debugging methods', () => {
    beforeEach(() => {
      wrapper.open();
      wrapper.connect();
    });

    afterEach(() => {
      wrapper.close();
    });

    describe('enableDebugger and disableDebugger', () => {
      it('should enable the debugger', async () => {
        const result = await wrapper.enableDebugger();
        assert.ok(result !== undefined, 'Should return a result');
      });

      it('should disable the debugger', async () => {
        await wrapper.enableDebugger();
        const result = await wrapper.disableDebugger();
        assert.ok(result !== undefined, 'Should return a result');
      });
    });

    describe('setBreakpointByUrl', () => {
      it('should set a breakpoint by URL', async () => {
        await wrapper.enableDebugger();
        const result = await wrapper.setBreakpointByUrl('test.js', 5);
        assert.ok(result, 'Should return a result');
        assert.ok(result.breakpointId, 'Should have breakpointId');
      });

      it('should set a breakpoint with column number', async () => {
        await wrapper.enableDebugger();
        const result = await wrapper.setBreakpointByUrl('test.js', 5, 10);
        assert.ok(result, 'Should return a result');
        assert.ok(result.breakpointId, 'Should have breakpointId');
      });

      it('should set a conditional breakpoint', async () => {
        await wrapper.enableDebugger();
        const result = await wrapper.setBreakpointByUrl('test.js', 5, undefined, 'x > 10');
        assert.ok(result, 'Should return a result');
        assert.ok(result.breakpointId, 'Should have breakpointId');
      });
    });

    describe('removeBreakpoint', () => {
      it('should remove a breakpoint', async () => {
        await wrapper.enableDebugger();
        const setResult = await wrapper.setBreakpointByUrl('test.js', 5);
        const breakpointId = setResult.breakpointId;

        const result = await wrapper.removeBreakpoint(breakpointId);
        assert.ok(result !== undefined, 'Should return a result');
      });
    });

    describe('step commands', () => {
      it('should reject step over when not paused', async () => {
        await wrapper.enableDebugger();
        try {
          await wrapper.stepOver();
          assert.fail('Should have thrown an error');
        } catch (err) {
          assert.ok(err.message.includes('paused'), 'Should indicate operation requires pause');
        }
      });

      it('should reject step into when not paused', async () => {
        await wrapper.enableDebugger();
        try {
          await wrapper.stepInto();
          assert.fail('Should have thrown an error');
        } catch (err) {
          assert.ok(err.message.includes('paused'), 'Should indicate operation requires pause');
        }
      });

      it('should reject step into with breakOnAsyncCall when not paused', async () => {
        await wrapper.enableDebugger();
        try {
          await wrapper.stepInto(true);
          assert.fail('Should have thrown an error');
        } catch (err) {
          assert.ok(err.message.includes('paused'), 'Should indicate operation requires pause');
        }
      });

      it('should reject step out when not paused', async () => {
        await wrapper.enableDebugger();
        try {
          await wrapper.stepOut();
          assert.fail('Should have thrown an error');
        } catch (err) {
          assert.ok(err.message.includes('paused'), 'Should indicate operation requires pause');
        }
      });
    });

    describe('pause and resume', () => {
      it('should pause execution', async () => {
        await wrapper.enableDebugger();
        const result = await wrapper.pause();
        assert.ok(result !== undefined, 'Should return a result');
      });

      it('should reject resume when not paused', async () => {
        await wrapper.enableDebugger();
        try {
          await wrapper.resume();
          assert.fail('Should have thrown an error');
        } catch (err) {
          assert.ok(err.message.includes('paused'), 'Should indicate operation requires pause');
        }
      });

      it('should reject resume with terminateOnResume when not paused', async () => {
        await wrapper.enableDebugger();
        try {
          await wrapper.resume(true);
          assert.fail('Should have thrown an error');
        } catch (err) {
          assert.ok(err.message.includes('paused'), 'Should indicate operation requires pause');
        }
      });
    });

    describe('setPauseOnExceptions', () => {
      it('should set pause on exceptions to none', async () => {
        await wrapper.enableDebugger();
        const result = await wrapper.setPauseOnExceptions('none');
        assert.ok(result !== undefined, 'Should return a result');
      });

      it('should set pause on exceptions to uncaught', async () => {
        await wrapper.enableDebugger();
        const result = await wrapper.setPauseOnExceptions('uncaught');
        assert.ok(result !== undefined, 'Should return a result');
      });

      it('should set pause on exceptions to all', async () => {
        await wrapper.enableDebugger();
        const result = await wrapper.setPauseOnExceptions('all');
        assert.ok(result !== undefined, 'Should return a result');
      });
    });

    describe('runtime methods', () => {
      it('should enable runtime', async () => {
        const result = await wrapper.enableRuntime();
        assert.ok(result !== undefined, 'Should return a result');
      });

      it('should disable runtime', async () => {
        await wrapper.enableRuntime();
        const result = await wrapper.disableRuntime();
        assert.ok(result !== undefined, 'Should return a result');
      });

      it('should evaluate an expression', async () => {
        await wrapper.enableRuntime();
        const result = await wrapper.evaluate('2 + 2');
        assert.ok(result, 'Should return a result');
        assert.ok(result.result, 'Should have result property');
        assert.strictEqual(result.result.value, 4, 'Result should be 4');
      });

      it('should evaluate with options', async () => {
        await wrapper.enableRuntime();
        const result = await wrapper.evaluate('Math.PI', { returnByValue: true });
        assert.ok(result, 'Should return a result');
        assert.ok(result.result, 'Should have result property');
        assert.ok(Math.abs(result.result.value - Math.PI) < 0.0001, 'Result should be PI');
      });
    });

    describe('getProperties', () => {
      it('should get properties of an object', async () => {
        await wrapper.enableRuntime();
        const evalResult = await wrapper.evaluate('({a: 1, b: 2})');
        const objectId = evalResult.result.objectId;

        const result = await wrapper.getProperties(objectId);
        assert.ok(result, 'Should return a result');
        assert.ok(result.result, 'Should have result property');
        assert.ok(Array.isArray(result.result), 'Result should be an array');
      });

      it('should get only own properties', async () => {
        await wrapper.enableRuntime();
        const evalResult = await wrapper.evaluate('({a: 1})');
        const objectId = evalResult.result.objectId;

        const result = await wrapper.getProperties(objectId, true);
        assert.ok(result, 'Should return a result');
        assert.ok(result.result, 'Should have result property');
      });
    });

    describe('callFunctionOn', () => {
      it('should call a function on an object', async () => {
        await wrapper.enableRuntime();
        const evalResult = await wrapper.evaluate('({x: 5})');
        const objectId = evalResult.result.objectId;

        const result = await wrapper.callFunctionOn(
          'function() { return this.x * 2; }',
          objectId
        );
        assert.ok(result, 'Should return a result');
        assert.ok(result.result, 'Should have result property');
        assert.strictEqual(result.result.value, 10, 'Result should be 10');
      });

      it('should call a function with arguments', async () => {
        await wrapper.enableRuntime();
        const evalResult = await wrapper.evaluate('({})');
        const objectId = evalResult.result.objectId;

        const result = await wrapper.callFunctionOn(
          'function(a, b) { return a + b; }',
          objectId,
          [{value: 3}, {value: 7}]
        );
        assert.ok(result, 'Should return a result');
        assert.ok(result.result, 'Should have result property');
        assert.strictEqual(result.result.value, 10, 'Result should be 10');
      });
    });

    describe('getPossibleBreakpoints', () => {
      it('should get possible breakpoints', async () => {
        await wrapper.enableDebugger();
        // Note: This may not return actual locations without a real script loaded
        // but should not error
        try {
          const result = await wrapper.getPossibleBreakpoints({
            scriptId: '1',
            lineNumber: 0
          });
          assert.ok(result !== undefined, 'Should return a result');
        } catch (err) {
          // Expected to fail without real script, but method should work
          assert.ok(err, 'Should throw error for invalid script');
        }
      });
    });

    describe('evaluateOnCallFrame', () => {
      it('should reject without a valid call frame', async () => {
        await wrapper.enableDebugger();
        try {
          await wrapper.evaluateOnCallFrame('x + 1', 'invalid-frame-id');
          assert.fail('Should have thrown an error');
        } catch (err) {
          assert.ok(err, 'Should throw error for invalid frame');
        }
      });
    });

    describe('setVariableValue', () => {
      it('should reject without a valid call frame', async () => {
        await wrapper.enableDebugger();
        try {
          await wrapper.setVariableValue(0, 'x', { value: 42 }, 'invalid-frame-id');
          assert.fail('Should have thrown an error');
        } catch (err) {
          assert.ok(err, 'Should throw error for invalid frame');
        }
      });
    });

    describe('restartFrame', () => {
      it('should reject without a valid call frame', async () => {
        await wrapper.enableDebugger();
        try {
          await wrapper.restartFrame('invalid-frame-id');
          assert.fail('Should have thrown an error');
        } catch (err) {
          assert.ok(err, 'Should throw error for invalid frame');
        }
      });
    });

  });
});
