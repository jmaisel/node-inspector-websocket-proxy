// Script that continuously runs JavaScript for immediate pause testing
console.log('Busy script started - running continuous loop');

let counter = 0;

function busyWork() {
  counter++;

  // Do some work
  for (let i = 0; i < 1000000; i++) {
    Math.sqrt(i);
  }

  
  if(counter % 10000 === 0 )
	console.log(`Iteration ${counter} completed`);

  // Immediately schedule the next iteration
  setImmediate(busyWork);
}

// Start the busy loop
busyWork();
