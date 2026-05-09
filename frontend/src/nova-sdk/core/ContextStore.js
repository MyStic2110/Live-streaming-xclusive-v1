import { logger } from './NovaLogger.js';

/**
 * Pillar 5: ContextStore
 * Stores active capabilities on the current screen.
 */
export class ContextStore {
    constructor() {
        this.capabilities = new Map();
        this.companyName = "My SaaS Platform";
    }

    register(actionName, description, executeFn) {
        this.capabilities.set(actionName, {
            description,
            execute: executeFn
        });
        logger.log("MICRO_SCHEMA", `Capability Mounted: ${actionName}`);
    }

    unregister(actionName) {
        this.capabilities.delete(actionName);
        logger.log("MICRO_SCHEMA", `Capability Unmounted: ${actionName}`);
    }

    getCapability(actionName) {
        return this.capabilities.get(actionName);
    }

    getSchema() {
        const actions = {};
        for (const [key, cap] of this.capabilities.entries()) {
            actions[key] = cap.description;
        }

        return {
            company_name: this.companyName,
            available_actions: actions
        };
    }
}
