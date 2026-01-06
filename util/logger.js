/**
 * Simple logger utility with labeled, timestamped output
 */
class Logger{

    /**
     * Available log levels
     * @type {Object.<string, string>}
     */
    static LEVEL = {
        DEBUG: "debug",
        INFO:  "info",
        WARN:  "warn",
        ERROR: "error"
    }

    /**
     * Log level priorities (lower number = more verbose)
     * @type {Object.<string, number>}
     */
    static LEVEL_PRIORITY = {
        "debug": 0,
        "info": 1,
        "warn": 2,
        "error": 3
    }

    /**
     * Creates a new Logger instance
     * @param {string} label - Label to prefix all log messages with
     * @param {string} [defaultLogLevel="info"] - Default log level for the log() method
     * @param {string} [minLogLevel="debug"] - Minimum log level to output (debug, info, warn, error)
     */
    constructor(label, defaultLogLevel, minLogLevel) {
        this.defaultLogLevel = defaultLogLevel || "info";
        this.minLogLevel = minLogLevel || "debug";
        this.label = label;
    }

    /**
     * Check if a message at the given level should be logged
     * @param {string} level - The level to check
     * @returns {boolean} True if the message should be logged
     * @private
     */
    shouldLog(level) {
        const messagePriority = Logger.LEVEL_PRIORITY[level] || 0;
        const minPriority = Logger.LEVEL_PRIORITY[this.minLogLevel] || 0;
        return messagePriority >= minPriority;
    }

    /**
     * Logs a message using the default log level
     * @param {...*} args - Arguments to log
     */
    log(){
        if (!this.shouldLog(this.defaultLogLevel)) return;
        console[this.defaultLogLevel].apply(undefined, [new Date().toISOString(), this.label, [].slice.call(arguments)]);
    }

    /**
     * Logs a debug message
     * @param {...*} args - Arguments to log
     */
    debug(){
        if (!this.shouldLog('debug')) return;
        console.debug.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
    }

    /**
     * Logs an info message
     * @param {...*} args - Arguments to log
     */
    info(){
        if (!this.shouldLog('info')) return;
        console.info.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
    }

    /**
     * Logs a warning message
     * @param {...*} args - Arguments to log
     */
    warn(){
        if (!this.shouldLog('warn')) return;
        console.warn.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
    }

    /**
     * Logs a trace message with stack trace
     * @param {...*} args - Arguments to log
     */
    trace(){
        if (!this.shouldLog('debug')) return;
        console.trace.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
    }

    /**
     * Logs an error message
     * @param {...*} args - Arguments to log
     */
    error(){
        if (!this.shouldLog('error')) return;
        console.error.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
    }
}

module.exports = Logger;