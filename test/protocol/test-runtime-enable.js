const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8888');
let msgCount = 0;
let gotResponse = false;

ws.on('open', () => {
  console.log('Sending Runtime.enable...');
  ws.send(JSON.stringify({id: 999, method: 'Runtime.enable', params: {}}));

  setTimeout(() => {
    console.log('\nSummary:');
    console.log('  Total messages received:', msgCount);
    console.log('  Got response for id 999:', gotResponse ? 'YES ✅' : 'NO ❌');
    ws.close();
  }, 1500);
});

ws.on('message', (data) => {
  msgCount++;
  const msg = JSON.parse(data.toString());
  if (msg.id === 999) {
    console.log('✅ GOT RESPONSE for id 999:', JSON.stringify(msg, null, 2));
    gotResponse = true;
  } else if (msg.id !== undefined) {
    console.log('Got response for different id:', msg.id);
  }
});

ws.on('close', () => process.exit(0));