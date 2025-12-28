/**
 * ConnectionManager - A dockable widget for managing WebSocket connections
 * to the Chrome DevTools Protocol proxy
 *
 * Features:
 * - Toolbar with Connect/Disconnect button
 * - Automatic domain enabling (Console, Runtime, Debugger) on connection
 * - Status indicator showing connection state
 * - Event-driven architecture using InspectorBrowserProxy
 */
class ConnectionManager extends DockableWidget {
  constructor(element, options = {}) {
    super(element, options);

    // Add EventEmitter capabilities via composition
    this._eventEmitter = new EventEmitter();

    this.options = {
      wsUrl: options.wsUrl || 'ws://localhost:8888',
      autoEnable: options.autoEnable !== false,
      ...this.options
    };

    this.proxy = null;
    this.isConnected = false;
    this.connectionState = 'disconnected'; // 'disconnected', 'connecting', 'connected', 'error'

    this.render();
    this.attachEventListeners();
  }

  // EventEmitter delegation methods
  on(event, listener) {
    return this._eventEmitter.on(event, listener);
  }

  off(event, listener) {
    return this._eventEmitter.off(event, listener);
  }

  emit(event, ...args) {
    return this._eventEmitter.emit(event, ...args);
  }

  once(event, listener) {
    return this._eventEmitter.once(event, listener);
  }

  /**
   * Renders the connection manager UI
   */
  render() {
    this.element.innerHTML = `
      <div class="connection-manager">
        <div class="connection-toolbar">
          <button class="connect-btn" data-action="connect">
            Connect
          </button>
          <div class="connection-status">
            <span class="status-indicator" data-status="disconnected"></span>
            <span class="status-text">Disconnected</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attaches event listeners to UI elements
   */
  attachEventListeners() {
    const connectBtn = this.element.querySelector('.connect-btn');
    connectBtn.addEventListener('click', () => this.handleConnectClick());
  }

  /**
   * Handles connect/disconnect button click
   */
  async handleConnectClick() {
    if (this.isConnected) {
      await this.disconnect();
    } else {
      await this.connect();
    }
  }

  /**
   * Connects to the WebSocket proxy
   */
  async connect() {
    if (this.isConnected) {
      console.warn('Already connected');
      return;
    }

    try {
      this.updateStatus('connecting', 'Connecting...');

      // Initialize the proxy if not already created
      if (!this.proxy) {
        console.log('Initializing InspectorBrowserProxy...');
        this.proxy = BaseDomainController.initialize(this.options.wsUrl);

        // Subscribe to connection events
        this.setupProxyEventListeners();
      }

      // Connect to WebSocket
      console.log('Connecting to WebSocket at', this.options.wsUrl);
      await this.proxy.connect();

    } catch (error) {
      console.error('Connection failed:', error);
      this.updateStatus('error', 'Connection failed');
      this.showError(error.message);
    }
  }

  /**
   * Sets up event listeners for proxy events
   */
  setupProxyEventListeners() {
    // Listen for WebSocket open event (Proxy.ready)
    this.proxy.queue.subscribe('^WebSocket\\.open$', async (topic, data) => {
      console.log('WebSocket connection opened - Proxy is ready');
      await this.onProxyReady();
    });

    // Listen for WebSocket close event
    this.proxy.queue.subscribe('^WebSocket\\.close$', (topic, data) => {
      console.log('WebSocket connection closed');
      this.onProxyDisconnected();
    });

    // Listen for WebSocket error event
    this.proxy.queue.subscribe('^WebSocket\\.error$', (topic, data) => {
      console.error('WebSocket error:', data.error);
      this.updateStatus('error', 'Connection error');
      this.onProxyError(data.error);
    });
  }

  /**
   * Called when the proxy is ready (WebSocket.open event)
   * Enables Console, Runtime, and Debugger domains
   */
  async onProxyReady() {
    console.log('Proxy ready - enabling domains...');

    try {
      if (this.options.autoEnable) {
        // Enable Console, Runtime, and Debugger domains
        console.log('Enabling Console, Runtime, and Debugger domains...');
        const results = await this.proxy.enable();

        console.log('All domains enabled:', results);

        this.isConnected = true;
        this.updateStatus('connected', 'Connected');

        // Emit custom event for other components
        this.emit('connected', { proxy: this.proxy });
      } else {
        this.isConnected = true;
        this.updateStatus('connected', 'Connected (domains not enabled)');
        this.emit('connected', { proxy: this.proxy });
      }

    } catch (error) {
      console.error('Failed to enable domains:', error);
      this.updateStatus('error', 'Domain enable failed');
      this.showError('Failed to enable domains: ' + error.message);
    }
  }

  /**
   * Called when the proxy disconnects
   */
  onProxyDisconnected() {
    this.isConnected = false;
    this.updateStatus('disconnected', 'Disconnected');
    this.emit('disconnected');
  }

  /**
   * Called when a proxy error occurs
   */
  onProxyError(error) {
    this.emit('error', { error });
  }

  /**
   * Disconnects from the WebSocket proxy
   */
  async disconnect() {
    if (!this.isConnected || !this.proxy || !this.proxy.ws) {
      console.warn('Not connected');
      return;
    }

    try {
      console.log('Disconnecting...');
      this.proxy.ws.close();
      this.isConnected = false;
      this.updateStatus('disconnected', 'Disconnected');
    } catch (error) {
      console.error('Disconnect failed:', error);
      this.showError(error.message);
    }
  }

  /**
   * Updates the connection status display
   */
  updateStatus(status, text) {
    this.connectionState = status;

    const indicator = this.element.querySelector('.status-indicator');
    const statusText = this.element.querySelector('.status-text');
    const connectBtn = this.element.querySelector('.connect-btn');

    if (indicator) {
      indicator.setAttribute('data-status', status);
    }

    if (statusText) {
      statusText.textContent = text;
    }

    if (connectBtn) {
      if (status === 'connecting') {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';
      } else if (status === 'connected') {
        connectBtn.disabled = false;
        connectBtn.textContent = 'Disconnect';
      } else {
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
      }
    }
  }

  /**
   * Shows an error message
   */
  showError(message) {
    // Simple error display - can be enhanced
    console.error('ConnectionManager error:', message);
    alert('Error: ' + message);
  }

  /**
   * Gets the current proxy instance
   */
  getProxy() {
    return this.proxy;
  }

  /**
   * Gets the connection state
   */
  getConnectionState() {
    return {
      isConnected: this.isConnected,
      state: this.connectionState,
      wsUrl: this.options.wsUrl
    };
  }

  /**
   * Cleanup when destroying the widget
   */
  destroy() {
    if (this.isConnected) {
      this.disconnect();
    }
    super.destroy();
  }
}

// Attach to window for browser usage
if (typeof window !== 'undefined') {
  window.ConnectionManager = ConnectionManager;
}

export default ConnectionManager;