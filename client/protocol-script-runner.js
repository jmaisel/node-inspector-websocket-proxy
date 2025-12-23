/**
 * Protocol Script Runner
 *
 * A simple script to connect to the debugger WebSocket, send commands,
 * and echo responses. Useful for testing Chrome DevTools Protocol commands.
 */

// const WebSocket = require('ws');

// Configuration
const DEBUGGER_HOST = 'localhost';
const DEBUGGER_PORT = 8888;
const DEBUGGER_URL = `ws://${DEBUGGER_HOST}:${DEBUGGER_PORT}`;

const METHOD_TYPE = {
  RESPONSE: "RESPONSE",
  EVENT: "EVENT"
}

class WebsocketProtocolEventQueue{

  constructor(wsSpec) {
    this.queue = new RegexPubSub();
    this.messageId = 1;
    this.ws = new WebSocket(wsSpec);

    this.ws.addEventListener('open', this.open);

    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      this.message(message);
      console.log(`message: ${JSON.stringify(message, null, 2)}`)
    });

    this.ws.addEventListener('error', this.error);
    this.ws.addEventListener('close', this.close);
  }

  open = ()=>{
    console.log("connection opened");
  }

  close = ()=>{
    console.log('🔌 Connection closed');
  }

  error = (error)=>{
    console.error('❌ WebSocket error:', error);
  }

  message = (message)=>{
    // Analyze message structure
    const hasId = message.id !== undefined;
    const hasMethod = message.method !== undefined;
    const hasResult = message.result !== undefined;
    const hasError = message.error !== undefined;
    const hasParams = message.params !== undefined;

    // Classify the message
    if (hasId && !hasMethod) {
      console.log(`   Type: RESPONSE (to command id ${message.id})`);
      console.log('\n📥 Response:');
      message.type = METHOD_TYPE.RESPONSE;

      this.queue.publish(`response:${message.id}`, message);

    } else if (hasMethod && !hasId) {
      console.log(`   Type: EVENT (${message.method})`);
      console.log('\n📢 Event:');
      message.type = METHOD_TYPE.EVENT;

      this.queue.publish(message.method, message);

    } else if (hasId && hasMethod) {
      console.warn(`   Type: ⚠️  AMBIGUOUS (has both id and method)`);
      console.warn('\n⚠️  Message:', message);
    } else {
      console.warn(`   Type: ⚠️  UNKNOWN`);
      console.warn('\n⚠️  Message:', message);
    }

    console.log(JSON.stringify(message, null, 2));
    console.log('='.repeat(60));
  }

  send(method, params={}){
    const command = {
      id: this.messageId++,
      method: method,
      params: params
    };

    console.log('==> Sending command:');
    console.log(JSON.stringify(command, null, 2));

    this.ws.send(JSON.stringify(command));
    return command.id;
  }

}



/**
 * Main function
 */
async function main() {
  console.log(`🔌 Connecting to debugger at ${DEBUGGER_URL}...`);

  const clientProxyQueue = new WebsocketProtocolEventQueue("ws://localhost:8888");

  clientProxyQueue.queue.subscribe("Proxy.ready", ()=>{
    console.log("proxy ready!")
    clientProxyQueue.send("Console.enable");
    // clientProxyQueue.send("Debugger.enabled");
    // clientProxyQueue.send("Runtime.enabled");
  });

  clientProxyQueue.queue.subscribe("Console.enabled", ()=>{
    clientProxyQueue.send("Debugger.enabled");
  })

}

// Run the script
main().catch(error => {
  // console.error('Fatal error:', error);
});
