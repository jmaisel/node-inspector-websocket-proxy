/**
 * WebSocket Protocol Event Queue
 *
 * Manages WebSocket connection to Chrome DevTools Protocol,
 * sending commands and routing responses/events via RegexPubSub.
 */

const METHOD_TYPE = {
  RESPONSE: 'RESPONSE',
  EVENT: 'EVENT'
};

class InspectorBrowserProxy {

  constructor(wsSpec, options = {}) {
    console.log('new InspectorBrowserProxy', wsSpec);
    this.queue = new RegexPubSub();
    this.messageId = 1;
    this.wsSpec = wsSpec;
    this.options = options;
    // Controllers will be initialized after this instance is set as static eventQueue
    this.consoleController = null;
    this.runtimeController = null;
    this.debuggerController = null;
    // Session guard (if provided)
    this.sessionGuard = options.sessionGuard || null;
  }

  /**
   * Initialize controllers after the eventQueue is set as static instance
   * This must be called after BaseDomainController.eventQueue is set
   */
  initControllers() {
    this.consoleController = new ConsoleController();
    this.runtimeController = new RuntimeController();
    this.debuggerController = new DebuggerController();
  }

  async connect(){

    // ⚠️ STATE ENFORCEMENT: Check if session guard is enabled
    if (this.sessionGuard) {
      console.log('🔒 Checking for active debug session...');
      try {
        const session = await this.sessionGuard.getActiveSession();
        console.log('✓ Active session found:', session.sessionId);
      } catch (error) {
        console.error('✗ Cannot connect: ' + error.message);
        console.error('💡 Start a session first via POST /debug/session or click Debug on a file');
        throw error;
      }
    }

    console.log('connecting to ' + this.wsSpec);

    this.ws = new WebSocket(this.wsSpec);

    this.ws.addEventListener('open', this.open);

    this.ws.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        this.message(message);
        console.log(`message: ${JSON.stringify(message, null, 2)}`);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error, event.data);
      }
    });

    this.ws.addEventListener('error', this.error);
    this.ws.addEventListener('close', this.close);
  }

  open = ()=>{
    console.log('connection opened');
    this.queue.publish('WebSocket.open', {});
  };

  close = ()=>{
    console.log('🔌 Connection closed');
    this.queue.publish('WebSocket.close', {});
  };

  error = (error)=>{
    console.error('❌ WebSocket error:', error);
    this.queue.publish('WebSocket.error', { error });
  };

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

    // console.log(JSON.stringify(message, null, 2));
    // console.log('='.repeat(60));
  };

  send(method, params={}){
    const command = {
      id: this.messageId++,
      method: method,
      params: params
    };

    console.log('==> Sending command:', command);
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

      console.log('Enabling Debugger domain...');
      const debuggerResult = await this.debuggerController.enable();
      // runtimeResult.runIfWaitingForDebugger();
      console.log('Debugger.enable result:', debuggerResult);

      return { consoleResult, runtimeResult, debuggerResult };
    } catch (error) {
      console.error('Error enabling Console/Runtime/Debugger:', error);
      throw error;
    }
  }

}