// Main application that uses calculator and utils
const Calculator = require('./calculator');
const { fibonacci } = require('./utils');

function runCalculations() {
  const calc = new Calculator();

  // Perform some calculations
  console.log('Starting calculations...');

  const sum = calc.addNumbers(5, 3);
  console.log(`Sum: ${sum}`);

  const product = calc.multiplyNumbers(4, 7);
  console.log(`Product: ${product}`);

  const result = calc.calculate('add', 10, 20);
  console.log(`Calculate result: ${result}`);

  // Calculate fibonacci
  const fibResult = fibonacci(6);
  console.log(`Fibonacci(6): ${fibResult}`);

  // Some additional operations
  for (let i = 0; i < 3; i++) {
    calc.addNumbers(i, i + 1);
  }

  console.log('Calculations complete!');
  return calc.getResult();
}

// Keep process alive for debugging
if (require.main === module) {
  runCalculations();
  // Wait a bit before exiting to allow debugging
  setTimeout(() => {
    console.log('Exiting...');
    process.exit(0);
  }, 5000);
}

module.exports = { runCalculations };
