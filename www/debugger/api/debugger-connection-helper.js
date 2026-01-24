/**
 * DebuggerConnectionHelper - Handles debugger connection and initialization
 */
class DebuggerConnectionHelper {
    constructor(aceController) {
        this.ace = aceController;
        this.logger = new Logger("DebuggerConnectionHelper");
    }

    async connectToDebuggerWithSelectedFile() {
        if (!this.ace.selectedFileForDebugging) {
            alert("Please select a file from the file tree first");
            return;
        }

        this.logger.info(`Starting debug session for: ${this.ace.selectedFileForDebugging}`);

        try {
            // Start debug session via API
            const response = await this.ace.debuggerApiClient.startDebugSession(this.ace.selectedFileForDebugging);
            this.logger.info("Debug session response:", response);

            // Extract WebSocket URL from response
            const wsUrl = response.session ? response.session.wsUrl : response.wsUrl;

            if (wsUrl) {
                // Connect to the debugger using the WebSocket URL
                this.connectToDebugger(wsUrl);
            } else {
                throw new Error("No WebSocket URL in session response");
            }

        } catch (error) {
            this.logger.error("Failed to start debug session:", error);
            alert(`Failed to start debug session: ${error.message}`);
        }
    }

    connectToDebugger(wsUrl) {
        this.logger.info("connectToDebugger:", wsUrl);

        if (!this.ace.debuggerClientLoaded) {
            alert("Debugger client is still loading. Please wait and try again.");
            return;
        }

        if (typeof BaseDomainController === 'undefined') {
            alert("Debugger client failed to load. Check console for errors.");
            this.logger.error("BaseDomainController is undefined");
            return;
        }

        try {
            this.logger.info("Initializing Inspector Browser Proxy...");
            // Initialize the Inspector Browser Proxy
            this.ace.inspectorProxy = BaseDomainController.initialize(wsUrl);

            this.logger.info("Inspector proxy created, connecting to WebSocket...");

            // Set up timeout for connection
            this.ace.connectionTimeout = setTimeout(() => {
                this.logger.error("Connection timeout - Proxy.ready not received after 10 seconds");
                alert("Connection timeout. The debugger proxy may not be running or responding.\n\nPlease check:\n1. The node-inspector-websocket-proxy server is running\n2. The file path is correct\n3. Check the browser console for errors");
                if (this.ace.inspectorProxy && this.ace.inspectorProxy.ws) {
                    this.ace.inspectorProxy.ws.close();
                }
            }, 10000);

            // Subscribe to all messages for debugging
            this.ace.inspectorProxy.queue.subscribe(/.*/, (topic, data) => {
                this.logger.info(`Event received: ${topic}`, data);
            });

            // Subscribe to connection events
            this.ace.inspectorProxy.queue.subscribe(/^WebSocket\.open$/, () => {
                this.logger.info("✓ WebSocket connection established, waiting for Proxy.ready...");
            });

            // Wait for Proxy.ready event from the server before initializing
            this.ace.inspectorProxy.queue.subscribe('Proxy.ready', () => {
                this.logger.info("✓ Proxy is ready, initializing debugger...");
                clearTimeout(this.ace.connectionTimeout);
                this.onConnectionOpen();
            });

            this.ace.inspectorProxy.queue.subscribe(/^WebSocket\.close$/, (topic, data) => {
                this.logger.info("WebSocket connection closed", data);
                clearTimeout(this.ace.connectionTimeout);
                this.onConnectionClose();
            });

            this.ace.inspectorProxy.queue.subscribe(/^WebSocket\.error$/, (topic, data) => {
                this.logger.error("WebSocket error:", data);
                clearTimeout(this.ace.connectionTimeout);
                this.onConnectionError(data ? data.error : 'Unknown error');
            });

            // Store the WebSocket URL
            this.ace.debuggerUrl = wsUrl;

            // Publish event for other components
            if (this.ace.application) {
                this.ace.application.pub("debugger:connection:requested", {
                    url: wsUrl,
                    timestamp: Date.now()
                });
            }

            // Connect to the WebSocket
            this.logger.info("Calling inspectorProxy.connect()...");
            this.ace.inspectorProxy.connect();
            this.logger.info("connect() called, waiting for events...");

        } catch (error) {
            this.logger.error("Failed to connect to debugger:", error);
            clearTimeout(this.ace.connectionTimeout);
            alert(`Failed to connect to debugger: ${error.message}`);
        }
    }

    async onConnectionOpen() {
        this.logger.info("onConnectionOpen()");

        try {
            // Fetch workspace info to get the workspace root path
            try {
                const workspaceInfo = await this.ace.debuggerApiClient.getWorkspaceInfo();
                this.ace.workspaceInfo = workspaceInfo;
                this.logger.info("Workspace info loaded:", workspaceInfo);
            } catch (error) {
                this.logger.error("Failed to load workspace info:", error);
            }

            // Enable the debugger domains
            await this.ace.inspectorProxy.enable();

            this.logger.info("Debugger domains enabled successfully");

            // Activate breakpoints
            if (this.ace.inspectorProxy.debuggerController) {
                await this.ace.inspectorProxy.debuggerController.setBreakpointsActive(true);
                this.logger.info("Breakpoints activated");
            }

            // Set up debugger event listeners
            this.setupDebuggerListeners();

            // Connect GPIO WebSocket client (tied to debugger lifecycle)
            this.connectGPIOClient();

            // Publish connection success event
            if (this.ace.application) {
                this.ace.application.pub("debugger:connected", {
                    url: this.ace.debuggerUrl,
                    timestamp: Date.now()
                });
            }

            // Update UI
            this.showDebugControls();
            alert("Connected to debugger successfully!");

        } catch (error) {
            this.logger.error("Error during debugger initialization:", error);
            alert(`Error initializing debugger: ${error.message}`);
        }
    }

    onConnectionClose() {
        this.logger.info("onConnectionClose()");

        // Disconnect GPIO WebSocket client
        this.disconnectGPIOClient();

        // Clear debug markers
        if (this.ace.editorHelper) {
            this.ace.editorHelper.clearDebugMarkers();
        }

        // Hide debug controls
        this.hideDebugControls();

        // Publish disconnection event
        if (this.ace.application) {
            this.ace.application.pub("debugger:disconnected", {
                timestamp: Date.now()
            });
        }
    }

    connectGPIOClient() {
        this.logger.info("connectGPIOClient()");

        // Check if GPIOWebSocketClient is available
        if (typeof GPIOWebSocketClient === 'undefined') {
            this.logger.warn("GPIOWebSocketClient not available");
            return;
        }

        // Check if simulator exists
        const simulator = this.ace.application?.simulator;
        if (!simulator) {
            this.logger.warn("Simulator not available for GPIO connection");
            return;
        }

        // Create and connect GPIO client
        try {
            this.ace.application.gpioClient = new GPIOWebSocketClient(simulator, {
                logger: this.logger,
                serverUrl: 'ws://localhost:8081',
                autoReconnect: false
            });

            this.ace.application.gpioClient.connect();
            this.logger.info("GPIO WebSocket client connected");

        } catch (error) {
            this.logger.error("Failed to connect GPIO client:", error);
        }
    }

    disconnectGPIOClient() {
        this.logger.info("disconnectGPIOClient()");

        if (this.ace.application?.gpioClient) {
            try {
                this.ace.application.gpioClient.disconnect();
                this.logger.info("GPIO WebSocket client disconnected");
            } catch (error) {
                this.logger.error("Failed to disconnect GPIO client:", error);
            }
        }
    }

    onConnectionError(error) {
        this.logger.error("onConnectionError:", error);

        // Publish error event
        if (this.ace.application) {
            this.ace.application.pub("debugger:error", {
                error: error,
                timestamp: Date.now()
            });
        }
    }

    setupDebuggerListeners() {
        this.logger.info("setupDebuggerListeners()");

        const debuggerController = this.ace.inspectorProxy.debuggerController;

        // Listen for paused events (breakpoint hit, step, etc.)
        debuggerController.on("Debugger.paused", (params) => {
            this.logger.info("Debugger paused:", params);
            if (this.ace.debuggerEventHelper) {
                this.ace.debuggerEventHelper.onDebuggerPaused(params);
            }
        });

        // Listen for resumed events
        debuggerController.on("Debugger.resumed", () => {
            this.logger.info("Debugger resumed");
            if (this.ace.debuggerEventHelper) {
                this.ace.debuggerEventHelper.onDebuggerResumed();
            }
        });

        // Listen for script parsed events (new scripts loaded)
        debuggerController.on("Debugger.scriptParsed", (params) => {
            this.logger.info("Script parsed:", params);
            if (this.ace.debuggerEventHelper) {
                this.ace.debuggerEventHelper.onScriptParsed(params);
            }
        });

        // Listen for breakpoint resolved events
        debuggerController.on("Debugger.breakpointResolved", (params) => {
            this.logger.info("Breakpoint resolved:", params);

            // Forward to debug toolbar helper if available
            if (this.ace.debugToolbarHelper) {
                this.ace.debugToolbarHelper.onBreakpointResolved(params);
            }
        });

        // Listen for console messages via Runtime
        const runtimeController = this.ace.inspectorProxy.runtimeController;
        runtimeController.on("Runtime.consoleAPICalled", (params) => {
            this.logger.info("Console API called:", params);
            if (this.ace.debuggerEventHelper) {
                this.ace.debuggerEventHelper.onConsoleMessage(params);
            }
        });

        this.logger.info("Debugger listeners set up");
    }

    showDebugControls() {
        this.logger.info("showDebugControls()");

        // Show all debug control buttons and separators
        $('.debug-control').show();
        $('.debug-control-separator').show();

        // Hide the Debug start button since we're now connected
        $('#debug-start-btn').hide();

        this.logger.info("Debug controls now visible");
    }

    hideDebugControls() {
        this.logger.info("hideDebugControls()");

        // Hide all debug control buttons and separators
        $('.debug-control').hide();
        $('.debug-control-separator').hide();

        // Show the Debug start button again
        $('#debug-start-btn').show();

        this.logger.info("Debug controls now hidden");
    }
}
