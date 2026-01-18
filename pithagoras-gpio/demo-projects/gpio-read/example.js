/**
 * GPIO Read Example
 *
 * Demonstrates reading GPIO pin state changes from the CircuitJS1 simulator.
 * This registers a callback on GPIO22 (output pin) to receive state changes
 * when the circuit drives the pin.
 */

const GPIO = require('./gpio-driver.js');

async function main() {
    console.log('GPIO Read Example');
    console.log('==================');
    console.log('This example monitors GPIO22 for state changes from the circuit.\n');

    // Create GPIO controller (connects to simulator)
    const gpio = new GPIO({
        mode: 'simulator',
        clientName: 'GPIO Read Example'
    });

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Connected to GPIO server\n');

    // Configure GPIO22 as output (circuit controls it, we read it)
    console.log('Configuring GPIO22 as output (circuit-controlled)...');
    await gpio.pin(22).output();

    // Register callback for GPIO22 changes
    console.log('Listening for GPIO22 state changes...\n');
    gpio.pin(22).onChange((state, voltage) => {
        const stateStr = state ? 'HIGH' : 'LOW';
        console.log(`GPIO22: ${stateStr} (${voltage.toFixed(3)}V)`);
    });

    console.log('Waiting for circuit to change GPIO22...');
    console.log('Press Ctrl+C to exit.\n');

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
        console.log('\nDisconnecting...');
        gpio.disconnect();
        process.exit(0);
    });
}

main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
