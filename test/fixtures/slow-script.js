// A slow script that gives debugger time to pause

// Keep running for a bit
if (require.main === module) {
  debugger; // Force debugger to pause here at top level
  console.log('After debugger statement');

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += i;
  }

  console.log('Result:', sum);

  // Keep the process alive longer
  setTimeout(() => {
    console.log('Exiting...');
    process.exit(0);
  }, 10000);
}
