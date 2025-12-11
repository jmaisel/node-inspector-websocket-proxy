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
     * Creates a new Logger instance
     * @param {string} label - Label to prefix all log messages with
     * @param {string} [defaultLogLevel="info"] - Default log level for the log() method
     */
    constructor(label, defaultLogLevel) {
        this.defaultLogLevel = defaultLogLevel || "info";
        this.label = label;
    }

    /**
     * Logs a message using the default log level
     * @param {...*} args - Arguments to log
     */
    log(){
        console[this.defaultLogLevel].apply(undefined, [new Date().toISOString(), this.label, [].slice.call(arguments)]);
    }

    /**
     * Logs a debug message
     * @param {...*} args - Arguments to log
     */
    debug(){
        console.debug.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
    }

    /**
     * Logs an info message
     * @param {...*} args - Arguments to log
     */
    info(){
        console.info.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
    }

    /**
     * Logs a warning message
     * @param {...*} args - Arguments to log
     */
    warn(){
        console.warn.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
    }

    /**
     * Logs a trace message with stack trace
     * @param {...*} args - Arguments to log
     */
    trace(){
        console.trace.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
    }

    /**
     * Logs an error message
     * @param {...*} args - Arguments to log
     */
    error(){
        console.error.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
    }
}

module.exports = Logger;