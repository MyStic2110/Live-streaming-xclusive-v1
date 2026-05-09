/**
 * Digital Twin Logger
 * Traces the exact lifecycle of the Nova pipeline across the frontend.
 */
class NovaLogger {
    constructor() {
        this.enabled = true;
    }

    log(phase, message, data = null) {
        if (!this.enabled) return;
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        const prefix = `[NOVA:DIGITAL_TWIN] [${timestamp}] [PHASE: ${phase}]`;
        
        if (data) {
            console.log(`%c${prefix} %c${message}`, "color: #00d2ff; font-weight: bold;", "color: inherit;", data);
        } else {
            console.log(`%c${prefix} %c${message}`, "color: #00d2ff; font-weight: bold;", "color: inherit;");
        }
    }

    error(phase, message, err) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        const prefix = `[NOVA:DIGITAL_TWIN] [${timestamp}] [PHASE: ${phase}]`;
        console.error(`${prefix} ${message}`, err);
    }
}

export const logger = new NovaLogger();
