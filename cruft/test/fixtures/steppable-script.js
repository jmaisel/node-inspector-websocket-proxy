/**
 * Test fixture with multiple functions for testing step commands
 * This script has multiple functions with different call patterns
 */

console.log('Steppable script started');

let counter = 0;

function simpleFunction() {
    console.log('Inside simpleFunction');
    counter++;
    return counter;
}

function nestedFunction() {
    console.log('Inside nestedFunction - before call');
    const result = simpleFunction();
    console.log('Inside nestedFunction - after call, result:', result);
    return result * 2;
}

function loopFunction() {
    console.log('Inside loopFunction');
    for (let i = 0; i < 3; i++) {
        console.log('Loop iteration:', i);
        counter += i;
    }
    return counter;
}

// Main execution loop
console.log('Starting main loop');

setInterval(() => {
    console.log('\n--- Iteration', counter, '---');

    const simple = simpleFunction();
    console.log('Simple result:', simple);

    const nested = nestedFunction();
    console.log('Nested result:', nested);

    const loop = loopFunction();
    console.log('Loop result:', loop);

    console.log('Counter is now:', counter);
}, 1000); // Run every 10 seconds to allow time for debugging