/**
 * Example: Pithagoras GPIO Usage
 *
 * This demonstrates how to control GPIO pins in the CircuitJS1 simulator
 * Run this while node-inspector-websocket-proxy is running and Pithagoras is connected
 */

const GPIO = require('./gpio-driver.js');

async function provideInput(gpio, pinNumber) {
    console.log(`\nConfiguring GPIO${pinNumber} as providing input (code -> circuit)...`);
    await gpio.pin(pinNumber).input();

    console.log(`Blinking GPIO${pinNumber} HIGH/LOW every second...`);
    let count = 0;
    return setInterval(async () => {
        const state = count % 2;
        console.log(`  GPIO${pinNumber}: ${state ? 'HIGH' : 'LOW'}`);

        await (state ? gpio.pin(pinNumber).high() : gpio.pin(pinNumber).low());
        count++;
    }, 1000);
}

async function readOutput(gpio, pinNumber) {
    console.log(`\nConfiguring GPIO${pinNumber} as output (circuit -> code)...`);
    await gpio.pin(pinNumber).output();

    console.log(`Monitoring GPIO${pinNumber} for changes...`);
    gpio.pin(pinNumber).onChange((state, voltage) => {
        console.log(`  GPIO${pinNumber} changed: ${state ? 'HIGH' : 'LOW'} (${voltage.toFixed(3)}V)`);
    });
}

async function main() {
    console.log('Starting GPIO example...');

    const gpio = new GPIO({
        mode: 'simulator',
        clientName: 'GPIO Example'
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Connected to GPIO server');

    await readOutput(gpio, 22);
    await provideInput(gpio, 17);

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