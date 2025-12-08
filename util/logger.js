class Logger{

    static LEVEL = {
        DEBUG: "debug",
        INFO:  "info",
        WARN:  "warn",
        ERROR: "error"
    }

    constructor(label, defaultLogLevel) {
        this.defaultLogLevel = defaultLogLevel || "info";
        this.label = label;
    }

    log(){
        console[this.defaultLogLevel].apply(undefined, [new Date().toISOString(), this.label, [].slice.call(arguments)]);
    }

    debug(){
        console.debug.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
    }

    info(){
        console.info.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
    }

    warn(){
        console.warn.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
    }

    trace(){
        console.trace.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
    }

    error(){
        console.error.apply(undefined, [this.label, new Date().toISOString(), [].slice.call(arguments)]);
    }
}

module.exports = Logger;