/**
 * Pillar 3: EventBus
 * A zero-dependency Pub/Sub nervous system.
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        return () => {
            const callbacks = this.listeners.get(event);
            if (callbacks) callbacks.delete(callback);
        };
    }

    publish(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try { callback(data); } 
                catch (err) { console.error(`[Nova EventBus] Error:`, err); }
            });
        }
    }
}
