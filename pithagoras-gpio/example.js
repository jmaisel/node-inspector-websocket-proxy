/**
 * Example: Pithagoras GPIO Usage
 *
 * This demonstrates how to control GPIO pins in the CircuitJS1 simulator
 * Run this while node-inspector-websocket-proxy is running and Pithagoras is connected
 */

const GPIO = require('./gpio-driver.js');

async function main() {
    console.log('Starting GPIO example...');

    // Create GPIO controller (connects to simulator)
    const gpio = new GPIO({
        mode: 'simulator',
        clientName: 'GPIO Example'
    });

    // Wait a moment for connection
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Connected to GPIO server');

    // Configure GPIO17 as input (we control it)
    console.log('\nConfiguring GPIO17 as input...');
    await gpio.pin(17).input();

    // Configure GPIO22 as output (circuit controls it, we read it)
    console.log('Configuring GPIO22 as output...');
    await gpio.pin(22).output();

    // Register callback for GPIO22 changes
    console.log('Registering callback for GPIO22 output changes...');
    gpio.pin(22).onChange((state, voltage) => {
        console.log(`  GPIO22 changed: state=${state}, voltage=${voltage.toFixed(3)}V`);
    });

    // Blink GPIO17 (input from code's perspective)
    console.log('\nBlinking GPIO17 HIGH/LOW every second...');
    let count = 0;
    const interval = setInterval(async () => {
        const state = count % 2;
        console.log(`  Setting GPIO17 to ${state ? 'HIGH' : 'LOW'}`);

        if (state) {
            await gpio.pin(17).high();
        } else {
            await gpio.pin(17).low();
        }

        count++;

        // Stop after 10 blinks
        if (count >= 10) {
            clearInterval(interval);
            console.log('\nExample complete. Press Ctrl+C to exit.');
        }
    }, 1000);

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