import { EventBus } from './core/EventBus.js';
import { ContextStore } from './core/ContextStore.js';
import { TimelineSync } from './core/TimelineSync.js';
import { logger } from './core/NovaLogger.js';

/**
 * Pillars 1 & 2: NovaClient (The Orchestrator)
 */
class NovaClient {
    constructor() {
        this.eventBus = new EventBus();
        this.store = new ContextStore();
        this.timeline = new TimelineSync(this.eventBus);
        this.publishData = null; // Bound by NovaProvider
    }

    setPublisher(publishFn) {
        this.publishData = publishFn;
        logger.log("WEBRTC", "LocalParticipant Publisher Bound to SDK.");
    }

    registerCapability({ name, description, execute }) {
        this.store.register(name, description, execute);
        this.eventBus.publish('schema_updated', this.store.getSchema());
    }

    executeCapability(name, payload) {
        logger.log("WEBRTC", `Received command to execute: ${name}`, payload);
        const cap = this.store.getCapability(name);
        
        const onAck = (status, message) => {
            if (this.publishData) {
                const ackPayload = JSON.stringify({ type: "ack", key: name, status, message });
                logger.log("ACK_SYSTEM", `Firing ACK back to Agent: ${status}`);
                this.publishData(new TextEncoder().encode(ackPayload), { topic: "ui_control" });
            }
        };

        if (cap) {
            this.timeline.enqueue(() => cap.execute(payload), onAck);
        } else {
            logger.error("UI_EXECUTION", `Action '${name}' is not registered on the current screen.`);
            onAck("error", "Capability not registered on this screen.");
        }
    }

    getSchema() {
        return this.store.getSchema();
    }
}

export const novaClient = new NovaClient();
