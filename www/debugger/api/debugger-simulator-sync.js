/**
 * DebuggerSimulatorSyncController
 *
 * Synchronizes the CircuitJS1 simulator's pause/resume state with the debugger
 * when the application is in design mode.
 *
 * Behavior:
 * - In design mode:
 *   - simulator starts when debugger connects
 *   - simulator pauses when debugger pauses
 *   - simulator resumes when debugger resumes
 *   - simulator stops when debugger disconnects
 * - In build mode: no automatic synchronization (user controls simulator independently)
 * - Handles edge cases: mode switching while paused, debugger disconnect, etc.
 */
class DebuggerSimulatorSyncController {
    constructor() {
        this.logger = new Logger("DebuggerSimulatorSyncController");
        this.application = null;
        this.simulator = null;

        // Track internal state
        this.isDebuggerPaused = false;
        this.wasSimulatorRunningBeforePause = false;
        this.subscriptions = [];
    }

    /**
     * Initialize with application context
     * @param {Object} application - Application context with simulator, store, pub/sub
     */
    setCtx(application) {
        this.logger.info("setCtx", application);
        this.application = application;
        this.simulator = application.simulator;

        // Bind event subscriptions
        this.bind();
    }

    /**
     * Bind to debugger and mode events
     */
    bind() {
        this.logger.info("bind() - Setting up debugger-simulator sync");

        // Subscribe to debugger:paused event
        const pausedSub = this.application.sub(/^debugger:paused$/, (topic, data) => {
            this.handleDebuggerPaused(topic, data);
        });
        this.subscriptions.push(pausedSub);

        // Subscribe to debugger:resumed event
        const resumedSub = this.application.sub(/^debugger:resumed$/, (topic, data) => {
            this.handleDebuggerResumed(topic, data);
        });
        this.subscriptions.push(resumedSub);

        // Subscribe to debugger:connected event (start simulator when debugging begins)
        const connectedSub = this.application.sub(/^debugger:connected$/, (topic, data) => {
            this.handleDebuggerConnected(topic, data);
        });
        this.subscriptions.push(connectedSub);

        // Subscribe to debugger:disconnected event (cleanup)
        const disconnectedSub = this.application.sub(/^debugger:disconnected$/, (topic, data) => {
            this.handleDebuggerDisconnected(topic, data);
        });
        this.subscriptions.push(disconnectedSub);

        // Subscribe to mode change events (handle edge case of switching modes while paused)
        const modeChangedSub = this.application.sub(/^mode:changed$/, (topic, data) => {
            this.handleModeChanged(topic, data);
        });
        this.subscriptions.push(modeChangedSub);

        this.logger.info("Debugger-simulator sync subscriptions established");
    }

    /**
     * Handle debugger paused event
     * If in design mode, always pause the simulator
     */
    handleDebuggerPaused(topic, data) {
        this.logger.info("handleDebuggerPaused", { topic, data });

        const currentMode = this.application.store.get('mode');
        this.logger.info(`Current mode: ${currentMode}, Debugger paused: ${data.reason}`);

        // Only sync simulator if we're in design mode
        if (currentMode === 'design') {
            // Always pause simulator when debugger pauses
            this.logger.info("Pausing simulator due to debugger pause");
            this.simulator.setSimRunning(false);
        } else {
            this.logger.info("Not in design mode, skipping simulator pause");
        }

        // Track debugger state
        this.isDebuggerPaused = true;
    }

    /**
     * Handle debugger resumed event
     * If in design mode, always resume the simulator
     */
    handleDebuggerResumed(topic, data) {
        this.logger.info("handleDebuggerResumed", { topic, data });

        const currentMode = this.application.store.get('mode');
        this.logger.info(`Current mode: ${currentMode}, Debugger resumed`);

        // Only sync simulator if we're in design mode
        if (currentMode === 'design') {
            // Always resume simulator when debugger resumes
            this.logger.info("Resuming simulator due to debugger resume");
            this.simulator.setSimRunning(true);
        } else {
            this.logger.info("Not in design mode, skipping simulator resume");
        }

        // Reset state tracking
        this.isDebuggerPaused = false;
        this.wasSimulatorRunningBeforePause = false;
    }

    /**
     * Handle debugger connected event
     * Start the simulator when debugging begins in design mode
     */
    handleDebuggerConnected(topic, data) {
        this.logger.info("handleDebuggerConnected", { topic, data });

        const currentMode = this.application.store.get('mode');
        this.logger.info(`Current mode: ${currentMode}, Debugger connected`);

        // Only sync simulator if we're in design mode
        if (currentMode === 'design') {
            // Start the simulator when debugger connects
            if (!this.simulator.isRunning()) {
                this.logger.info("Starting simulator due to debugger connection");
                this.simulator.setSimRunning(true);
            }
        } else {
            this.logger.info("Not in design mode, skipping simulator start");
        }
    }

    /**
     * Handle debugger disconnected event
     * Stop the simulator and clean up state when debugger disconnects
     */
    handleDebuggerDisconnected(topic, data) {
        this.logger.info("handleDebuggerDisconnected", { topic, data });

        const currentMode = this.application.store.get('mode');
        this.logger.info(`Current mode: ${currentMode}, Debugger disconnected`);

        // Only sync simulator if we're in design mode
        if (currentMode === 'design') {
            // Stop the simulator when debugger disconnects
            this.logger.info("Stopping simulator due to debugger disconnection");
            this.simulator.setSimRunning(false);

            // Reset the simulator state (clock and circuit)
            this.logger.info("Resetting simulator clock and circuit state");
            this.resetSimulator();
        } else {
            this.logger.info("Not in design mode, skipping simulator stop");
        }

        // Reset state tracking
        this.isDebuggerPaused = false;
        this.wasSimulatorRunningBeforePause = false;

        this.logger.info("Debugger disconnected, simulator stopped and sync state reset");
    }

    /**
     * Reset the simulator clock and circuit to initial state
     */
    resetSimulator() {
        try {
            if (!this.simulator) {
                this.logger.warn("Simulator not available for reset");
                return;
            }

            // Reset using CircuitJS1's reset command
            if (this.simulator.menuPerformed) {
                this.logger.info("Calling simulator reset via menuPerformed");
                this.simulator.menuPerformed('main', 'reset');
            } else {
                this.logger.warn("menuPerformed not available on simulator");
            }
        } catch (error) {
            this.logger.error("Failed to reset simulator:", error);
        }
    }

    /**
     * Handle mode changed event
     * Edge case: User switches from design to build (or vice versa) while debugger is paused
     */
    handleModeChanged(topic, data) {
        this.logger.info("handleModeChanged", { topic, data });

        const { from, to } = data;

        // Edge case: Switching away from design mode while debugger is paused
        if (from === 'design' && to === 'build' && this.isDebuggerPaused) {
            this.logger.info("Switched from design to build while debugger paused");
            // In build mode, user controls simulator independently
            // So we restore simulator to its pre-pause state if it was running
            if (this.wasSimulatorRunningBeforePause) {
                this.logger.info("Resuming simulator for build mode");
                this.simulator.setSimRunning(true);
            }
        }

        // Edge case: Switching to design mode while debugger is paused
        if (from === 'build' && to === 'design' && this.isDebuggerPaused) {
            this.logger.info("Switched from build to design while debugger paused");
            // Record current simulator state and pause it
            this.wasSimulatorRunningBeforePause = this.simulator.isRunning();
            if (this.wasSimulatorRunningBeforePause) {
                this.logger.info("Pausing simulator for design mode");
                this.simulator.setSimRunning(false);
            }
        }
    }

    /**
     * Cleanup subscriptions (called when controller is destroyed)
     */
    unbind() {
        this.logger.info("unbind() - Cleaning up subscriptions");
        this.subscriptions.forEach(sub => {
            this.application.unsub(sub);
        });
        this.subscriptions = [];
    }
}