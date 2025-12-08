// Simple script for debugging demonstration
console.log('Simple script started');

function fibonacci(n) {
  if (n <= 1) {
    return n;
  }
  return fibonacci(n - 1) + fibonacci(n - 2);
}

function greet(name) {
  const message = `Hello, ${name}!`;
  console.log(message);
  return message;
}

function calculateSum(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum;
}

// Main execution
const name = 'Badgerbox';
greet(name);

const numbers = [1, 2, 3, 4, 5];
const sum = calculateSum(numbers);
console.log('Sum:', sum);

const fib = fibonacci(10);
console.log('Fibonacci(10):', fib);

// Keep the process alive and responsive to pause commands
// Use setImmediate to continuously yield control but remain active
let iterationCount = 0;
function keepAlive() {
  iterationCount++;

  // Only log occasionally to avoid spam
  if (iterationCount % 1000000 === 0) {
    console.log('Script is running... (iteration', iterationCount, ')');
  }

  // Yield control but immediately schedule next iteration
  // This keeps JavaScript executing so pause/breakpoints work immediately
  setImmediate(keepAlive);
}

console.log('Starting keep-alive loop (script will be responsive to debugger)');
keepAlive();
