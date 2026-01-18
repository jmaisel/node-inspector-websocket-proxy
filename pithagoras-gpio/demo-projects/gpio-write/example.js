/**
 * GPIO Write Example
 *
 * Demonstrates controlling GPIO pins by writing HIGH/LOW states
 * to the CircuitJS1 simulator. This toggles GPIO17 (input pin)
 * every second to drive the circuit.
 */

const GPIO = require('./gpio-driver.js');

async function main() {
    console.log('GPIO Write Example');
    console.log('===================');
    console.log('This example toggles GPIO17 HIGH/LOW every second.\n');

    // Create GPIO controller (connects to simulator)
    const gpio = new GPIO({
        mode: 'simulator',
        clientName: 'GPIO Write Example'
    });

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Connected to GPIO server\n');

    // Configure GPIO17 as input (we control it from code)
    console.log('Configuring GPIO17 as input (code-controlled)...');
    await gpio.pin(17).input();

    // Blink GPIO17 HIGH/LOW every second
    console.log('Toggling GPIO17 every second...\n');

    let count = 0;
    const interval = setInterval(async () => {
        const state = count % 2;
        const stateStr = state ? 'HIGH' : 'LOW';

        console.log(`Setting GPIO17 to ${stateStr}`);

        if (state) {
            await gpio.pin(17).high();
        } else {
            await gpio.pin(17).low();
        }

        count++;

        // Stop after 10 toggles
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
