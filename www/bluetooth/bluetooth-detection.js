/**
 * Bluetooth Implementation Detection
 *
 * Detects which Bluetooth implementation is available:
 * - Web Serial API (modern, browser-based)
 * - Node.js serialport via IPC (traditional, requires native modules)
 */

class BluetoothDetection {
    constructor() {
        this.logger = new Logger('BluetoothDetection');
    }

    /**
     * Detect available Bluetooth implementations
     * @returns {Object} Detection result
     */
    async detect() {
        const result = {
            webSerial: false,
            serialport: false,
            recommended: null,
            implementations: []
        };

        // Check Web Serial API
        if ('serial' in navigator) {
            this.logger.info('Web Serial API detected');
            result.webSerial = true;
            result.implementations.push({
                type: 'webserial',
                name: 'Web Serial API',
                description: 'Modern browser-based serial communication',
                available: true
            });
        } else {
            this.logger.info('Web Serial API not available');
        }

        // Check for serialport via IPC (Electron main process)
        // This would require IPC handlers to be set up
        if (window.electron && window.electron.serialport) {
            this.logger.info('Node.js serialport detected via IPC');
            result.serialport = true;
            result.implementations.push({
                type: 'serialport',
                name: 'Node.js serialport',
                description: 'Traditional serial port access via native modules',
                available: true
            });
        } else {
            this.logger.info('Node.js serialport not available');
        }

        // Determine recommended implementation
        if (result.webSerial) {
            result.recommended = 'webserial';
            this.logger.info('Recommending Web Serial API');
        } else if (result.serialport) {
            result.recommended = 'serialport';
            this.logger.info('Recommending Node.js serialport');
        } else {
            this.logger.warn('No Bluetooth implementations available');
            result.recommended = null;
        }

        return result;
    }

    /**
     * Get user-friendly status message
     * @param {Object} detection - Detection result
     * @returns {string} Status message
     */
    getStatusMessage(detection) {
        if (detection.webSerial) {
            return 'Using Web Serial API (Chrome 117+)';
        } else if (detection.serialport) {
            return 'Using Node.js serialport';
        } else {
            return 'No serial communication available';
        }
    }

    /**
     * Check if any implementation is available
     * @param {Object} detection - Detection result
     * @returns {boolean}
     */
    isAvailable(detection) {
        return detection.webSerial || detection.serialport;
    }
}

// Make available globally
window.BluetoothDetection = BluetoothDetection;
