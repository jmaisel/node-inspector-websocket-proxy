/**
 * Validation script for ServerManager
 * Tests that the server manager can detect and manage servers correctly
 */

const { createServerManager, isPortInUse } = require('./helpers/server-manager');

async function validateServerManager() {
    console.log('=== ServerManager Validation ===\n');

    // Check initial port states
    console.log('1. Checking initial port states...');
    const port8888 = await isPortInUse(8888);
    const port9229 = await isPortInUse(9229);
    const port8080 = await isPortInUse(8080);

    console.log(`   Port 8888 (proxy): ${port8888 ? 'IN USE' : 'FREE'}`);
    console.log(`   Port 9229 (debuggee): ${port9229 ? 'IN USE' : 'FREE'}`);
    console.log(`   Port 8080 (http-server): ${port8080 ? 'IN USE' : 'FREE'}`);

    // Create server manager
    console.log('\n2. Creating ServerManager with checkExisting=true...');
    const serverManager = createServerManager({
        checkExisting: true,
        proxyPort: 8888,
        inspectPort: 9229,
        debugScript: 'test/fixtures/busy-script.js'
    });

    // Start servers (should detect existing ones and only spawn missing)
    console.log('\n3. Starting servers...');
    const status = await serverManager.start();

    console.log('\n4. Server status:');
    console.log(`   Proxy (8888): running=${status.proxy.running}, spawned=${status.proxy.spawned}`);
    console.log(`   Debuggee (9229): running=${status.debuggee.running}, spawned=${status.debuggee.spawned}`);
    console.log(`   HTTP (8080): running=${status.http.running}, spawned=${status.http.spawned}`);

    // Verify ports are now in use
    console.log('\n5. Verifying ports are active...');
    const port8888After = await isPortInUse(8888);
    const port9229After = await isPortInUse(9229);

    console.log(`   Port 8888: ${port8888After ? '✓ ACTIVE' : '✗ NOT ACTIVE'}`);
    console.log(`   Port 9229: ${port9229After ? '✓ ACTIVE' : '✗ NOT ACTIVE'}`);

    // Wait a bit
    console.log('\n6. Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Stop servers (should only stop what we spawned)
    console.log('\n7. Stopping servers (only spawned ones)...');
    await serverManager.stop();

    // Check final port states
    console.log('\n8. Checking final port states...');
    const port8888Final = await isPortInUse(8888);
    const port9229Final = await isPortInUse(9229);

    console.log(`   Port 8888: ${port8888Final ? 'STILL IN USE' : 'FREE'}`);
    console.log(`   Port 9229: ${port9229Final ? 'STILL IN USE' : 'FREE'}`);

    console.log('\n=== Validation Complete ===');
    console.log('\nExpected behavior:');
    console.log('- Existing servers should be detected');
    console.log('- Missing servers should be spawned');
    console.log('- Only spawned servers should be stopped');
    console.log('- Manually-started servers should remain running');
}

// Run validation
if (require.main === module) {
    validateServerManager()
        .then(() => {
            console.log('\n✓ Validation successful\n');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n✗ Validation failed:', error.message);
            console.error(error.stack);
            process.exit(1);
        });
}

module.exports = { validateServerManager };