/**
 * WebSocket Protocol Event Queue
 *
 * Manages WebSocket connection to Chrome DevTools Protocol,
 * sending commands and routing responses/events via RegexPubSub.
 */

const METHOD_TYPE = {
  RESPONSE: "RESPONSE",
  EVENT: "EVENT"
}

class WebsocketProtocolEventQueue {

  constructor(wsSpec) {
    console.log("new WebsocketProtocolEventQueue", wsSpec);
    this.queue = new RegexPubSub();
    this.consoleController = new ConsoleController();
    this.runtimeController = new RuntimeController();
    this.debuggerController = new DebuggerController();
    this.messageId = 1;
    this.wsSpec = wsSpec;
  }

  connect(){

    console.log("connecting to " + this.wsSpec);

    this.ws = new WebSocket(this.wsSpec);

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
    this.queue.publish('WebSocket.open', {});
  }

  close = ()=>{
    console.log('🔌 Connection closed');
    this.queue.publish('WebSocket.close', {});
  }

  error = (error)=>{
    console.error('❌ WebSocket error:', error);
    this.queue.publish('WebSocket.error', { error });
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
      message.type = METHOD_TYPE.RESPONSE;
      this.queue.publish(`response:${message.id}`, message);

    }
    else if (hasMethod && !hasId) {
      message.type = METHOD_TYPE.EVENT;
      this.queue.publish(message.method, message);
    }
    else if (hasId && hasMethod) {
      console.warn(`   Type: ⚠️  AMBIGUOUS (has both id and method) message:`, message);
    }
    else {
      console.warn(`   Type: ⚠️  UNKNOWN message type:`, message);
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

  async enable() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    try {
      console.log('Enabling Console domain...');
      const consoleResult = await this.consoleController.enable();
      console.log('Console.enable result:', consoleResult);

      // Also enable Runtime to get consoleAPICalled events
      console.log('Enabling Runtime domain...');
      const runtimeResult = await this.runtimeController.enable();
      console.log('Runtime.enable result:', runtimeResult);
      console.log('Runtime domain enabled - you should see console.log events');

      return { consoleResult, runtimeResult };
    } catch (error) {
      console.error('Error enabling Console/Runtime:', error);
      throw error;
    }
  }

}