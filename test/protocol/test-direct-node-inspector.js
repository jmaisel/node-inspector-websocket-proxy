// Test connecting DIRECTLY to Node inspector (bypassing our proxy)
// to see if the issue is in our proxy or in Node's inspector itself

const { spawn } = require('child_process');
const WebSocket = require('ws');

// Spawn a simple Node process with inspector
console.log('Starting Node with --inspect...');
const proc = spawn('node', ['--inspect=9230', '-e', 'setInterval(() => {}, 1000)']);

proc.stderr.on('data', (data) => {
  const output = data.toString();
  process.stderr.write(output);

  // Extract debugger WS URL
  const match = output.match(/(ws:\/\/\S+)/);
  if (match) {
    const wsUrl = match[0];
    console.log('\n✅ Got debugger URL:', wsUrl);

    // Connect directly
    setTimeout(() => testDirectConnection(wsUrl), 500);
  }
});

function testDirectConnection(wsUrl) {
  console.log('\n🔌 Connecting directly to Node inspector...');
  const ws = new WebSocket(wsUrl);
  let gotResponse = false;

  ws.on('open', () => {
    console.log('✅ Connected\n');
    console.log('Sending Runtime.enable with id 999...');
    ws.send(JSON.stringify({id: 999, method: 'Runtime.enable', params: {}}));

    setTimeout(() => {
      console.log('\nResult:', gotResponse ? '✅ Response received' : '❌ NO response');
      ws.close();
      proc.kill();
      process.exit(gotResponse ? 0 : 1);
    }, 1000);
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id === 999) {
      console.log('✅ GOT RESPONSE:', JSON.stringify(msg, null, 2));
      gotResponse = true;
    } else if (msg.id !== undefined) {
      console.log('   (response for different id:', msg.id, ')');
    }
  });
}