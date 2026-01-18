class Logger{

    static LEVEL = {
        DEBUG: 0,
        INFO:  1,
        WARN:  2,
        ERROR: 3,
        NONE:  4  // Disable all logging
    }

    // Global log level - set to WARN to reduce console spam
    // Change to Logger.LEVEL.DEBUG for verbose logging
    static globalLogLevel = Logger.LEVEL.INFO;

    constructor(label, defaultLogLevel) {
        this.defaultLogLevel = defaultLogLevel || "info";
        this.label = label;
    }

    shouldLog(level) {
        return level >= Logger.globalLogLevel;
    }

    log(){
        if (this.shouldLog(Logger.LEVEL.INFO)) {
            console[this.defaultLogLevel].apply(undefined, [new Date().toISOString(), this.label, [].slice.call(arguments)]);
        }
    }

    debug(){
        if (this.shouldLog(Logger.LEVEL.DEBUG)) {
            console.debug.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
        }
    }

    info(){
        if (this.shouldLog(Logger.LEVEL.INFO)) {
            console.info.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
        }
    }

    warn(){
        if (this.shouldLog(Logger.LEVEL.WARN)) {
            console.warn.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
        }
    }

    trace(){
        if (this.shouldLog(Logger.LEVEL.DEBUG)) {
            console.trace.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
        }
    }

    error(){
        if (this.shouldLog(Logger.LEVEL.ERROR)) {
            console.error.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
        }
    }
}
