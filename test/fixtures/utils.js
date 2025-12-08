// Utility functions module
function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

module.exports = {
  add,
  multiply,
  fibonacci
};
