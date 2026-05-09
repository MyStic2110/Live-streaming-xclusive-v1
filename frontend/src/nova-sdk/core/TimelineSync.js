import { logger } from './NovaLogger.js';

/**
 * Pillar 4: TimelineSync
 * Ensures UI actions wait for the Agent to finish speaking.
 */
export class TimelineSync {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.queue = [];
        this.agentState = "idle"; // Can be "listening", "thinking", "speaking", "idle"
        this.isProcessing = false;
    }

    setAgentState(newState) {
        const oldState = this.agentState;
        this.agentState = newState;
        logger.log("AGENT_STATE", `State transitioned: ${oldState} -> ${newState}`);
        
        // If agent just finished speaking or thinking, process the queue
        if ((oldState === "speaking" || oldState === "thinking") && 
            (newState === "idle" || newState === "listening")) {
            logger.log("TIMELINE", "Agent finished speaking. Releasing queue lock.");
            this.processQueue();
        }
    }

    enqueue(executeFn, onAck) {
        this.queue.push({ executeFn, onAck });
        logger.log("TIMELINE", "Action queued. Waiting for agent to finish speaking...");
        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessing) return;
        
        // Wait if the agent is actively talking
        if (this.agentState === "speaking" || this.agentState === "thinking") {
            logger.log("TIMELINE", "Execution blocked. Agent is currently speaking.");
            return;
        }

        this.isProcessing = true;
        
        while(this.queue.length > 0) {
            const { executeFn, onAck } = this.queue.shift();
            try {
                logger.log("UI_EXECUTION", "Executing capability...");
                // Await allows support for async capabilities (API calls)
                const result = await executeFn();
                logger.log("UI_EXECUTION", "Execution Success.");
                if (onAck) onAck("success", result ? String(result) : "OK");
            } catch(e) {
                logger.error("UI_EXECUTION", "Execution Failed.", e);
                if (onAck) onAck("error", e.message || "Execution failed");
            }
        }
        
        this.isProcessing = false;
    }
}
