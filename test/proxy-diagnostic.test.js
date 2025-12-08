const assert = require('assert');
const path = require('path');
const RemoteDebuggerProxyServer = require('../inspector-proxy-factory');
const WebSocket = require('ws');

describe('Proxy Diagnostic Test', function() {
    this.timeout(20000);

    let proxy;
    const proxyPort = 9260;
    const inspectPort = 9261;
    const testScript = path.join(__dirname, 'fixtures', 'busy-script.js');

    before(function(done) {
        console.log('\n=== Starting Proxy Diagnostic ===\n');

        proxy = new RemoteDebuggerProxyServer(testScript, {
            inspectPort,
            proxyPort
        });

        proxy.start();

        // Wait for everything to be ready
        setTimeout(() => {
            console.log('Proxy should be ready now');
            done();
        }, 2000);
    });

    after(function() {
        if (proxy) {
            proxy.stop();
        }
    });

    it('should accept WebSocket connection', function(done) {
        const ws = new WebSocket(`ws://localhost:${proxyPort}`);

        ws.on('open', () => {
            console.log('✓ WebSocket connected to proxy');
            ws.close();
            done();
        });

        ws.on('error', (err) => {
            done(err);
        });
    });

    it('should forward simple CDP command', function(done) {
        const ws = new WebSocket(`ws://localhost:${proxyPort}`);
        let responseReceived = false;

        ws.on('open', () => {
            console.log('✓ WebSocket connected');

            // Send a simple CDP command
            const command = JSON.stringify({
                id: 1,
                method: 'Runtime.evaluate',
                params: { expression: '1 + 1' }
            });

            console.log('Sending command:', command);
            ws.send(command);

            // Set a timeout
            setTimeout(() => {
                if (!responseReceived) {
                    ws.close();
                    done(new Error('No response received from proxy after 5 seconds'));
                }
            }, 5000);
        });

        ws.on('message', (data) => {
            console.log('✓ Received response:', data.toString());
            responseReceived = true;

            try {
                const response = JSON.parse(data.toString());
                console.log('Parsed response:', JSON.stringify(response, null, 2));

                if (response.id === 1) {
                    console.log('✓ Response ID matches');
                    ws.close();
                    done();
                }
            } catch (err) {
                done(err);
            }
        });

        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
            done(err);
        });
    });
});
